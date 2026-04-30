// .eml is RFC822 — plain text headers, blank line, then body (possibly MIME
// multipart). We parse the few headers worth showing, locate the text/plain
// part if multipart, and decode quoted-printable when present. Heavy-weight
// HTML / attachment handling is out of scope; we want enough to feed retrieval.

export async function extractEml(file) {
  const raw = await file.text()
  const sepIdx = raw.search(/\r?\n\r?\n/)
  if (sepIdx < 0) return raw.trim()

  const headerBlock = unfoldHeaders(raw.slice(0, sepIdx))
  const body = raw.slice(sepIdx).replace(/^\r?\n\r?\n/, '')

  const subject = getHeader(headerBlock, 'Subject')
  const from = getHeader(headerBlock, 'From')
  const to = getHeader(headerBlock, 'To')
  const date = getHeader(headerBlock, 'Date')
  const contentType = getHeader(headerBlock, 'Content-Type')
  const encoding = getHeader(headerBlock, 'Content-Transfer-Encoding')

  let bodyText = body
  const boundary = contentType.match(/boundary="?([^";\s]+)"?/i)?.[1]
  if (boundary) {
    const part = pickTextPart(body, boundary)
    if (part) bodyText = part
  } else if (/quoted-printable/i.test(encoding)) {
    bodyText = decodeQuotedPrintable(body)
  } else if (/^base64\s*$/i.test(encoding)) {
    bodyText = decodeBase64(body)
  }

  const headerLines = []
  if (subject) headerLines.push(`Subject: ${subject}`)
  if (from) headerLines.push(`From: ${from}`)
  if (to) headerLines.push(`To: ${to}`)
  if (date) headerLines.push(`Date: ${date}`)

  return `${headerLines.join('\n')}\n\n${bodyText.trim()}`.trim()
}

function unfoldHeaders(block) {
  return block.replace(/\r?\n[ \t]+/g, ' ')
}

function getHeader(block, name) {
  const re = new RegExp(`^${name}:\\s*(.+)$`, 'mi')
  const m = block.match(re)
  return m ? m[1].trim() : ''
}

function pickTextPart(body, boundary) {
  const parts = body.split(`--${boundary}`)
  for (const part of parts) {
    const sep = part.search(/\r?\n\r?\n/)
    if (sep < 0) continue
    const partHeaders = unfoldHeaders(part.slice(0, sep))
    const partBody = part.slice(sep).replace(/^\r?\n\r?\n/, '')
    const ct = getHeader(partHeaders, 'Content-Type')
    if (!/^text\/plain/i.test(ct)) continue
    const enc = getHeader(partHeaders, 'Content-Transfer-Encoding')
    if (/quoted-printable/i.test(enc)) return decodeQuotedPrintable(partBody)
    if (/^base64\s*$/i.test(enc)) return decodeBase64(partBody)
    return partBody
  }
  return null
}

function decodeQuotedPrintable(s) {
  return s
    .replace(/=\r?\n/g, '')
    .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function decodeBase64(s) {
  try {
    return atob(s.replace(/\s+/g, ''))
  } catch {
    return s
  }
}
