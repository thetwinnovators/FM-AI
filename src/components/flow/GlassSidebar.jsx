import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronRight, ArrowRight, Play, BookOpen, MessageCircle, ExternalLink } from 'lucide-react'
import { NODE_TYPES, getTypeMeta } from '../../lib/graph/nodeTaxonomy.js'

function getNodeCta(node) {
  if (!node) return null
  if (node.type === 'memory' || node.type === 'signal') return null
  if (node.type === 'video')       return { kind: 'action', label: 'Watch video',  Icon: Play          }
  if (node.type === 'article')     return { kind: 'action', label: 'Read article', Icon: BookOpen      }
  if (node.type === 'social_post') return { kind: 'action', label: 'Open post',    Icon: ExternalLink  }
  if (node.type === 'topic') {
    const slug = node.id.startsWith('topic_') ? node.id.slice('topic_'.length) : node.id
    return { kind: 'link', label: 'Open topic page', href: `/topic/${slug}`, Icon: ArrowRight }
  }
  return { kind: 'link', label: `Browse content related to ${node.label}`, href: `/discover?node=${encodeURIComponent(node.id)}`, Icon: ArrowRight }
}

export default function GlassSidebar({
  nodes,
  edges,
  searchQuery,
  setSearchQuery,
  selectedNodeId,
  setSelectedNodeId,
  onPrimaryAction,
}) {
  const [openGroups, setOpenGroups] = useState(new Set())

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null
  const filtered = searchQuery
    ? nodes.filter((n) => (n.label + ' ' + n.summary).toLowerCase().includes(searchQuery.toLowerCase()))
    : null

  const grouped = NODE_TYPES.map((t) => ({
    type: t,
    items: nodes.filter((n) => n.type === t.id),
  })).filter((g) => g.items.length)

  function toggleGroup(id) {
    setOpenGroups((cur) => {
      const next = new Set(cur)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (selectedNode) {
    const meta = getTypeMeta(selectedNode.type)
    const incoming = edges.filter((e) => e.to === selectedNode.id)
    const outgoing = edges.filter((e) => e.from === selectedNode.id)
    return (
      <aside
        className="w-[250px] flex flex-col rounded-2xl overflow-hidden absolute top-[48px] left-3 z-20 max-h-[544px]"
        style={{
          background: 'rgba(6,10,22,0.68)',
          backdropFilter: 'blur(8px) saturate(1.3)',
          border: '1px solid rgba(255,255,255,0.11)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <button onClick={() => setSelectedNodeId(null)} className="text-[10px] text-white/40 hover:text-white">close</button>
        </div>
        <div className="px-3 py-3 overflow-auto">
          <h3 className="text-sm font-semibold leading-tight text-white">{selectedNode.label}</h3>
          {selectedNode.summary ? (
            <p className="text-[11px] text-white/60 mt-2 leading-relaxed">{selectedNode.summary}</p>
          ) : null}

          {incoming.length ? (
            <div className="mt-4">
              <h4 className="text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Receives from ({incoming.length})</h4>
              <div className="flex flex-wrap gap-1">
                {incoming.slice(0, 8).map((e) => {
                  const src = nodes.find((n) => n.id === e.from)
                  if (!src) return null
                  return <button key={e.from} onClick={() => setSelectedNodeId(e.from)} className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/70 hover:bg-white/10">{src.label}</button>
                })}
              </div>
            </div>
          ) : null}

          {outgoing.length ? (
            <div className="mt-4">
              <h4 className="text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Sends to ({outgoing.length})</h4>
              <div className="flex flex-wrap gap-1">
                {outgoing.slice(0, 8).map((e) => {
                  const dst = nodes.find((n) => n.id === e.to)
                  if (!dst) return null
                  return <button key={e.to} onClick={() => setSelectedNodeId(e.to)} className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/70 hover:bg-white/10">{dst.label}</button>
                })}
              </div>
            </div>
          ) : null}

          {(() => {
            const cta = getNodeCta(selectedNode)
            if (!cta) return null
            const className = "mt-5 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-medium transition-colors hover:brightness-125"
            const style = {
              borderColor: `${meta.color}66`,
              background: `${meta.color}1f`,
              color: meta.color,
            }
            if (cta.kind === 'link') {
              return (
                <Link to={cta.href} onClick={() => setSelectedNodeId(null)} className={className} style={style}>
                  {cta.label}
                  <cta.Icon size={11} />
                </Link>
              )
            }
            return (
              <button
                onClick={() => { onPrimaryAction?.(selectedNode); setSelectedNodeId(null) }}
                className={className}
                style={style}
              >
                <cta.Icon size={11} />
                {cta.label}
              </button>
            )
          })()}
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="w-[250px] flex flex-col rounded-2xl overflow-hidden absolute top-[48px] left-3 z-20 max-h-[544px]"
      style={{
        background: 'rgba(6,10,22,0.68)',
        backdropFilter: 'blur(8px) saturate(1.3)',
        border: '1px solid rgba(255,255,255,0.11)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div className="px-3 py-2 border-b border-white/5 relative">
        <Search size={12} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search nodes…"
          className="w-full bg-white/5 border border-white/10 rounded-md pl-7 pr-2 py-1.5 text-[11px] text-white placeholder:text-white/30 outline-none focus:border-white/25"
        />
      </div>

      <div className="overflow-auto flex-1 p-2 glass-scroll">
        {filtered ? (
          filtered.length === 0 ? (
            <p className="text-[10px] text-white/40 px-2 py-4 text-center">No matches.</p>
          ) : (
            <div className="space-y-0.5">
              {filtered.slice(0, 30).map((n) => {
                const meta = getTypeMeta(n.type)
                return (
                  <button
                    key={n.id}
                    onClick={() => { setSelectedNodeId(n.id); setSearchQuery('') }}
                    className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                    <span className="text-[11px] text-white/80 truncate">{n.label}</span>
                  </button>
                )
              })}
            </div>
          )
        ) : (
          <div className="space-y-1">
            {grouped.map(({ type, items }) => {
              const open = openGroups.has(type.id)
              return (
                <div key={type.id}>
                  <button
                    onClick={() => toggleGroup(type.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: type.color }} />
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-white/70 flex-1 text-left">{type.label}</span>
                    <span className="text-[10px] text-white/40">{items.length}</span>
                    <ChevronRight size={12} className={`text-white/30 transition-transform ${open ? 'rotate-90' : ''}`} />
                  </button>
                  {open ? (
                    <div className="ml-3 pl-2 border-l border-white/5 space-y-0.5 my-1">
                      {items.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => setSelectedNodeId(n.id)}
                          className="w-full text-left text-[11px] text-white/70 hover:text-white px-2 py-1 rounded hover:bg-white/5 truncate"
                        >
                          {n.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!filtered ? (
        <div className="px-3 py-2 border-t border-white/5 text-[10px] text-white/35 leading-snug">
          Click a category to expand, then select a node — or click directly on the canvas.
        </div>
      ) : null}
    </aside>
  )
}
