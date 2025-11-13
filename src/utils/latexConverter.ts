import katex from "katex";
import Temml from "temml";
import { mml2omml } from "mathml2omml";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { convertOmml2Math } from "@hungknguyen/docx-math-converter";
import { marked } from "marked";

export type TextToken = { type: "text"; id: string; text: string };
export type MathToken = {
  type: "math";
  id: string;
  latex: string;
  displayMode: boolean;
  katexHtml: string;
  mathml: string;
  omml: string;
};
export type Token = TextToken | MathToken;

const LATEX_ACCENT_MAP: Record<string, Record<string, string>> = {
  '\\hat': {
    'A': 'Â', 'a': 'â', 'E': 'Ê', 'e': 'ê', 'I': 'Î', 'i': 'î',
    'O': 'Ô', 'o': 'ô', 'U': 'Û', 'u': 'û', 'Y': 'Ŷ', 'y': 'ŷ',
    'W': 'Ŵ', 'w': 'ŵ', 'Z': 'Ẑ', 'z': 'ẑ', 'C': 'Ĉ', 'c': 'ĉ',
    'G': 'Ĝ', 'g': 'ĝ', 'H': 'Ĥ', 'h': 'ĥ', 'S': 'Ŝ', 's': 'ŝ'
  },
  '\\bar': {
    'A': 'Ā', 'a': 'ā', 'E': 'Ē', 'e': 'ē', 'I': 'Ī', 'i': 'ī',
    'O': 'Ō', 'o': 'ō', 'U': 'Ū', 'u': 'ū', 'Y': 'Ȳ', 'y': 'ȳ',
    'x': 'x\u0304', 'X': 'X\u0304'
  },
  '\\tilde': {
    'A': 'Ã', 'a': 'ã', 'N': 'Ñ', 'n': 'ñ', 'O': 'Õ', 'o': 'õ',
    'I': 'Ĩ', 'i': 'ĩ', 'U': 'Ũ', 'u': 'ũ', 'Y': 'Ỹ', 'y': 'ỹ',
    'v': 'ṽ', 'V': 'Ṽ'
  },
  '\\dot': {
    'x': 'ẋ', 'X': 'Ẋ', 'y': 'ẏ', 'Y': 'Ẏ', 'z': 'ż', 'Z': 'Ż'
  },
};

const normalizeAccentsToUnicode = (text: string) => {
  let output = text;
  for (const [macro, table] of Object.entries(LATEX_ACCENT_MAP)) {
    const macroName = macro.startsWith('\\') ? macro.slice(1) : macro;
    const pattern = new RegExp(String.raw`\\${macroName}\s*\{([A-Za-z])\}`, 'g');
    output = output.replace(pattern, (match, letter: string) => table[letter] ?? match);
  }
  return output;
};

const regex = /\$\$([\s\S]+?)\$\$|\$([^\n$]+?)\$/g;

const tokenize = (text: string) => {
  const tokens: { type: "text" | "latex"; id: string; text?: string; latex?: string; displayMode?: boolean }[] = [];
  let lastIndex = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      tokens.push({ type: "text", id: `t-${i++}`, text: text.slice(lastIndex, m.index) });
    }
    const isBlock = !!m[1];
    const content = (m[1] ?? m[2] ?? "");
    tokens.push({ type: "latex", id: `m-${i++}`, latex: content, displayMode: isBlock });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", id: `t-${i++}`, text: text.slice(lastIndex) });
  }
  return tokens;
};

const convertLatexToken = (latex: string, displayMode: boolean) => {
  const katexHtml = katex.renderToString(latex, { displayMode, throwOnError: false });
  const mathml = Temml.renderToString(latex, { displayMode, throwOnError: false, xml: true });
  const omml = mml2omml(mathml);
  return { katexHtml, mathml, omml };
};

export const tokenizeAndConvert = (text: string): Token[] => {
  const normalized = normalizeAccentsToUnicode(text);
  const raw = tokenize(normalized);
  return raw.map((t) => {
    if (t.type === "text") {
      return { type: "text", id: t.id, text: t.text ?? "" } as TextToken;
    }
    const latex = normalizeAccentsToUnicode(t.latex ?? "");
    const { katexHtml, mathml, omml } = convertLatexToken(latex, !!t.displayMode);
    return {
      type: "math",
      id: t.id,
      latex,
      displayMode: !!t.displayMode,
      katexHtml,
      mathml,
      omml,
    } as MathToken;
  });
};

const mathPlaceholder = (id: string) => `MATHPH${id}PHMATH`;

