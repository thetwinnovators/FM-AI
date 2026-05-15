import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity, Plus, Play, Pin, VolumeX, ChevronDown, ChevronUp,
  X, ExternalLink, AlertTriangle, Video, Bell, Clock, TrendingUp,
  TrendingDown, Minus, Loader2, CheckCircle, BookOpen, RefreshCw,
  Zap, BarChart2, Sparkles, ChevronLeft, ChevronRight,
  LayoutGrid, List,
} from 'lucide-react'
import { localSignalsStorage, hydrateSignalsFromDisk } from '../signals/storage/localSignalsStorage.js'
import { runYoutubeScan, runYoutubeScanFromUserTopics } from '../signals/services/signalDetectionService.js'
import { useStore } from '../store/useStore.js'
import { hasApiKey } from '../signals/services/youtubeSignalsService.js'
import { createAlertSource } from '../signals/services/googleAlertsService.js'
import { generateSummary } from '../lib/llm/ollama.js'

// ─── constants ───────────────────────────────────────────────────────────────

const CATEGORY_META = {
  'rising-keyword':     { label: 'Rising Keyword',      color: '#06b6d4' },
  'repeating-hook':     { label: 'Repeating Hook',      color: '#8b5cf6' },
  'recurring-question': { label: 'Recurring Question',  color: '#6366f1' },
  'entity-spike':       { label: 'Entity Spike',        color: '#f43f5e' },
  'format-trend':       { label: 'Format Trend',        color: '#10b981' },
  'cta-pattern':        { label: 'CTA Pattern',         color: '#f59e0b' },
  'news-mention':       { label: 'News Mention',        color: '#3b82f6' },
}

const PAGE_SIZE = 24

const TIME_FILTERS = [
  { id: '24h', label: '24h',  ms: 24 * 60 * 60 * 1000 },
  { id: '7d',  label: '7d',   ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: '30d',  ms: 30 * 24 * 60 * 60 * 1000 },
]

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtRelative(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── score badge ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#94a3b8'
  return (
    <span
      className="inline-flex items-center justify-center rounded text-[10px] font-bold px-1.5 py-0.5 min-w-[26px]"
      style={{ background: color + '22', color, border: `1px solid ${color}44` }}
    >
      {score}
    </span>
  )
}

// ─── direction icon ───────────────────────────────────────────────────────────

function DirectionIcon({ direction }) {
  if (direction === 'up') return <TrendingUp size={11} className="text-green-400" />
  if (direction === 'down') return <TrendingDown size={11} className="text-red-400" />
  return <Minus size={11} className="text-white/20" />
}

// ─── category chip ────────────────────────────────────────────────────────────

function CategoryChip({ category, small }) {
  const meta = CATEGORY_META[category] ?? { label: category, color: '#94a3b8' }
  return (
    <span className={`inline-flex items-center rounded font-medium bg-white/5 text-white/45 border border-white/8 ${small ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'}`}>
      {meta.label}
    </span>
  )
}

// ─── source chip ─────────────────────────────────────────────────────────────

function SourceChip({ type }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded text-white/30 bg-white/5">
      {type === 'youtube' ? 'YT' : 'Alert'}
    </span>
  )
}

// ─── signal card ─────────────────────────────────────────────────────────────

