import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useStore, allBriefsSorted, unreadBriefCount } from '../../store/useStore.js'

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

function BriefItem({ brief, onClick }) {
  const isUnread = brief.readAt == null
  const isNews = brief.type === 'news_digest'

  const preview = (() => {
    const overviewSection = brief.sections?.find((s) => s.type === 'overview' || s.type === 'highlights')
    if (!overviewSection) return ''
    if (overviewSection.content) return overviewSection.content
    if (Array.isArray(overviewSection.items))
      return overviewSection.items
        .slice(0, 2)
        .map((it) => (typeof it === 'string' ? it : (it?.text ?? '')))
        .join(' ')
    return ''
  })()

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-4 py-3 border-b transition-colors hover:bg-white/[0.025]"
      style={{
        borderColor: 'rgba(255,255,255,0.05)',
        opacity: isUnread ? 1 : 0.4,
        position: 'relative',
      }}
    >
      {isUnread && (
        <span
          style={{
            position: 'absolute',
            left: 5,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#0d9488',
            flexShrink: 0,
          }}
        />
      )}

      {/* Icon */}
      <span
        className="flex-shrink-0 flex items-center justify-center text-base rounded-[10px]"
        style={{
          width: 36,
          height: 36,
          background: isNews
            ? 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.12))'
            : 'linear-gradient(135deg,rgba(13,148,136,0.18),rgba(6,182,212,0.1))',
          border: isNews ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(45,212,191,0.18)',
        }}
      >
        {isNews ? '📰' : '🧠'}
      </span>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] font-semibold uppercase tracking-wide mb-0.5"
          style={{ color: isNews ? 'rgba(167,139,250,0.7)' : 'rgba(45,212,191,0.6)' }}
        >
          {isNews ? 'AI News Digest' : 'Topic Brief'}
        </div>
        <div className="text-[13px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {brief.title}
        </div>
        {preview && (
          <div
            className="text-[12px] mt-1 leading-snug"
            style={{
              color: 'rgba(255,255,255,0.35)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {preview}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {isUnread && (
            <span
              className="text-[10px] font-semibold px-[7px] py-0.5 rounded-[5px]"
              style={
                isNews
                  ? { background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }
                  : { background: 'rgba(13,148,136,0.18)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.2)' }
              }
            >
              {isNews ? 'Daily' : `+${brief.newItemCount} new`}
            </span>
          )}
          <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {relativeTime(brief.generatedAt)}
          </span>
        </div>
      </div>
    </button>
  )
}

// ── Main dropdown ─────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {DOMRect} props.anchorRect   — bounding rect of the trigger button
 * @param {function} props.onClose     — close the dropdown
 * @param {function} props.onOpenBrief — (brief) => void
 * @param {function} props.onViewAll   — navigate to /briefs full page
 */
export default function BriefsDropdown({ anchorRect, onClose, onOpenBrief, onViewAll }) {
  const { briefs, markBriefRead, markAllBriefsRead } = useStore()
  const sorted = allBriefsSorted(briefs)
  const dropdownRef = useRef(null)

  // Close on click-outside
  useEffect(() => {
    function onDown(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const top = (anchorRect?.bottom ?? 0) + 8
  const right = window.innerWidth - (anchorRect?.right ?? 0)

  return createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top,
        right,
        zIndex: 200,
        width: 340,
        background: '#0b0e1a',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 14,
        boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <span className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>
          Flow AI Briefs
        </span>
        <button
          onClick={markAllBriefsRead}
          className="text-[11px] font-medium"
          style={{ color: 'rgba(45,212,191,0.7)' }}
        >
          Mark all read
        </button>
      </div>

      {/* Items */}
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            No briefs yet — save 3+ items to a topic to get your first brief.
          </div>
        ) : (
          sorted.map((brief) => (
            <BriefItem
              key={brief.id}
              brief={brief}
              onClick={() => {
                markBriefRead(brief.id)
                onOpenBrief(brief)
                onClose()
              }}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <button
        onClick={() => { onClose(); onViewAll?.() }}
        className="w-full px-4 py-2.5 text-center border-t transition-colors hover:bg-white/[0.03]"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
          View all briefs →
        </span>
      </button>
    </div>,
    document.body,
  )
}
