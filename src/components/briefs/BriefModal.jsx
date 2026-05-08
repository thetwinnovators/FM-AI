import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink } from 'lucide-react'

// ── OG image thumbnail ────────────────────────────────────────────────────────
// Uses microlink.io (free, no auth) to fetch the article's OG image.
// Shows a shimmer skeleton while loading, falls back to domain favicon.

function ArticleThumbnail({ url }) {
  const [imgUrl, setImgUrl] = useState(null)
  const [loaded, setLoaded]  = useState(false)
  const [failed, setFailed]  = useState(false)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setImgUrl(data?.data?.image?.url ?? null)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [url])

  const domain = url ? (() => { try { return new URL(url).hostname } catch { return null } })() : null

  const base = {
    width: 72, height: 50, borderRadius: 7, flexShrink: 0,
    overflow: 'hidden', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
  }

  if (imgUrl && !failed) {
    return (
      <div style={base}>
        {!loaded && (
          <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        )}
        <img
          src={imgUrl}
          alt=""
          onLoad={() => setLoaded(true)}
          onError={() => { setLoaded(true); setFailed(true) }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: loaded ? 'block' : 'none' }}
        />
      </div>
    )
  }

  if (domain) {
    return (
      <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
          alt=""
          style={{ width: 24, height: 24, opacity: 0.5 }}
        />
      </div>
    )
  }

  return <div style={base} />
}

// ── Shared section label ──────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
      {children}
    </div>
  )
}

// ── Section renderers ─────────────────────────────────────────────────────────

function OverviewSection({ section }) {
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <SectionLabel>Overview</SectionLabel>
      <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
        {section.content}
      </p>
    </div>
  )
}

const DOT_COLORS = { rising: '#2dd4bf', shift: '#a78bfa', new: '#60a5fa' }

function WhatChangedSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <SectionLabel>What Changed</SectionLabel>
      <div className="flex flex-col gap-[9px]">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: DOT_COLORS[item.dot] ?? '#2dd4bf',
                flexShrink: 0, marginTop: 6,
              }}
            />
            <p className="text-[14px] leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SignalCard({ signal }) {
  const isStrong = signal.strength === 'Strong'
  return (
    <div
      className="rounded-[10px] p-3"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[11px] font-bold px-[7px] py-0.5 rounded-[5px]"
          style={
            isStrong
              ? { background: 'rgba(13,148,136,0.15)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.2)' }
              : { background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }
          }
        >
          {signal.strength}
        </span>
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {signal.source}
        </span>
      </div>
      <p className="text-[14px] leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {signal.text}
      </p>
    </div>
  )
}

function StrongestSignalsSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <SectionLabel>Strongest Signals</SectionLabel>
      <div className="flex flex-col gap-2">
        {items.map((signal, i) => <SignalCard key={i} signal={signal} />)}
      </div>
    </div>
  )
}

function OpenQuestionsSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <SectionLabel>Open Questions</SectionLabel>
      <div className="flex flex-col gap-[7px]">
        {items.map((q, i) => (
          <div key={i} className="flex items-start gap-[9px] text-[14px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <span className="text-[11px] font-bold flex-shrink-0 pt-px" style={{ color: 'rgba(255,255,255,0.2)', minWidth: 16 }}>
              {i + 1}.
            </span>
            <span>{q}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RisksSection({ section }) {
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <SectionLabel>Risks &amp; Counterpoints</SectionLabel>
      <div
        className="rounded-[10px] p-3.5"
        style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.12)' }}
      >
        <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {section.content}
        </p>
      </div>
    </div>
  )
}

function HighlightsSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-6 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <SectionLabel>Today's Highlights</SectionLabel>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => {
          const text = typeof item === 'string' ? item : item.text
          const url  = typeof item === 'string' ? null  : item.url
          return (
            <div key={i} className="flex items-start gap-3 group">
              {/* OG thumbnail */}
              <ArticleThumbnail url={url} />

              {/* Text + link */}
              <div className="flex-1 min-w-0 flex items-start gap-2">
                <p className="text-[14px] leading-snug flex-1" style={{ color: 'rgba(255,255,255,0.82)' }}>
                  {text}
                </p>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                    title="Open article"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink
                      size={13}
                      style={{ color: 'rgba(45,212,191,0.6)' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#2dd4bf'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(45,212,191,0.6)'}
                    />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ThemesSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <SectionLabel>Emerging Themes</SectionLabel>
      <div className="flex flex-col gap-2.5">
        {items.map((theme, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginTop: 7 }}
            />
            <p className="text-[14px] leading-snug" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {theme}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopSignalSection({ section }) {
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <SectionLabel>Strongest Signal</SectionLabel>
      <div
        className="rounded-[10px] p-3.5"
        style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(45,212,191,0.15)' }}
      >
        <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {section.content}
        </p>
      </div>
    </div>
  )
}

function BriefSection({ section }) {
  switch (section.type) {
    case 'overview':           return <OverviewSection section={section} />
    case 'what_changed':       return <WhatChangedSection section={section} />
    case 'strongest_signals':  return <StrongestSignalsSection section={section} />
    case 'open_questions':     return <OpenQuestionsSection section={section} />
    case 'risks':              return section.content ? <RisksSection section={section} /> : null
    case 'highlights':         return <HighlightsSection section={section} />
    case 'themes':             return <ThemesSection section={section} />
    case 'top_signal':         return <TopSignalSection section={section} />
    default:                   return null
  }
}

// ── Action rail ───────────────────────────────────────────────────────────────

function ActionBtn({ label, variant = 'secondary', onClick }) {
  const styles = {
    primary:   { background: 'rgba(13,148,136,0.18)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.28)' },
    purple:    { background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.22)' },
    secondary: { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' },
  }
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-[7px] rounded-[9px] text-[12px] font-semibold transition-colors"
      style={styles[variant]}
    >
      {label}
    </button>
  )
}

function relativeTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const hrs = Math.floor(diff / 3_600_000)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(diff / 86_400_000)
  return days === 1 ? 'Yesterday' : `${days}d ago`
}

// ── Main modal ────────────────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {object}   props.brief    — Brief record to display
 * @param {function} props.onClose  — close callback
 */
export default function BriefModal({ brief, onClose }) {
  // Escape key closes
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!brief) return null

  const isNews = brief.type === 'news_digest'

  function comingSoon(label) {
    return () => {
      console.info(`Coming soon: ${label}`)
    }
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 301,
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          background: 'linear-gradient(160deg,rgba(12,15,26,0.99) 0%,rgba(6,8,18,1) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 px-6 py-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="flex-shrink-0 flex items-center justify-center text-xl rounded-[13px]"
                style={{
                  width: 44,
                  height: 44,
                  background: isNews
                    ? 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.12))'
                    : 'linear-gradient(135deg,rgba(13,148,136,0.2),rgba(6,182,212,0.12))',
                  border: isNews ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(45,212,191,0.2)',
                }}
              >
                {isNews ? '📰' : '🧠'}
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(45,212,191,0.65)' }}>
                  {isNews ? 'AI News Digest' : 'Topic Brief'}
                </div>
                <h2 className="text-[18px] font-bold leading-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>
                  {brief.title}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 flex items-center justify-center rounded-[8px] text-base transition-colors"
              style={{
                width: 30, height: 30,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              ✕
            </button>
          </div>

          {/* Meta pills */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {brief.newItemCount > 0 && (
              <span
                className="text-[11px] font-medium px-[9px] py-[3px] rounded-[6px]"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}
              >
                {isNews ? `${brief.newItemCount} stories` : `+${brief.newItemCount} new items`}
              </span>
            )}
            <span
              className="text-[11px] font-medium px-[9px] py-[3px] rounded-[6px]"
              style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}
            >
              {relativeTime(brief.generatedAt)}
            </span>
            {brief.sourceCount > 0 && (
              <span
                className="text-[11px] font-medium px-[9px] py-[3px] rounded-[6px]"
                style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}
              >
                {brief.sourceCount} source{brief.sourceCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {(brief.sections ?? []).map((section, i) => (
            <BriefSection key={i} section={section} />
          ))}
        </div>

        {/* Footer action rail */}
        <div
          className="flex-shrink-0 px-6 py-3.5 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(6,8,18,0.8)' }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Next Steps
          </div>
          <div className="flex flex-wrap gap-2">
            {isNews ? (
              <>
                <ActionBtn label="💾 Save highlights to inbox" variant="primary" onClick={comingSoon('Save highlights')} />
                <ActionBtn label="📋 Create watch rule" variant="secondary" onClick={comingSoon('Create watch rule')} />
                <ActionBtn label="🎓 Turn into learning path" variant="secondary" onClick={comingSoon('Learning path')} />
              </>
            ) : (
              <>
                <ActionBtn label="💾 Save to Topic" variant="primary" onClick={comingSoon('Save to Topic')} />
                <ActionBtn label="⚡ Generate opportunity brief" variant="purple" onClick={comingSoon('Opportunity brief')} />
                <ActionBtn label="🎓 Turn into learning path" variant="secondary" onClick={comingSoon('Learning path')} />
                <ActionBtn label="📋 Create watch rule" variant="secondary" onClick={comingSoon('Create watch rule')} />
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
