// Word .docx extraction via mammoth's browser bundle.
// Uses convertToHtml (not extractRawText) so that Word heading styles (Heading 1,
// Heading 2, …) become # / ## markers, bold/italic formatting is preserved, and
// tables are linearised as readable text — all of which extractRawText silently drops.

export async function extractDocx(file) {
  const mammoth = await import('mammoth/mammoth.browser')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  return htmlToMarkdown(result.value || '').trim()
}

// Lightweight HTML → Markdown converter for mammoth's output.
// Handles only the elements mammoth actually emits; nothing exotic.
function htmlToMarkdown(html) {
  return html
    // Block elements — process outer before inner to avoid double-wrapping
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => '\n# ' + stripTags(c).trim() + '\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => '\n## ' + stripTags(c).trim() + '\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => '\n### ' + stripTags(c).trim() + '\n\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => '\n#### ' + stripTags(c).trim() + '\n\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, c) => '\n##### ' + stripTags(c).trim() + '\n\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, c) => '\n###### ' + stripTags(c).trim() + '\n\n')
    // Lists
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => '- ' + stripTags(c).trim() + '\n')
    .replace(/<\/[ou]l>/gi, '\n')
    // Table cells — separate with tab, rows with newline
    .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, (_, c) => stripTags(c).trim() + '\t')
    .replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, (_, c) => '**' + stripTags(c).trim() + '**\t')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/table>/gi, '\n\n')
    // Inline formatting
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, c) => '**' + stripTags(c).trim() + '**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, c) => '**' + stripTags(c).trim() + '**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, c) => '*' + stripTags(c).trim() + '*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, c) => '*' + stripTags(c).trim() + '*')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => '`' + stripTags(c).trim() + '`')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, c) => '[' + stripTags(c).trim() + '](' + href + ')')
    // Paragraphs and line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse excessive blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
}
