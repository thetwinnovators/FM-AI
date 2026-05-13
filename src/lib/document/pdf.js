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

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()

    // Build lines using hasEOL markers (available in pdfjs-dist ≥3.4).
    // Fall back to Y-coordinate grouping if hasEOL is absent.
    const items = content.items.filter((it) => 'str' in it)

    let lines = []
    const useEol = items.length > 0 && 'hasEOL' in items[0]

    if (useEol) {
      let cur = ''
      for (const item of items) {
        cur += item.str
        if (item.hasEOL) {
          lines.push(cur)
          cur = ''
        }
      }
      if (cur) lines.push(cur)
    } else {
      // Group by Y coordinate — items on the same line share the same Y value
      // (transform[5] in the pdfjs matrix is the vertical translation).
      let curY = null
      let cur = ''
      for (const item of items) {
        const y = Math.round(item.transform[5])
        if (curY !== null && y !== curY) {
          lines.push(cur)
          cur = item.str
        } else {
          cur += item.str
        }
        curY = y
      }
      if (cur) lines.push(cur)
    }

    // Group lines into paragraphs: a blank-looking gap (empty line or whitespace-only
    // line between content lines) signals a new paragraph.
    const paras = []
    let para = []
    for (const line of lines) {
      if (!line.trim()) {
        if (para.length) { paras.push(para.join(' ')); para = [] }
      } else {
        para.push(line.trim())
      }
    }
    if (para.length) paras.push(para.join(' '))

    if (paras.length) pages.push(paras.join('\n\n'))
  }

  return pages.filter(Boolean).join('\n\n')
}
