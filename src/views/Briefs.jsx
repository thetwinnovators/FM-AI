import { useState } from 'react'
import { useStore, allBriefsSorted } from '../store/useStore.js'
import BriefModal from '../components/briefs/BriefModal.jsx'
import { BookOpen, Newspaper, Trash2 } from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(diff / 3_600_000)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(diff / 86_400_000)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function BriefRow({ brief, onClick, onDelete }) {
  const isUnread = brief.readAt == null
  const isNews   = brief.type === 'news_digest'

  return (
    <div
      className="group flex items-start gap-4 p-4 rounded-xl transition-colors cursor-pointer"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        opacity: isUnread ? 1 : 0.55,
      }}
      onClick={onClick}
    >
      {/* Unread dot */}
      {isUnread && (
        <span
          className="mt-2 flex-shrink-0"
          style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9488', marginLeft: -2 }}
        />
      )}

      {/* Icon */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-[10px] text-base"
        style={{
          width: 40,
          height: 40,
          background: isNews
            ? 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.12))'
            : 'linear-gradient(135deg,rgba(13,148,136,0.18),rgba(6,182,212,0.1))',
          border: isNews ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(45,212,191,0.18)',
        }}
      >
        {isNews ? '📰' : '🧠'}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] font-semibold uppercase tracking-wide mb-0.5"
          style={{ color: isNews ? 'rgba(167,139,250,0.7)' : 'rgba(45,212,191,0.6)' }}
        >
          {isNews ? 'AI News Digest' : 'Topic Brief'}
        </div>
        <div className="text-[14px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
          {brief.title}
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {relativeTime(new Date(brief.generatedAt).getTime())}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(brief.id) }}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-opacity"
        style={{ color: 'rgba(255,255,255,0.3)' }}
        aria-label="Delete brief"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── main view ─────────────────────────────────────────────────────────────────

export default function Briefs() {
  const { briefs, deleteBrief, markBriefRead } = useStore()
  const [activeBrief, setActiveBrief] = useState(null)

  const sorted = allBriefsSorted(briefs)
  const topicBriefs = sorted.filter((b) => b.type !== 'news_digest')
  const newsDigests = sorted.filter((b) => b.type === 'news_digest')

  function openBrief(brief) {
    markBriefRead(brief.id)
    setActiveBrief(brief)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
          Briefs
        </h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {sorted.length === 0
            ? 'No briefs yet — generate one from a topic or let the daily digest run.'
            : `${sorted.length} brief${sorted.length !== 1 ? 's' : ''} · ${sorted.filter(b => b.readAt == null).length} unread`}
        </p>
      </div>

      {sorted.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-20 text-center rounded-2xl"
          style={{ border: '1px dashed rgba(255,255,255,0.07)' }}
        >
          <BookOpen size={32} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: 12 }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
            No briefs yet
          </p>
        </div>
      )}

      {/* News Digests */}
      {newsDigests.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper size={14} style={{ color: 'rgba(167,139,250,0.7)' }} />
            <h2 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.7)' }}>
              News Digests
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {newsDigests.map((b) => (
              <BriefRow
                key={b.id}
                brief={b}
                onClick={() => openBrief(b)}
                onDelete={deleteBrief}
              />
            ))}
          </div>
        </section>
      )}

      {/* Topic Briefs */}
      {topicBriefs.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={14} style={{ color: 'rgba(45,212,191,0.6)' }} />
            <h2 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(45,212,191,0.6)' }}>
              Topic Briefs
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {topicBriefs.map((b) => (
              <BriefRow
                key={b.id}
                brief={b}
                onClick={() => openBrief(b)}
                onDelete={deleteBrief}
              />
            ))}
          </div>
        </section>
      )}

      {/* Brief reader modal */}
      <BriefModal
        brief={activeBrief}
        onClose={() => setActiveBrief(null)}
        onRefresh={null}
        refreshing={false}
      />
    </div>
  )
}