const renderMarkdownWithPlaceholders = (
  tokens: Token[],
  replacer: (t: MathToken) => string,
) => {
  const combined = tokens
    .map((t) => {
      if (t.type === "text") return t.text;
      const ph = mathPlaceholder(t.id);
      return t.displayMode ? `\n\n${ph}\n\n` : ph;
    })
    .join("");
  const html = marked.parse(combined) as string;
  let out = html;
  tokens.forEach((t) => {
    if (t.type === "math") {
      const ph = mathPlaceholder(t.id);
      const repl = replacer(t);
      out = out.split(ph).join(repl);
    }
  });
  return out;
};

export const buildPreviewHtmlFromTokens = (tokens: Token[]): string => {
  return renderMarkdownWithPlaceholders(tokens, (t) =>
    t.displayMode ? `<div>${t.katexHtml}</div>` : `<span>${t.katexHtml}</span>`,
  );
};

export const buildWordHtmlFromTokens = (tokens: Token[]): string => {
  const ns = "http://schemas.openxmlformats.org/officeDocument/2006/math";
  const body = renderMarkdownWithPlaceholders(tokens, (t) =>
    t.displayMode ? `<div>${t.omml}</div>` : `${t.omml}`,
  );
  return `<!DOCTYPE html><html xmlns:m="${ns}"><head><meta charset="UTF-8"></head><body>${body}</body></html>`;
};

