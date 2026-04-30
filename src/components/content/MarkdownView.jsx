import { renderMarkdownLite, renderInline } from '../../lib/search/articleReader.js'

// Render a parsed markdown block list into JSX. Pairs with renderMarkdownLite
// to keep the parser stupid-simple while still giving readable typography.
//
// Used by ArticleReader's "Load site content" button to display Jina-cleaned
// article bodies inline in the modal.
export default function MarkdownView({ markdown, className = '' }) {
  if (!markdown) return null
  const blocks = renderMarkdownLite(markdown)

  return (
    <div className={`space-y-3 text-[14.5px] leading-relaxed text-white/85 ${className}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading': {
            const sizes = { 1: 'text-xl', 2: 'text-lg', 3: 'text-base', 4: 'text-sm', 5: 'text-sm', 6: 'text-sm' }
            const cls = `font-semibold text-white mt-4 ${sizes[b.level] || 'text-sm'}`
            return <h3 key={i} className={cls}>{b.text}</h3>
          }
          case 'paragraph':
            return <p key={i} className="text-white/85">{renderInlineNodes(b.text)}</p>
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul'
            const listCls = b.ordered ? 'list-decimal pl-5 space-y-1' : 'list-disc pl-5 space-y-1'
            return (
              <Tag key={i} className={listCls}>
                {b.items.map((item, j) => (
                  <li key={j} className="text-white/85">{renderInlineNodes(item)}</li>
                ))}
              </Tag>
            )
          }
          case 'code':
            return (
              <pre key={i} className="overflow-auto rounded-lg bg-black/40 p-3 text-[12.5px] leading-snug text-white/85 font-mono whitespace-pre">
                <code>{b.text}</code>
              </pre>
            )
          case 'image':
            return (
              <img
                key={i}
                src={b.src}
                alt={b.alt || ''}
                loading="lazy"
                className="rounded-lg w-full max-w-full"
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}

function renderInlineNodes(text) {
  return renderInline(text).map((n, i) => {
    switch (n.kind) {
      case 'link':
        return (
          <a key={i} href={n.href} target="_blank" rel="noreferrer" className="text-[color:var(--color-tool)] hover:underline">
            {n.text}
          </a>
        )
      case 'bold':
        return <strong key={i} className="text-white">{n.value}</strong>
      case 'italic':
        return <em key={i}>{n.value}</em>
      case 'code':
        return <code key={i} className="px-1 py-0.5 rounded bg-white/10 text-[12.5px] font-mono">{n.value}</code>
      default:
        return <span key={i}>{n.value}</span>
    }
  })
}
