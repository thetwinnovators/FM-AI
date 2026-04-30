// PDF text extraction via pdfjs-dist.
// Loaded lazily by extract.js so the worker + main bundle don't ship with
// every page load — only when the user uploads a PDF.

export async function extractPdf(file) {
  const pdfjs = await import('pdfjs-dist')
  // Vite resolves this to a static asset URL at build time. Without this,
  // pdfjs falls back to fetching the worker from a CDN, which a local-first
  // tool shouldn't depend on.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  }

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((it) => ('str' in it ? it.str : '')).join(' ')
    pages.push(text.trim())
  }
  return pages.filter(Boolean).join('\n\n')
}