export const copyWordHtmlToClipboard = async (html: string) => {
  try {
    if ("clipboard" in navigator && "write" in navigator.clipboard) {
      const blob = new Blob([html], { type: "text/html" });
      const item = new ClipboardItem({ "text/html": blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (e) {}
  try {
    await navigator.clipboard.writeText(html);
    return true;
  } catch (e) {
    console.error("Clipboard write failed", e);
    return false;
  }
};

export const generateDocx = async (tokens: Token[]): Promise<Blob> => {
  const combined = tokens
    .map((t) => (t.type === "text" ? t.text : t.displayMode ? `\n\n${mathPlaceholder(t.id)}\n\n` : mathPlaceholder(t.id)))
    .join("");

  const mdTokens: any[] = (marked as any).lexer(combined);
  const mathMap = new Map<string, MathToken>();
  tokens.forEach((t) => {
    if ((t as any).type === "math") mathMap.set((t as MathToken).id, t as MathToken);
  });

  const splitInlineByMath = (text: string): Array<string | MathToken> => {
    const result: Array<string | MathToken> = [];
    const re = /MATHPH(.+?)PHMATH/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) result.push(text.slice(last, m.index));
      const id = m[1];
      const mt = mathMap.get(id);
      if (mt) result.push(mt);
      last = re.lastIndex;
    }
    if (last < text.length) result.push(text.slice(last));
    return result;
  };

  const inlineTokensToRuns = (inline: any[], style: { bold?: boolean; italics?: boolean } = {}) => {
    const runs: Array<TextRun | ReturnType<typeof convertOmml2Math>> = [];
    const emitStyledRuns = (text: string, init: { bold?: boolean; italics?: boolean } = {}) => {
      const out: TextRun[] = [];
      let i = 0;
      let buf = '';
      let bold = !!init.bold;
      let italics = !!init.italics;
      while (i < text.length) {
        if (text.startsWith('**', i)) {
          if (buf) { out.push(new TextRun({ text: buf, bold, italics })); buf = ''; }
          bold = !bold; i += 2; continue;
        }
        const ch = text[i];
        if (ch === '*') {
          if (buf) { out.push(new TextRun({ text: buf, bold, italics })); buf = ''; }
          italics = !italics; i += 1; continue;
        }
        buf += ch; i += 1;
      }
      if (buf) out.push(new TextRun({ text: buf, bold, italics }));
      return out;
    };
    const inlineTokensFromText = (s: string) => {
      const L = (marked as any).Lexer;
      if (L && typeof L.lexInline === 'function') {
        return L.lexInline(s);
      }
      if (L) {
        try {
          const inst = new L();
          if (inst && typeof inst.inlineTokens === 'function') {
            return inst.inlineTokens(s);
          }
        } catch {}
      }
      const blocks = (marked as any).lexer?.(s);
      if (Array.isArray(blocks) && blocks.length && blocks[0]?.tokens) {
        return blocks[0].tokens;
      }
      return [{ type: 'text', text: s }];
    };
    for (const it of inline ?? []) {
      switch (it.type) {
        case 'text': {
          const sub = inlineTokensFromText(it.text || '');
          if (sub.length === 1 && sub[0].type === 'text') {
            const parts = splitInlineByMath(sub[0].text || '');
            for (const p of parts) {
              if (typeof p === 'string') {
                if (p) runs.push(...emitStyledRuns(p, style));
              } else {
                const isOmmlPlain = (xml: string) => !/<m:(?!oMath\b|r\b|t\b|rPr\b)\w+/.test(xml);
                const extractTextFromOmml = (xml: string) => {
                  const arr: string[] = [];
                  const re = /<m:t[^>]*>([^<]*)<\/m:t>/g;
                  let m: RegExpExecArray | null;
                  while ((m = re.exec(xml)) !== null) arr.push(m[1]);
                  return arr.join("");
                };
                if (isOmmlPlain(p.omml)) {
                  const text = extractTextFromOmml(p.omml);
                  if (text) runs.push(...emitStyledRuns(text, style));
                } else {
                  runs.push(convertOmml2Math(p.omml));
                }
              }
            }
          } else {
            runs.push(...inlineTokensToRuns(sub, style));
          }
          break;
        }
        case 'strong':
          runs.push(...inlineTokensToRuns(it.tokens || [], { ...style, bold: true }));
          break;
        case 'em':
          runs.push(...inlineTokensToRuns(it.tokens || [], { ...style, italics: true }));
          break;
        case 'codespan':
          runs.push(new TextRun({ text: it.text || '', bold: !!style.bold, italics: !!style.italics }));
          break;
        case 'br':
          runs.push(new TextRun({ break: 1 } as any));
          break;
        case 'link':
          runs.push(...inlineTokensToRuns(it.tokens || [{ type: 'text', text: it.text }], style));
          break;
        default:
          if (it.tokens) runs.push(...inlineTokensToRuns(it.tokens, style));
      }
    }
    return runs;
  };

  const headingForDepth = (d: number) => {
    switch (d) {
      case 1: return HeadingLevel.HEADING_1;
      case 2: return HeadingLevel.HEADING_2;
      case 3: return HeadingLevel.HEADING_3;
      case 4: return HeadingLevel.HEADING_4;
      case 5: return HeadingLevel.HEADING_5;
      default: return HeadingLevel.HEADING_6;
    }
  };

  const paragraphs: Paragraph[] = [];

  const inlineTokensFromText = (s: string) => {
    const L = (marked as any).Lexer;
    if (L && typeof L.lexInline === 'function') {
      return L.lexInline(s);
    }
    if (L) {
      try {
        const inst = new L();
        if (inst && typeof inst.inlineTokens === 'function') {
          return inst.inlineTokens(s);
        }
      } catch {}
    }
    const blocks = (marked as any).lexer?.(s);
    if (Array.isArray(blocks) && blocks.length && blocks[0]?.tokens) {
      return blocks[0].tokens;
    }
    return [{ type: 'text', text: s }];
  };

  const listParas = (items: any[], ordered: boolean) => {
    for (const li of items || []) {
      const liInline = inlineTokensFromText(li.text || '');
      const runs = inlineTokensToRuns(liInline);
      paragraphs.push(new Paragraph({
        children: runs,
        numbering: { reference: ordered ? 'numbered-list' : 'bullet-list', level: 0 },
      }));
      if (li.tokens && li.tokens.some((t: any) => t.type === 'list')) {
        const sub = li.tokens.find((t: any) => t.type === 'list');
        listParas(sub.items, sub.ordered);
      }
    }
  };

  for (const tk of mdTokens) {
    switch (tk.type) {
      case 'heading':
        {
          const hInline = (tk.tokens && tk.tokens.length) ? tk.tokens : inlineTokensFromText(tk.text || '');
          paragraphs.push(new Paragraph({ children: inlineTokensToRuns(hInline), heading: headingForDepth(tk.depth || 1) }));
        }
        break;
      case 'paragraph':
        {
          const pInline = (tk.tokens && tk.tokens.length) ? tk.tokens : inlineTokensFromText(tk.text || '');
          paragraphs.push(new Paragraph({ children: inlineTokensToRuns(pInline) }));
        }
        break;
      case 'list':
        listParas(tk.items, !!tk.ordered);
        break;
      case 'hr':
        paragraphs.push(new Paragraph({ thematicBreak: true } as any));
        break;
      case 'code': {
        const lines = (tk.text || '').split('\n');
        for (const line of lines) {
          paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
        }
        break;
      }
      case 'space':
      default:
        break;
    }
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullet-list',
          levels: [
            { level: 0, format: 'bullet' as any, text: '•', start: 1 },
          ],
        },
        {
          reference: 'numbered-list',
          levels: [
            { level: 0, format: 'decimal' as any, text: '%1.', start: 1 },
          ],
        },
      ],
    },
    sections: [{ properties: {}, children: paragraphs }],
  });
  return await Packer.toBlob(doc);
};

export const convertText = (text: string) => {
  const tokens = tokenizeAndConvert(text);
  const previewHtml = buildPreviewHtmlFromTokens(tokens);
  const wordHtml = buildWordHtmlFromTokens(tokens);
  return { tokens, previewHtml, wordHtml };
};