function SignalCard({ signal, topics, onPin, onMute, onDetail }) {
  const primaryTopic = topics.find((t) => t.id === signal.primaryTopicId)
  if (signal.muted) return null
  return (
    <div
      className="glass-panel p-5 flex flex-col gap-4 cursor-pointer [box-shadow:inset_0_1px_0_rgba(255,255,255,0.06)] hover:[box-shadow:0_8px_40px_rgba(0,0,0,0.45),_inset_0_1px_0_rgba(255,255,255,0.06)] transition-shadow"
      style={{}}
      onClick={() => onDetail(signal)}
    >
      {/* header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white/90 leading-snug line-clamp-2">{signal.title}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ScoreBadge score={signal.score} />
          <DirectionIcon direction={signal.direction} />
        </div>
      </div>

      {/* summary */}
      <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">{signal.summary}</p>

      {/* chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryChip category={signal.category} small />
        <SourceChip type={signal.sourceType} />
        {primaryTopic && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/8">
            {primaryTopic.title}
          </span>
        )}
        {signal.evidence.length > 0 && (
          <span className="text-[10px] text-white/35 ml-auto">{signal.evidence.length} evidence</span>
        )}
      </div>

      {/* footer */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <div className="flex items-center gap-2 text-[10px] text-white/35">
          <Clock size={10} />
          <span>{fmtRelative(signal.lastDetectedAt)}</span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            className={`p-1 rounded transition-colors ${signal.pinned ? 'text-white/70' : 'text-white/30 hover:text-white/60'}`}
            title={signal.pinned ? 'Unpin' : 'Pin'}
            onClick={() => onPin(signal)}
          >
            <Pin size={16} />
          </button>
          <button
            className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
            title="Mute"
            onClick={() => onMute(signal)}
          >
            <VolumeX size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── signal list card ─────────────────────────────────────────────────────────

function SignalListCard({ signal, topics, onPin, onMute, onDetail }) {
  const primaryTopic = topics.find((t) => t.id === signal.primaryTopicId)
  if (signal.muted) return null
  return (
    <div
      className="glass-panel px-4 py-3 flex items-center gap-3 cursor-pointer [box-shadow:inset_0_1px_0_rgba(255,255,255,0.06)] hover:[box-shadow:0_6px_28px_rgba(0,0,0,0.40),_inset_0_1px_0_rgba(255,255,255,0.06)] transition-shadow group"
      onClick={() => onDetail(signal)}
    >
      {/* score + direction */}
      <div className="flex items-center gap-1 shrink-0">
        <ScoreBadge score={signal.score} />
        <DirectionIcon direction={signal.direction} />
      </div>

      {/* title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white/85 truncate max-w-[320px]">{signal.title}</span>
          <CategoryChip category={signal.category} small />
          <SourceChip type={signal.sourceType} />
          {primaryTopic && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/35 border border-white/8 hidden sm:inline">
              {primaryTopic.title}
            </span>
          )}
        </div>
        <p className="text-[11px] text-white/40 mt-0.5 truncate leading-relaxed">{signal.summary}</p>
      </div>

      {/* evidence + time */}
      <div className="flex items-center gap-3 shrink-0 text-[10px] text-white/30">
        {signal.evidence.length > 0 && (
          <span className="hidden md:block">{signal.evidence.length} evidence</span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={9} />
          {fmtRelative(signal.lastDetectedAt)}
        </span>
      </div>

      {/* actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <button
          className={`p-1.5 rounded transition-colors ${signal.pinned ? 'text-white/70' : 'text-white/25 hover:text-white/60'}`}
          title={signal.pinned ? 'Unpin' : 'Pin'}
          onClick={() => onPin(signal)}
        >
          <Pin size={13} />
        </button>
        <button
          className="p-1.5 rounded text-white/25 hover:text-white/60 transition-colors"
          title="Mute"
          onClick={() => onMute(signal)}
        >
          <VolumeX size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ data, color, width = 72, height = 26 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - (v / max) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  // Build a closed fill path: line + down-right + bottom edge + back
  const fillPath = [
    `M ${(0).toFixed(1)},${(height - (data[0] / max) * (height - 4) - 2).toFixed(1)}`,
    ...data.slice(1).map((v, i) => {
      const x = ((i + 1) / (data.length - 1)) * width
      const y = height - (v / max) * (height - 4) - 2
      return `L ${x.toFixed(1)},${y.toFixed(1)}`
    }),
    `L ${width},${height} L 0,${height} Z`,
  ].join(' ')
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.65}
      />
    </svg>
  )
}

function dailyBuckets(signals, days = 7) {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const buckets = Array(days).fill(0)
  for (const s of signals) {
    if (!s.lastDetectedAt) continue
    const age = now - new Date(s.lastDetectedAt).getTime()
    const idx = Math.floor(age / dayMs)
    if (idx >= 0 && idx < days) buckets[days - 1 - idx]++
  }
  return buckets
}

// ─── stat card ────────────────────────────────────────────────────────────────

const STAT_META = [
  { key: 'rising',    label: 'Rising signals',   icon: TrendingUp, color: '#14b8a6', sub: 'Past 7 days' },
  { key: 'new',       label: 'New this week',    icon: Activity,   color: '#6366f1', sub: 'Added since Mon' },
  { key: 'repeating', label: 'Repeating hooks',  icon: RefreshCw,  color: '#8b5cf6', sub: 'Cross-topic patterns' },
  { key: 'sources',   label: 'Sources',          icon: Zap,        color: '#06b6d4', sub: 'Active connections' },
  { key: 'pinned',    label: 'Pinned',           icon: Pin,        color: '#d946ef', sub: 'Saved for review' },
]

function StatStrip({ risingCount, newThisWeek, repeatingHooks, sourcesLen, pinned, signals = [] }) {
  const values = { rising: risingCount, new: newThisWeek, repeating: repeatingHooks, sources: sourcesLen, pinned }

  const sparklines = useMemo(() => ({
    rising:    dailyBuckets(signals.filter((s) => s.direction === 'up')),
    new:       dailyBuckets(signals),
    repeating: dailyBuckets(signals.filter((s) => s.category === 'repeating-hook')),
    sources:   null,
    pinned:    dailyBuckets(signals.filter((s) => s.pinned)),
  }), [signals])

  return (
    <div
      className="glass-panel overflow-hidden border-white/[0.09]"
      style={{
        background: 'linear-gradient(160deg, #0d0f1c 0%, #07090f 100%)',
        boxShadow: 'rgba(0,0,0,0.65) 0px 18px 48px, rgba(0,0,0,0.45) 0px 6px 16px, rgba(255,255,255,0.10) 0px 1px 0px inset',
      }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-[color:var(--color-border-subtle)]">
        {STAT_META.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.key} className="px-6 py-5">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} style={{ color: s.color }} aria-hidden="true" />
                <p className="text-[13px] font-semibold">{s.label}</p>
                <p className="text-[13px] font-semibold ml-auto">{values[s.key]}</p>
              </div>
              <div className="flex items-end justify-between gap-2">
                <p className="text-[10px] text-[color:var(--color-text-tertiary)]">{s.sub}</p>
                {sparklines[s.key] ? (
                  <Sparkline data={sparklines[s.key]} color={s.color} />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── signal detail modal ─────────────────────────────────────────────────────

const LIQUID_GLASS = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.07) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.13)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.05)',
}

function SignalDetailDrawer({ signal, topics, sources, onClose, onPin, onMute }) {
  const [summarizing, setSummarizing] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [summaryErr, setSummaryErr] = useState('')

  useEffect(() => {
    if (!signal) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [signal, onClose])

  if (!signal) return null

  const primaryTopic = topics.find((t) => t.id === signal.primaryTopicId)
  const relatedTopics = topics.filter((t) => signal.relatedTopicIds.includes(t.id))
  const source = sources.find((s) => s.id === signal.sourceId)

  async function handleGenerateSummary() {
    setSummarizing(true)
    setSummaryErr('')
    setSummaryText('')
    try {
      const prompt = `Summarize this signal for a researcher:\n\nTitle: ${signal.title}\nSummary: ${signal.summary}\nEvidence:\n${signal.evidence.map((e) => `- ${e.label}: ${e.snippet ?? ''}`).join('\n')}`
      const result = await generateSummary(prompt)
      if (result) { setSummaryText(result) } else { setSummaryErr('LLM not configured or not responding.') }
    } catch { setSummaryErr('LLM not configured or not responding.') }
    setSummarizing(false)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-[560px] max-h-[88vh] flex flex-col rounded-2xl overflow-hidden"
        style={LIQUID_GLASS}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-white/8">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <CategoryChip category={signal.category} />
              <SourceChip type={signal.sourceType} />
              <div className="ml-auto flex items-center gap-1.5">
                <ScoreBadge score={signal.score} />
                <DirectionIcon direction={signal.direction} />
              </div>
            </div>
            <h2 className="text-base font-semibold text-white/90 leading-snug">{signal.title}</h2>
          </div>
          <button onClick={onClose} className="text-white/35 hover:text-white/70 transition-colors shrink-0 p-1 ml-2">
            <X size={16} />
          </button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          <p className="text-sm text-white/60 leading-relaxed">{signal.summary}</p>

          <div className="text-[10px] text-white/30">
            First detected {fmtDate(signal.firstDetectedAt)} · Last seen {fmtDate(signal.lastDetectedAt)}
          </div>

          {(primaryTopic || relatedTopics.length > 0) && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-2">Topics</div>
              <div className="flex flex-wrap gap-1.5">
                {primaryTopic && (
                  <span className="text-xs px-2 py-0.5 rounded bg-white/8 text-white/60 border border-white/12 font-medium">
                    {primaryTopic.title}
                  </span>
                )}
                {relatedTopics.filter((t) => t.id !== primaryTopic?.id).map((t) => (
                  <span key={t.id} className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40 border border-white/8">
                    {t.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {source && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-2">Source</div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <span>{source.label}</span>
                {source.query && <span className="text-white/30 text-xs">"{source.query}"</span>}
              </div>
            </div>
          )}

          {signal.evidence.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-2">Evidence ({signal.evidence.length})</div>
              <div className="flex flex-col gap-2">
                {signal.evidence.map((ev, i) => (
                  <div key={i} className="rounded-lg bg-white/5 border border-white/8 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-white/70 leading-snug">{ev.label}</span>
                      {ev.url && (
                        <a href={ev.url} target="_blank" rel="noopener noreferrer"
                          className="text-white/25 hover:text-white/60 shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    {ev.snippet && <p className="text-[11px] text-white/40 mt-1 leading-relaxed line-clamp-3">{ev.snippet}</p>}
                    {ev.publishedAt && <div className="text-[10px] text-white/25 mt-1">{fmtDate(ev.publishedAt)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(summaryText || summaryErr) && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-2">AI Summary</div>
              {summaryErr
                ? <p className="text-xs text-amber-400/80 bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">{summaryErr}</p>
                : <p className="text-sm text-white/65 leading-relaxed bg-white/5 rounded-lg p-3 border border-white/8">{summaryText}</p>
              }
            </div>
          )}
        </div>

        {/* footer actions */}
        <div className="px-6 py-4 border-t border-white/8 flex flex-wrap gap-2">
          <button onClick={() => onPin(signal)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${signal.pinned ? 'bg-white/10 text-white/80 border-white/20' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'}`}>
            <Pin size={11} /> {signal.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button onClick={() => onMute(signal)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-colors">
            <VolumeX size={11} /> Mute
          </button>
          <button onClick={handleGenerateSummary} disabled={summarizing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-40 ml-auto">
            {summarizing ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
            Generate summary
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── create topic modal ───────────────────────────────────────────────────────

function CreateTopicModal({ onClose, onSave }) {
  const [title, setTitle] = useState('')
  const [keywords, setKeywords] = useState('')
  const [watchStatus, setWatchStatus] = useState('active')

  function handleSave() {
    if (!title.trim()) return
    const now = new Date().toISOString()
    onSave({
      id: `topic_${uid()}`,
      title: title.trim(),
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
      watchStatus,
      createdAt: now,
      updatedAt: now,
    })
    onClose()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h3 className="text-base font-semibold text-white/90 mb-4">Create topic</h3>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Title *</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="e.g. AI Video Production"
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/60"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Keywords (comma-separated)</label>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. AI video, runway, sora, text to video"
            rows={3}
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/60 resize-none"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Watch status</label>
          <div className="flex gap-2">
            {['active', 'paused'].map((s) => (
              <button
                key={s}
                onClick={() => setWatchStatus(s)}
                className={`flex-1 text-xs py-1.5 rounded-lg border capitalize transition-colors ${watchStatus === s ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-white/5 text-white/50 border-white/15 hover:bg-white/10'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="flex-1 text-sm py-2 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={!title.trim()} className="flex-1 text-sm py-2 rounded-lg bg-purple-500/25 text-purple-200 border border-purple-500/50 hover:bg-purple-500/35 transition-colors disabled:opacity-40">Create</button>
      </div>
    </ModalOverlay>
  )
}

// ─── add source modal ─────────────────────────────────────────────────────────

function AddSourceModal({ topics, onClose, onSave }) {
  const [type, setType] = useState('youtube')
  const [label, setLabel] = useState('')
  const [query, setQuery] = useState('')
  const [selectedTopicIds, setSelectedTopicIds] = useState([])
  const [alertText, setAlertText] = useState('')

  function toggleTopic(id) {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  function handleSave() {
    if (!query.trim()) return
    const now = new Date().toISOString()
    if (type === 'google-alert') {
      onSave(createAlertSource({ query: query.trim(), topicIds: selectedTopicIds, label: label.trim() || query.trim() }))
    } else {
      onSave({
        id: `src_yt_${uid()}`,
        type: 'youtube',
        label: label.trim() || query.trim(),
        query: query.trim(),
        topicIds: selectedTopicIds,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
    }
    onClose()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h3 className="text-base font-semibold text-white/90 mb-4">Add source</h3>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Type</label>
          <div className="flex gap-2">
            {[{ id: 'youtube', label: 'YouTube' }, { id: 'google-alert', label: 'Google Alert' }].map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${type === t.id ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-white/5 text-white/50 border-white/15 hover:bg-white/10'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Friendly name"
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/60"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Query / keyword *</label>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={type === 'youtube' ? 'e.g. AI video generation' : 'e.g. "AI filmmaking"'}
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/60"
          />
        </div>
        {topics.length > 0 && (
          <div>
            <label className="text-xs text-white/50 mb-1 block">Link to topics</label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTopic(t.id)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${selectedTopicIds.includes(t.id) ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}
        {type === 'google-alert' && (
          <div>
            <label className="text-xs text-white/50 mb-1 block">Paste alert email text (optional)</label>
            <textarea
              value={alertText}
              onChange={(e) => setAlertText(e.target.value)}
              placeholder="Paste the body of a Google Alert email here to ingest items immediately..."
              rows={4}
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/60 resize-none"
            />
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="flex-1 text-sm py-2 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-colors">Cancel</button>
        <button
          onClick={() => handleSave()}
          disabled={!query.trim()}
          className="flex-1 text-sm py-2 rounded-lg bg-purple-500/25 text-purple-200 border border-purple-500/50 hover:bg-purple-500/35 transition-colors disabled:opacity-40"
        >
          Add source
        </button>
      </div>
      {/* store alertText for parent to consume via callback */}
      <input type="hidden" data-alert-text={alertText} />
    </ModalOverlay>
  )
}

// ─── modal overlay wrapper ────────────────────────────────────────────────────

function ModalOverlay({ onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden p-6"
        style={LIQUID_GLASS}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Signals() {
  const { userTopics } = useStore()

  const [topics, setTopics] = useState([])
  const [sources, setSources] = useState([])
  const [signals, setSignals] = useState([])
  const [config, setConfig] = useState({ youtubeFrequency: 'manual', alertsFrequency: 'manual' })

  const [timeFilter, setTimeFilter] = useState('7d')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('flowmap.signals.viewMode') ?? 'grid'
  )
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [sourcesOpen, setSourcesOpen] = useState(true)

  const [detailSignal, setDetailSignal] = useState(null)
  const [showCreateTopic, setShowCreateTopic] = useState(false)
  const [showAddSource, setShowAddSource] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisText, setAnalysisText] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)


  // load from storage on mount
  useEffect(() => {
    // Hydrate from disk first so cross-browser changes are picked up on every
    // page visit, then load into local state.
    hydrateSignalsFromDisk().then(() => {
      setTopics(localSignalsStorage.listTopics())
      setSources(localSignalsStorage.listSources())
      setSignals(localSignalsStorage.listSignals())
      setConfig(localSignalsStorage.getConfig())
    })
  }, [])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [timeFilter, categoryFilter])

  // Persist view mode preference
  useEffect(() => { localStorage.setItem('flowmap.signals.viewMode', viewMode) }, [viewMode])

  // ── derived ───────────────────────────────────────────────────────────────

  const timeMs = TIME_FILTERS.find((f) => f.id === timeFilter)?.ms ?? Infinity
  const cutoff = new Date(Date.now() - timeMs)

  const filteredSignals = useMemo(() => {
    return signals
      .filter((s) => !s.muted)
      .filter((s) => new Date(s.lastDetectedAt) >= cutoff)
      .filter((s) => !categoryFilter || s.category === categoryFilter)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  }, [signals, cutoff, categoryFilter])

  const pinnedSignals = filteredSignals.filter((s) => s.pinned)
  const latestSignals = filteredSignals.filter((s) => !s.pinned)

  const pageCount   = Math.ceil(latestSignals.length / PAGE_SIZE)
  const pagedSignals = latestSignals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const thisWeekMs = 7 * 24 * 60 * 60 * 1000
  const newThisWeek = signals.filter((s) => Date.now() - new Date(s.lastDetectedAt).getTime() < thisWeekMs).length
  const repeatingHooks = signals.filter((s) => s.category === 'repeating-hook').length
  const pinned = signals.filter((s) => s.pinned).length
  const risingCount = signals.filter((s) => s.direction === 'up').length

  // ── actions ───────────────────────────────────────────────────────────────

  function handleSaveTopic(topic) {
    localSignalsStorage.saveTopic(topic)
    setTopics(localSignalsStorage.listTopics())
  }

  function handleDeleteTopic(id) {
    localSignalsStorage.deleteTopic(id)
    setTopics(localSignalsStorage.listTopics())
  }

  function handleSaveSource(source) {
    localSignalsStorage.saveSource(source)
    setSources(localSignalsStorage.listSources())
  }

  function handleDeleteSource(id) {
    localSignalsStorage.deleteSource(id)
    setSources(localSignalsStorage.listSources())
  }

  function handlePin(signal) {
    const updated = localSignalsStorage.updateSignal(signal.id, { pinned: !signal.pinned })
    setSignals(localSignalsStorage.listSignals())
    if (detailSignal?.id === signal.id) setDetailSignal(updated)
  }

  function handleMute(signal) {
    localSignalsStorage.updateSignal(signal.id, { muted: true })
    setSignals(localSignalsStorage.listSignals())
    if (detailSignal?.id === signal.id) setDetailSignal(null)
  }

  const handleRunScan = useCallback(async () => {
    if (scanning) return
    setScanning(true)
    setScanMsg('')
    try {
      const storeTopicList = Object.values(userTopics)
      const result = storeTopicList.length > 0
        ? await runYoutubeScanFromUserTopics(storeTopicList)
        : await runYoutubeScan(sources, topics)
      if (result.newSignals.length > 0) {
        localSignalsStorage.saveSignals(result.newSignals)
        setSignals(localSignalsStorage.listSignals())
        setScanMsg(`Found ${result.newSignals.length} new signal${result.newSignals.length > 1 ? 's' : ''}`)
      } else {
        setScanMsg('No new signals found')
      }
      const newConfig = {
        ...config,
        lastYoutubeScan: new Date().toISOString(),
      }
      localSignalsStorage.saveConfig(newConfig)
      setConfig(newConfig)
    } catch (err) {
      setScanMsg(`Scan error: ${err.message}`)
    }
    setScanning(false)
    setTimeout(() => setScanMsg(''), 5000)
  }, [scanning, sources, topics, config, userTopics])

  const handleAnalyze = useCallback(async () => {
    setShowAnalysis(true)
    if (analysisText) return  // already generated — show cached result
    if (signals.length === 0) return
    setAnalysisLoading(true)
    try {
      const top = [...signals]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 20)
      const lines = top.map(
        (s, i) => `${i + 1}. [${s.category}] ${s.title} (score ${s.score ?? '?'}, direction: ${s.direction ?? 'flat'})`
      ).join('\n')
      const prompt =
        `You are a strategic signal analyst for a solo content creator. ` +
        `Below are the top signals recently detected across their tracked topics. ` +
        `Provide a 3–5 sentence strategic interpretation: what patterns are emerging, ` +
        `what opportunities they reveal, and one actionable recommendation. ` +
        `Be concise, direct, and specific to the data.\n\nSIGNALS:\n${lines}\n\nANALYSIS:`
      const result = await generateSummary(prompt, {})
      setAnalysisText(result ?? '')
    } finally {
      setAnalysisLoading(false)
    }
  }, [signals, analysisText])


  // ── empty states ──────────────────────────────────────────────────────────

  const hasTopics = Object.values(userTopics).length > 0
  const hasSources = sources.length > 0
  const hasSignals = signals.length > 0

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 flex flex-col gap-6 min-h-full">

      {/* ── page header ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={20} className="text-[color:var(--color-topic)]" />
              <h1 className="text-xl font-bold text-white/95">Latest Signals</h1>
            </div>
            <p className="text-sm text-white/45">FlowMap monitors emerging patterns across your watched sources</p>
          </div>

          {/* CTA buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasSignals && (
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-colors"
              >
                <BarChart2 size={14} />
                Signal Analysis
              </button>
            )}
            <button
              onClick={handleRunScan}
              disabled={scanning}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/40 hover:bg-teal-500/30 transition-colors disabled:opacity-50"
            >
              {scanning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run scan now
            </button>
          </div>
        </div>

        {/* controls row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* time filter */}
          <div className="flex items-center rounded-lg overflow-hidden border border-white/10">
            {TIME_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setTimeFilter(f.id)}
                className={`text-xs px-3 py-1.5 transition-colors ${timeFilter === f.id ? 'bg-white/15 text-white/90' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* last updated */}
          <div className="flex items-center gap-1.5 text-xs text-white/35 ml-auto">
            <RefreshCw size={11} />
            {config.lastYoutubeScan ? `Last scan: ${fmtRelative(config.lastYoutubeScan)}` : 'Never scanned'}
          </div>

          {/* scan feedback */}
          {scanMsg && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle size={12} /> {scanMsg}
            </span>
          )}
        </div>

        {/* YouTube API key warning */}
        {!hasApiKey() && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            <AlertTriangle size={15} className="shrink-0" />
            <span>YouTube API key not configured — set <code className="bg-white/10 px-1 rounded text-xs">VITE_YOUTUBE_API_KEY</code> to enable scanning</span>
          </div>
        )}
      </div>

      {/* ── overview stat strip ── */}
      {hasSignals && (
        <StatStrip
          risingCount={risingCount}
          newThisWeek={newThisWeek}
          repeatingHooks={repeatingHooks}
          sourcesLen={sources.length}
          pinned={pinned}
          signals={signals}
        />
      )}

      {/* ── two-column body ── */}
      <div className="flex gap-6 items-start min-w-0">

        {/* left: topics sidebar */}
        {hasTopics && (
          <aside className="w-[240px] shrink-0 flex flex-col gap-4">

            <div>
              <div className="mb-2">
                <span className="text-[9px] uppercase tracking-widest font-bold text-white/30">Scanning topics</span>
              </div>
              <div className="flex flex-col gap-1">
                {Object.values(userTopics).map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-[11px] text-white/55 hover:text-white/80 transition-colors cursor-pointer py-0.5 group">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="shrink-0 w-3 h-3 rounded-sm accent-teal-400 cursor-pointer"
                    />
                    <span className="flex-1 truncate">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>

          </aside>
        )}

        {/* right: signals feed */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          {/* empty states */}
          {!hasTopics && (
            <EmptyState icon={BookOpen} title="No topics followed yet"
              description="Go to My Topics and follow topics to start detecting signals." />
          )}
          {hasTopics && !hasSignals && (
            <EmptyState icon={Activity} title="No signals detected yet"
              description="Hit 'Run scan now' to detect emerging patterns from your topics."
              action="Run scan" onAction={handleRunScan} actionLoading={scanning} />
          )}

          {/* latest signals */}
          {hasSignals && (
            <section>
              <div className="flex flex-col gap-1 mb-3">
                <div className="flex items-center gap-2">
                  <Activity size={13} className="text-white/30" aria-hidden="true" />
                  <span className="text-sm font-semibold text-white/80">Latest signals</span>
                  <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{latestSignals.length} results</span>
                  {/* view mode toggle */}
                  <div className="ml-auto flex items-center gap-px bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                    {[
                      { mode: 'grid', Icon: LayoutGrid, title: 'Card view' },
                      { mode: 'list', Icon: List,       title: 'List view' },
                    ].map(({ mode, Icon, title }) => (
                      <button
                        key={mode}
                        title={title}
                        onClick={() => setViewMode(mode)}
                        className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
                          viewMode === mode
                            ? 'bg-white/[0.10] text-white/90'
                            : 'text-white/35 hover:text-white/65'
                        }`}
                      >
                        <Icon size={13} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-0 border-b border-[color:var(--color-border-subtle)] flex-wrap">
                  <button
                    onClick={() => setCategoryFilter('')}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${!categoryFilter ? 'border-[color:var(--color-topic)] text-white' : 'border-transparent text-[color:var(--color-text-tertiary)] hover:text-white'}`}
                  >
                    All
                  </button>
                  {Object.entries(CATEGORY_META).map(([id, meta]) => (
                    <button
                      key={id}
                      onClick={() => setCategoryFilter(id === categoryFilter ? '' : id)}
                      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${categoryFilter === id ? 'border-[color:var(--color-topic)] text-white' : 'border-transparent text-[color:var(--color-text-tertiary)] hover:text-white'}`}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* pinned signals — below the tab row */}
              {pinnedSignals.length > 0 && (
                <div className="mb-5">
                  <SectionHeader title="Pinned" count={pinnedSignals.length} icon={Pin} />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                    {pinnedSignals.map((s) => (
                      <SignalCard key={s.id} signal={s} topics={topics} onPin={handlePin} onMute={handleMute} onDetail={setDetailSignal} />
                    ))}
                  </div>
                </div>
              )}

              {latestSignals.length === 0 ? (
                <p className="text-sm text-white/35 py-4">No signals match the current filters.</p>
              ) : (
                <>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {pagedSignals.map((s, i) => (
                        <div key={s.id} className="fm-fade-up" style={{ '--fm-delay': `${i * 35}ms` }}>
                          <SignalCard signal={s} topics={topics} onPin={handlePin} onMute={handleMute} onDetail={setDetailSignal} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {pagedSignals.map((s, i) => (
                        <div key={s.id} className="fm-fade-up" style={{ '--fm-delay': `${i * 35}ms` }}>
                          <SignalListCard
                            signal={s}
                            topics={topics}
                            onPin={handlePin}
                            onMute={handleMute}
                            onDetail={setDetailSignal}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {pageCount > 1 && (
                    <Pagination
                      page={page}
                      pageCount={pageCount}
                      total={latestSignals.length}
                      pageSize={PAGE_SIZE}
                      onChange={setPage}
                    />
                  )}
                </>
              )}
            </section>
          )}

        </div>

      </div>

      {/* ── modals ── */}
      {showCreateTopic && (
        <CreateTopicModal onClose={() => setShowCreateTopic(false)} onSave={handleSaveTopic} />
      )}
      {showAddSource && (
        <AddSourceModal
          topics={topics}
          onClose={() => setShowAddSource(false)}
          onSave={handleSaveSource}
        />
      )}

      {/* ── analysis drawer ── */}
      {showAnalysis && (
        <SignalAnalysisDrawer
          signals={signals}
          loading={analysisLoading}
          analysisText={analysisText}
          onClose={() => setShowAnalysis(false)}
          onRefresh={() => { setAnalysisText(''); handleAnalyze() }}
        />
      )}

      {/* ── detail drawer ── */}
      {detailSignal && (
        <SignalDetailDrawer
          signal={detailSignal}
          topics={topics}
          sources={sources}
          onClose={() => setDetailSignal(null)}
          onPin={handlePin}
          onMute={handleMute}
          onUpdate={(updated) => {
            setSignals(localSignalsStorage.listSignals())
            setDetailSignal(updated)
          }}
        />
      )}
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description, action, onAction, actionLoading }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
        <Icon size={20} className="text-white/30" />
      </div>
      <div>
        <div className="text-sm font-semibold text-white/60">{title}</div>
        <div className="text-xs text-white/35 mt-1 max-w-xs">{description}</div>
      </div>
      {action && (
        <button
          onClick={onAction}
          disabled={actionLoading}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
        >
          {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {action}
        </button>
      )}
    </div>
  )
}

function Pagination({ page, pageCount, total, pageSize, onChange }) {
  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  // Build page number list with ellipsis
  function pages() {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
    const result = []
    result.push(1)
    if (page > 3) result.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(pageCount - 1, page + 1); i++) result.push(i)
    if (page < pageCount - 2) result.push('…')
    result.push(pageCount)
    return result
  }

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
      <span className="text-[11px] text-white/30">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="flex items-center justify-center w-7 h-7 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-25 disabled:pointer-events-none"
        >
          <ChevronLeft size={13} />
        </button>
        {pages().map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="w-7 text-center text-[11px] text-white/25">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-7 h-7 rounded-lg text-[11px] font-medium border transition-colors ${
                p === page
                  ? 'bg-[color:var(--color-topic)]/20 border-[color:var(--color-topic)]/40 text-white'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/45 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === pageCount}
          className="flex items-center justify-center w-7 h-7 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-25 disabled:pointer-events-none"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}

function SectionHeader({ title, count, icon: Icon }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={13} className="text-white/30" />
      <span className="text-sm font-semibold text-white/80">{title}</span>
      {count != null && (
        <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{count}</span>
      )}
    </div>
  )
}

// ─── signal analysis drawer ───────────────────────────────────────────────────

function SignalAnalysisDrawer({ signals, loading, analysisText, onClose, onRefresh }) {
  const total = signals.length

  // Category breakdown
  const byCat = {}
  for (const s of signals) {
    byCat[s.category] = (byCat[s.category] ?? 0) + 1
  }
  const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1])

  // Direction breakdown
  const up   = signals.filter((s) => s.direction === 'up').length
  const down = signals.filter((s) => s.direction === 'down').length
  const flat = signals.filter((s) => !s.direction || s.direction === 'flat').length

  // Top 5 by score
  const top5 = [...signals].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5)

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* panel */}
      <div className="w-[420px] h-full bg-[#0e1017] border-l border-white/[0.08] flex flex-col overflow-hidden shadow-2xl">

        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-2.5">
            <BarChart2 size={16} className="text-purple-400" />
            <span className="text-sm font-semibold text-white/90">Signal Analysis</span>
            <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{total} signals</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="text-[11px] text-white/40 hover:text-white/80 transition-colors flex items-center gap-1 disabled:opacity-40"
              title="Re-run AI analysis"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              Refresh AI
            </button>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors p-1">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">

          {/* AI Interpretation */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={11} className="text-purple-400" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-white/35">AI Interpretation</span>
            </div>
            <div className="rounded-xl bg-purple-500/[0.07] border border-purple-500/20 px-4 py-3.5 text-[12.5px] leading-relaxed text-white/70 min-h-[64px] flex items-start">
              {loading ? (
                <span className="flex items-center gap-2 text-white/35">
                  <Loader2 size={12} className="animate-spin" /> Generating analysis…
                </span>
              ) : analysisText ? (
                analysisText
              ) : (
                <span className="text-white/25 italic">AI analysis requires Ollama running locally. Pattern stats are shown below.</span>
              )}
            </div>
          </div>

          {/* Direction breakdown */}
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/35 block mb-2.5">Trend Direction</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Rising', count: up,   color: '#22c55e', Icon: TrendingUp   },
                { label: 'Falling', count: down, color: '#f43f5e', Icon: TrendingDown },
                { label: 'Flat',    count: flat, color: '#64748b', Icon: Minus        },
              ].map(({ label, count, color, Icon: DirIcon }) => (
                <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 flex flex-col gap-1">
                  <DirIcon size={13} style={{ color }} />
                  <span className="text-lg font-bold text-white/90" style={{ color }}>{count}</span>
                  <span className="text-[10px] text-white/35">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category breakdown */}
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/35 block mb-2.5">By Category</span>
            <div className="flex flex-col gap-2">
              {catEntries.map(([cat, count]) => {
                const meta = CATEGORY_META[cat] ?? { label: cat, color: '#94a3b8' }
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-white/60">{meta.label}</span>
                      <span className="text-[11px] text-white/40">{count} <span className="text-white/25">({pct}%)</span></span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top signals */}
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/35 block mb-2.5">Highest Scored</span>
            <div className="flex flex-col gap-1.5">
              {top5.map((s, i) => {
                const meta = CATEGORY_META[s.category] ?? { label: s.category, color: '#94a3b8' }
                return (
                  <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <span className="text-[10px] text-white/25 w-4 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-white/80 truncate">{s.title}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: meta.color }}>{meta.label}</div>
                    </div>
                    <ScoreBadge score={s.score ?? 0} />
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  )
}

function SourceRow({ source, topics, config, onDelete }) {
  const linkedTopics = topics.filter((t) => source.topicIds.includes(t.id))
  const lastScan = source.type === 'youtube' ? config.lastYoutubeScan : config.lastAlertsScan
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-white/3 border border-white/8 hover:bg-white/5 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${source.active ? 'bg-green-400' : 'bg-white/20'}`} />
          <span className="text-xs font-medium text-white/70 truncate">{source.label}</span>
          <span className="text-[10px] text-white/30 truncate hidden sm:block">"{source.query}"</span>
        </div>
        {linkedTopics.length > 0 && (
          <div className="flex gap-1 mt-1 ml-3.5">
            {linkedTopics.slice(0, 3).map((t) => (
              <span key={t.id} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400/70 border border-purple-500/20">
                {t.title}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {lastScan && (
          <span className="text-[10px] text-white/25 hidden md:block">{fmtRelative(lastScan)}</span>
        )}
        <button
          onClick={() => onDelete(source.id)}
          className="text-white/20 hover:text-red-400 transition-colors p-1"
          title="Remove source"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
