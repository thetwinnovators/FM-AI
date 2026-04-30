// PowerPoint .pptx extraction. PPTX is a zip of XML files; each slide lives
// at ppt/slides/slideN.xml. Inside, text runs are wrapped in <a:t>…</a:t>.
// Pulling those tags gives a reasonable textual representation without a
// heavyweight library — JSZip plus a regex.

export async function extractPptx(file) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())

  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => slideNumber(a) - slideNumber(b))

  const blocks = []
  for (let i = 0; i < slidePaths.length; i++) {
    const xml = await zip.files[slidePaths[i]].async('string')
    const runs = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) =>
      decodeXmlEntities(m[1])
    )
    const text = runs.join(' ').replace(/\s+/g, ' ').trim()
    if (text) blocks.push(`## Slide ${i + 1}\n\n${text}`)
  }
  return blocks.join('\n\n').trim()
}

function slideNumber(path) {
  const m = path.match(/slide(\d+)\.xml/)
  return m ? parseInt(m[1], 10) : 0
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
