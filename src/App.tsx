import { useMemo, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { convertText, copyWordHtmlToClipboard, generateDocx } from '@/utils/latexConverter'

function App() {
  const [input, setInput] = useState<string>("")
  const [html, setHtml] = useState<string>("")
  const [preview, setPreview] = useState<string>("")
  const [busy, setBusy] = useState<boolean>(false)
  const [tokens, setTokens] = useState<ReturnType<typeof convertText>["tokens"]>([])

  const hasEquations = useMemo(() => tokens.some(t => (t as any).type === 'math'), [tokens])

  const onConvert = () => {
    const { tokens: toks, previewHtml, wordHtml } = convertText(input)
    setTokens(toks)
    setPreview(previewHtml)
    setHtml(wordHtml)
  }

  const onCopy = async () => {
    await copyWordHtmlToClipboard(html)
  }

  const onDownload = async () => {
    try {
      setBusy(true)
      const blob = await generateDocx(tokens as any)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'equations.docx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="container mx-auto max-w-5xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Gemini → Word Equation Converter</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Paste Gemini/AI output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={input}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
              placeholder="Paste your AI answer here... Supports $...$ and $$...$$"
              className="min-h-40"
            />
            <div className="flex gap-3">
              <Button onClick={onConvert}>Convert for Word</Button>
              <Button variant="secondary" onClick={() => { setInput(""); setTokens([]); setPreview(""); setHtml("") }}>Clear</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[420px] pr-4">
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: preview }} />
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Output for Word</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <Button disabled={!hasEquations} onClick={onCopy}>Copy HTML for Word</Button>
                <Button disabled={!hasEquations || busy} onClick={onDownload} variant="secondary">
                  {busy ? 'Building…' : 'Download DOCX'}
                </Button>
              </div>
              <Separator />
              <ScrollArea className="h-[360px] pr-4">
                <pre className="text-xs whitespace-pre-wrap break-all">{html}</pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <footer className="text-xs text-muted-foreground text-center">
          100% browser-based — no data uploaded.
        </footer>
      </div>
    </div>
  )
}

export default App
