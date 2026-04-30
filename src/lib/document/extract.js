// Dispatcher for file → plain-text extraction. Each format lives in its own
// module and is loaded lazily so the main bundle isn't bloated by parsers
// the user might never trigger.
//
// Returns { text } on success, { error } on failure. Callers (Documents
// bulk uploader, paste modal) decide how to surface failures.

const HANDLERS = {
  pdf:      () => import('./pdf.js').then((m) => m.extractPdf),
  docx:     () => import('./docx.js').then((m) => m.extractDocx),
  xlsx:     () => import('./xlsx.js').then((m) => m.extractXlsx),
  xls:      () => import('./xlsx.js').then((m) => m.extractXlsx),
  pptx:     () => import('./pptx.js').then((m) => m.extractPptx),
  eml:      () => import('./eml.js').then((m) => m.extractEml),
  txt:      () => Promise.resolve((f) => f.text()),
  md:       () => Promise.resolve((f) => f.text()),
  markdown: () => Promise.resolve((f) => f.text()),
}

// Pre-2007 binary Office formats. No good browser-side library; the practical
// fix is to convert in the original app, so we surface that hint immediately
// instead of failing with a cryptic error.
const LEGACY_HINTS = {
  doc: 'Save as .docx in Word, then re-upload.',
  ppt: 'Save as .pptx in PowerPoint, then re-upload.',
  xlsb: 'Save as .xlsx in Excel, then re-upload.',
}

export const SUPPORTED_EXTENSIONS = Object.keys(HANDLERS)

// Picker `accept` attribute — extensions plus a few MIME types so drag-drop
// and OS file pickers behave as expected.
export const ACCEPT_ATTR = [
  ...SUPPORTED_EXTENSIONS.map((e) => `.${e}`),
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'message/rfc822',
].join(',')

export function extensionOf(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

export async function extractDocument(file) {
  const ext = extensionOf(file.name)
  const hint = LEGACY_HINTS[ext]
  if (hint) return { error: `Legacy .${ext} not supported — ${hint}` }

  const loader = HANDLERS[ext]
  if (!loader) return { error: `Unsupported format: .${ext || '?'}` }

  try {
    const handler = await loader()
    const text = await handler(file)
    if (!text || !String(text).trim()) {
      return { error: 'No text extracted (file may be empty, scanned, or image-only).' }
    }
    return { text: String(text).trim() }
  } catch (err) {
    return { error: err?.message || `Failed to parse .${ext}` }
  }
}
