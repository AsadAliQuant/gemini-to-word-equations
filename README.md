# Gemini → Word Equation Converter (for Mathematics & Statistics)

A 100% browser-based web tool that converts AI-generated mathematical equations (from Gemini or any LLM) into **Microsoft Word–compatible equation format**.

Designed for students, teachers, researchers, and anyone who wants to paste AI math output directly into **Word (.docx)** without broken formatting.

---

## ✨ Features

- 📋 Paste math output from **Gemini / ChatGPT / any AI**
- 🔢 Supports:
  - Inline equations: `$ ... $`
  - Block equations: `$$ ... $$`
- 🧠 Converts LaTeX-style math into **Word Equation (OMML-friendly HTML)**
- 👀 Live preview before exporting
- 📄 Copy HTML ready to paste into Microsoft Word
- ⬇️ Download as `.docx`
- 🔒 **100% client-side** — no data uploaded, no backend
- ⚡ Fast, lightweight, and free

---

## 🧩 How It Works

1. Paste AI-generated math content into the input box  
2. Click **Convert for Word**
3. Preview the formatted equations
4. Either:
   - Copy **Word-compatible HTML**
   - Or download a ready-to-use **DOCX file**

---

## 🖥️ Tech Stack

- **React** — component-based UI
- **Vite** — fast dev server & build tool
- **shadcn/ui** — accessible, modern UI components
- **TypeScript (optional)**  
- **Client-side math parsing & conversion**
- **No backend / no APIs**

---

## 📌 Example Input

```text
The quadratic formula is given by:

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$
