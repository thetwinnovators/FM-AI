import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink } from 'lucide-react'

// ── OG image thumbnail ────────────────────────────────────────────────────────
function ArticleThumbnail({ url }) {
  const [imgUrl, setImgUrl] = useState(null)
  const [loaded, setLoaded]  = useState(false)
  const [failed, setFailed]  = useState(false)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setImgUrl(data?.data?.image?.url ?? null) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [url])

  const domain = url ? (() => { try { return new URL(url).hostname } catch { return null } })() : null

  const base = {
    width: 72, height: 50, borderRadius: 8, flexShrink: 0,
    overflow: 'hidden', background: '#f1f5f9',
    border: '1px solid #e2e8f0',
  }

  if (imgUrl && !failed) {
    return (
      <div style={base}>
        {!loaded && <div style={{ width: '100%', height: '100%', background: '#e2e8f0' }} />}
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
        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" style={{ width: 22, height: 22, opacity: 0.55 }} />
      </div>
    )
  }

  return <div style={base} />
}

// ── Shared section label ──────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="text-[12px] font-bold uppercase tracking-widest mb-3" style={{ color: '#94a3b8' }}>
      {children}
    </div>
  )
}

// ── Section renderers (light mode, no dividers) ───────────────────────────────

function OverviewSection({ section }) {
  return (
    <div className="px-7 py-5">
      <SectionLabel>Overview</SectionLabel>
      <p className="text-[15px] leading-relaxed" style={{ color: '#334155' }}>
        {section.content}
      </p>
    </div>
  )
}

const DOT_COLORS = { rising: '#0d9488', shift: '#6366f1', new: '#3b82f6' }

function WhatChangedSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-7 py-5">
      <SectionLabel>What Changed</SectionLabel>
      <div className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: DOT_COLORS[item.dot] ?? '#0d9488', flexShrink: 0, marginTop: 6 }} />
            <p className="text-[15px] leading-snug text-slate-700">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SignalCard({ signal }) {
  const isStrong = signal.strength === 'Strong'
  return (
    <div className="rounded-xl p-3.5" style={{ background: '#eef0f4', border: '1px solid #d8dde6' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="text-[12px] font-bold px-2 py-0.5 rounded-md"
          style={isStrong
            ? { background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4' }
            : { background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' }}
        >
          {signal.strength}
        </span>
        <span className="text-[12px] text-slate-400">{signal.source}</span>
      </div>
      <p className="text-[14px] leading-snug text-slate-700">{signal.text}</p>
    </div>
  )
}

function StrongestSignalsSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-7 py-5">
      <SectionLabel>Strongest Signals</SectionLabel>
      <div className="flex flex-col gap-2">{items.map((s, i) => <SignalCard key={i} signal={s} />)}</div>
    </div>
  )
}

function OpenQuestionsSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-7 py-5">
      <SectionLabel>Open Questions</SectionLabel>
      <div className="flex flex-col gap-2">
        {items.map((q, i) => (
          <div key={i} className="flex items-start gap-2.5 text-[15px] text-slate-600">
            <span className="text-[13px] font-bold flex-shrink-0 pt-px text-slate-300 min-w-[16px]">{i + 1}.</span>
            <span>{q}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RisksSection({ section }) {
  return (
    <div className="px-7 py-5">
      <SectionLabel>Risks &amp; Counterpoints</SectionLabel>
      <div className="rounded-xl p-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
        <p className="text-[15px] leading-relaxed" style={{ color: '#92400e' }}>{section.content}</p>
      </div>
    </div>
  )
}

function HighlightsSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-7 py-5">
      <SectionLabel>Today's Highlights</SectionLabel>
      <div className="flex flex-col gap-4">
        {items.map((item, i) => {
          const text = typeof item === 'string' ? item : item.text
          const url  = typeof item === 'string' ? null  : item.url
          return (
            <div key={i} className="flex items-start gap-3 group">
              <ArticleThumbnail url={url} />
              <div className="flex-1 min-w-0 flex items-start gap-2 pt-0.5">
                <p className="text-[15px] leading-snug flex-1 text-slate-800 font-medium">{text}</p>
                {url && (
                  <a
                    href={url} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Open article" onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={13} className="text-teal-500 hover:text-teal-700 transition-colors" />
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
    <div className="px-7 py-5">
      <SectionLabel>Emerging Themes</SectionLabel>
      <div className="flex flex-col gap-2.5">
        {items.map((theme, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginTop: 7 }} />
            <p className="text-[15px] leading-snug text-slate-600">{theme}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopSignalSection({ section }) {
  return (
    <div className="px-7 py-5">
      <SectionLabel>Strongest Signal</SectionLabel>
      <div className="rounded-xl p-4" style={{ background: '#f0fdfa', border: '1px solid #99f6e4' }}>
        <p className="text-[15px] leading-relaxed font-medium" style={{ color: '#0f766e' }}>{section.content}</p>
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
    primary:   { background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4' },
    purple:    { background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' },
    secondary: { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' },
  }
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-[7px] rounded-[9px] text-[13px] font-semibold transition-colors hover:opacity-80"
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
export default function BriefModal({ brief, onClose, onRefresh, refreshing }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!brief) return null

  const isNews = brief.type === 'news_digest'
  const comingSoon = (label) => () => console.info(`Coming soon: ${label}`)

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)' }}
      />

      {/* Modal — light mode */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 301, width: '100%', maxWidth: 640, maxHeight: '90vh',
          background: '#f4f6f9',
          border: '1px solid #d8dde6',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.08)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-7 py-5" style={{ background: '#eaecf1', borderBottom: '1px solid #d8dde6' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="flex-shrink-0 flex items-center justify-center text-xl rounded-[13px]"
                style={{
                  width: 44, height: 44,
                  background: isNews ? '#ede9fe' : '#ccfbf1',
                  border: isNews ? '1px solid #ddd6fe' : '1px solid #99f6e4',
                }}
              >
                {isNews ? '📰' : '🧠'}
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest mb-1 text-teal-600">
                  {isNews ? 'AI News Digest' : 'Topic Brief'}
                </div>
                <h2 className="text-[20px] font-bold leading-tight text-slate-900">{brief.title}</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 flex items-center justify-center rounded-lg text-sm transition-colors hover:bg-slate-100"
              style={{ width: 30, height: 30, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b' }}
            >
              ✕
            </button>
          </div>

          {/* Meta pills */}
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {brief.newItemCount > 0 && (
              <span className="text-[12px] font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-500">
                {isNews ? `${brief.newItemCount} stories` : `+${brief.newItemCount} new items`}
              </span>
            )}
            <span className="text-[12px] font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-500">
              {relativeTime(brief.generatedAt)}
            </span>
            {brief.sourceCount > 0 && (
              <span className="text-[12px] font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-500">
                {brief.sourceCount} source{brief.sourceCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Body — no dividers, just sections with py-5 spacing */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {(brief.sections ?? []).map((section, i) => (
            <BriefSection key={i} section={section} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-7 py-4" style={{ background: '#eaecf1', borderTop: '1px solid #d8dde6' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-2.5 text-slate-400">Next Steps</div>
          <div className="flex flex-wrap gap-2">
            {isNews ? (
              <>
                <ActionBtn label="💾 Save highlights to inbox" variant="primary" onClick={comingSoon('Save highlights')} />
                <ActionBtn label="📋 Create watch rule"        variant="secondary" onClick={comingSoon('Create watch rule')} />
                <ActionBtn label="🎓 Turn into learning path"  variant="secondary" onClick={comingSoon('Learning path')} />
                {onRefresh && (
                  <ActionBtn
                    label={refreshing ? '⏳ Refreshing…' : '🔄 Refresh digest'}
                    variant="secondary"
                    onClick={() => !refreshing && onRefresh(brief.id)}
                  />
                )}
              </>
            ) : (
              <>
                <ActionBtn label="💾 Save to Topic"               variant="primary"   onClick={comingSoon('Save to Topic')} />
                <ActionBtn label="⚡ Generate opportunity brief"  variant="purple"    onClick={comingSoon('Opportunity brief')} />
                <ActionBtn label="🎓 Turn into learning path"     variant="secondary" onClick={comingSoon('Learning path')} />
                <ActionBtn label="📋 Create watch rule"           variant="secondary" onClick={comingSoon('Create watch rule')} />
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
