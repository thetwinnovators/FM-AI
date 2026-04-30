import { FileText, MessageSquare, Sparkles } from 'lucide-react'

// Source-type fallback (for non-upload documents). Pasted = chat-bubble icon,
// saved-url = sparkles, both rendered against the article CSS var.
const SOURCE_CONFIG = {
  pasted:      { label: 'Pasted',    Icon: MessageSquare, cssVar: '--color-article' },
  'saved-url': { label: 'Saved URL', Icon: Sparkles,      cssVar: '--color-article' },
}

// Per-extension display rules. Labels are intentionally short (≤3 chars) so
// they fit inside the 24px chip square. Colors reuse FlowMap's existing node
// type palette tokens so the chips share the rest of the UI's hue family.
const EXT_CONFIG = {
  pdf:      { label: 'PDF', cssVar: '--color-signal' },        // rose
  doc:      { label: 'DOC', cssVar: '--color-company' },       // blue
  docx:     { label: 'DOC', cssVar: '--color-company' },       // blue
  xls:      { label: 'XLS', cssVar: '--color-learning' },      // emerald
  xlsx:     { label: 'XLS', cssVar: '--color-learning' },      // emerald
  ppt:      { label: 'PPT', cssVar: '--color-video' },         // pink
  pptx:     { label: 'PPT', cssVar: '--color-video' },         // pink
  eml:      { label: 'EML', cssVar: '--color-tool' },          // cyan
  md:       { label: 'MD',  cssVar: '--color-social-post' },   // violet
  markdown: { label: 'MD',  cssVar: '--color-social-post' },   // violet
  txt:      { label: 'TXT', cssVar: '--color-concept' },       // slate
}

function extOf(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

// Compact chip that visually identifies a document's origin and (for uploads)
// its file format. Used on Documents grid cards and the Document detail header.
export default function FileTypeChip({ sourceType, fileName, size = 24 }) {
  const ext = sourceType === 'upload' ? extOf(fileName) : ''
  const cfg = EXT_CONFIG[ext]

  if (cfg) {
    const c = `var(${cfg.cssVar})`
    return (
      <span
        className="rounded-md flex items-center justify-center font-bold tracking-tight flex-shrink-0"
        style={{
          width: size,
          height: size,
          color: c,
          backgroundColor: `color-mix(in srgb, ${c} 15%, transparent)`,
          fontSize: cfg.label.length > 2 ? 9 : 10,
          letterSpacing: '-0.02em',
        }}
        title={cfg.label}
      >
        {cfg.label}
      </span>
    )
  }

  // Non-upload (pasted / saved-url) or upload with an unknown extension —
  // fall back to the source-type icon against the article color.
  const sc = SOURCE_CONFIG[sourceType] || {
    label: ext ? ext.toUpperCase().slice(0, 4) : 'File',
    Icon: FileText,
    cssVar: '--color-article',
  }
  const Icon = sc.Icon
  const c = `var(${sc.cssVar})`
  return (
    <span
      className="rounded-md flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        color: c,
        backgroundColor: `color-mix(in srgb, ${c} 15%, transparent)`,
      }}
      title={sc.label}
    >
      <Icon size={Math.floor(size / 2)} />
    </span>
  )
}
