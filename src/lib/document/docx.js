// Word .docx extraction via mammoth's browser bundle. Mammoth converts the
// document XML to plain text or basic HTML; we want plain text for storage
// and retrieval so we use extractRawText.

export async function extractDocx(file) {
  const mammoth = await import('mammoth/mammoth.browser')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return (result.value || '').trim()
}
