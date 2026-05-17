/**
 * KnowledgeOverview — "Overview" tab on the Knowledge Base page.
 * Design language: glass-panel, SparkArc KPI cards, chip labels, Pill values,
 * fm-fade-up stagger. Hero 7-day multi-series line chart at the top.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  BookmarkCheck, Brain, FileText, MessageCircle,
  Play, RefreshCw, Search, TrendingUp, Zap, Cpu,
} from 'lucide-react'
import Pill from '../ui/Pill.jsx'
import { useStore, pullSyncedState, subscribeSyncStatus, syncState } from '../../store/useStore.js'
import { useSeed } from '../../store/useSeed.js'
import { loadSignals } from '../../opportunity-radar/storage/radarStorage.js'
import { OLLAMA_CONFIG, setOllamaModel, setOllamaEnabled, getTokenUsage, getTokenHistory, get7DayUsage } from '../../lib/llm/ollamaConfig.js'

// ─── design tokens (mirror index.css) ────────────────────────────────────────

// Hex mirrors of the CSS tokens in index.css — used where CSS vars aren't
// valid (SVG presentation attributes). Keep in sync with @theme definitions.
const C = {
  topic:       '#d946ef',  // --color-topic
  video:       '#ec4899',  // --color-video
  article:     '#6366f1',  // --color-article
  social_post: '#8b5cf6',  // --color-social-post
  url:         '#14b8a6',  // --color-creator (teal)
  memory:      '#a855f7',  // --color-memory
  signal:      '#f43f5e',  // --color-signal
  tool:        '#06b6d4',  // --color-tool
  pdf:         '#14b8a6',  // teal — documents / PDFs
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

/** Build 7 day-buckets, oldest first. Used by mini charts. */
function buildDayBuckets() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    const label = i === 6 ? 'Today' : i === 5 ? 'Yest'
      : d.toLocaleDateString('en-US', { weekday: 'short' })
    return { label, start: d.getTime(), end: d.getTime() + 86_400_000, count: 0 }
  })
}

/** Build 30 daily buckets for the hero chart, oldest first.
 *  Slots are aligned to local midnight so each bucket is one full calendar day. */
function build24hBuckets() {
  const DAY_MS = 24 * 3600_000
  const now    = new Date()
  // Snap to today's local midnight
  const today  = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todayStart = today.getTime()

  return Array.from({ length: 30 }, (_, i) => {
    const start  = todayStart - (29 - i) * DAY_MS
    const d      = new Date(start)
    const isLast = i === 29

    // Label every 7 days + the last slot ("Today")
    const showLabel = i === 0 || (i % 7 === 0 && i < 27) || isLast
    const dayLabel  = isLast
      ? 'Today'
      : showLabel
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null
    const tipLabel  = isLast
      ? 'Today'
      : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    return { dayLabel, hourLabel: null, tipLabel, isDayStart: true, start, end: start + DAY_MS, count: 0 }
  })
}

/** Scan all ingest sources and return the earliest timestamp in ms, or null. */
function findEarliestTimestamp(saves, manualContent, memoryEntries) {
  const ts = [
    ...Object.values(saves         || {}).map((s) => s?.savedAt),
    ...Object.values(manualContent || {}).map((m) => m?.savedAt),
    ...Object.values(memoryEntries || {}).map((m) => m?.addedAt),
  ]
    .filter(Boolean)
    .map((iso) => new Date(iso).getTime())
    .filter((n) => !isNaN(n))
  return ts.length ? Math.min(...ts) : null
}

/**
 * Build daily (≤ 120 days) or weekly (> 120 days) buckets from `startMs` to now.
 * Buckets are snapped to local midnight; the last bucket always covers today.
 */
function buildRangeBuckets(startMs) {
  const DAY_MS  = 86_400_000
  const WEEK_MS = 7 * DAY_MS

  // Snap start to local midnight
  const s0 = new Date(startMs)
  s0.setHours(0, 0, 0, 0)
  const snapStart = s0.getTime()

  // Snap end to start of tomorrow so today is fully included
  const eod = new Date()
  eod.setHours(0, 0, 0, 0)
  eod.setDate(eod.getDate() + 1)
  const snapEnd = eod.getTime()

  const totalDays = Math.ceil((snapEnd - snapStart) / DAY_MS)
  const useWeekly = totalDays > 120
  const bucketMs  = useWeekly ? WEEK_MS : DAY_MS
  const count     = Math.max(2, Math.ceil((snapEnd - snapStart) / bucketMs))

  // Show at most ~8 X-axis labels
  const labelEvery = Math.max(1, Math.ceil(count / 8))

  return Array.from({ length: count }, (_, i) => {
    const start  = snapStart + i * bucketMs
    const end    = start + bucketMs
    const d      = new Date(start)
    const isLast = i === count - 1

    const showLabel = i === 0 || i % labelEvery === 0 || isLast
    const dayLabel  = isLast
      ? 'Today'
      : showLabel
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null
    const tipLabel  = isLast
      ? 'Today'
      : useWeekly
        ? `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    return { dayLabel, hourLabel: null, tipLabel, isDayStart: true, start, end, count: 0 }
  })
}

/** Count ISO timestamps (full or YYYY-MM-DD) into pre-built day buckets. */
function fillBuckets(baseBuckets, timestamps) {
  const slots = baseBuckets.map((b) => ({ ...b, count: 0 }))
  for (const iso of timestamps) {
    if (!iso) continue
    const t = new Date(iso).getTime()
    for (const s of slots) {
      if (t >= s.start && t < s.end) { s.count++; break }
    }
  }
  return slots
}

// ─── SparkArc (matches KpiRow.jsx) ────────────────────────────────────────────

function SparkArc({ pct, color, delay = 0 }) {
  const r    = 30
  const circ = 2 * Math.PI * r
  const arc  = circ * 0.75
  const fill = arc * Math.min(1, Math.max(0, pct))
  const gid  = `kbo-${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg width="68" height="68" viewBox="0 0 68 68"
      className="absolute -bottom-3 -right-3 pointer-events-none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity=".2" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeOpacity=".12"
        strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${arc} ${circ}`} transform="rotate(135 34 34)" />
      <circle cx="34" cy="34" r={r} fill="none" stroke={`url(#${gid})`}
        strokeWidth="5.5" strokeLinecap="round"
        strokeDasharray={`0 ${circ}`} transform="rotate(135 34 34)">
        <animate attributeName="stroke-dasharray"
          from={`0 ${circ}`} to={`${fill} ${circ}`}
          dur=".85s" begin={`${delay}s`} fill="freeze"
          calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
      </circle>
    </svg>
  )
}

// ─── KPI stat card ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, value, label, sub, color, spark, delay = 0 }) {
  return (
    <div className="glass-panel px-4 py-3.5 text-left relative overflow-hidden flex-1 min-w-[120px]">
      <SparkArc pct={spark} color={color} delay={delay} />
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} style={{ color }} />
        <span className="text-[11px] text-[color:var(--color-text-tertiary)]">{label}</span>
      </div>
      <div className="text-[22px] font-bold tracking-tight tabular-nums">{value}</div>
      {sub && <p className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ title, sub }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      {sub && <span className="text-[10px] text-[color:var(--color-text-tertiary)]">{sub}</span>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO: 7-day multi-series line chart
// ═══════════════════════════════════════════════════════════════════════════════

// SVG coordinate space
const VB_W  = 680
const VB_H  = 150
const PAD   = { l: 28, r: 8, t: 10, b: 30 }
const PLOT_W = VB_W - PAD.l - PAD.r   // 644
const PLOT_H = VB_H - PAD.t - PAD.b   // 110

const SERIES = [
  { key: 'video',       label: 'Videos',   color: C.video       },
  { key: 'article',     label: 'Articles', color: C.article     },
  { key: 'social_post', label: 'Posts',    color: C.social_post },
  { key: 'pdf',         label: 'Docs',     color: C.pdf         },
  { key: 'url',         label: 'URLs',     color: C.url         },
  { key: 'memory',      label: 'Memory',   color: C.memory      },
]

/** Map a bucket array to SVG [x, y] pairs scaled by `peak`. */
function toPoints(buckets, peak) {
  const step = PLOT_W / (buckets.length - 1)
  return buckets.map((b, i) => [
    PAD.l + i * step,
    PAD.t + PLOT_H - (peak > 0 ? (b.count / peak) * PLOT_H : 0),
  ])
}

/** Smooth cubic-bezier path through [x,y] points. */
function smoothLine(pts) {
  if (!pts.length) return ''
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1][0] + pts[i][0]) / 2
    d += ` C ${cpx} ${pts[i - 1][1]}, ${cpx} ${pts[i][1]}, ${pts[i][0]} ${pts[i][1]}`
  }
  return d
}

/** Closed area shape (line + baseline) for gradient fill. */
function areaShape(pts) {
  if (!pts.length) return ''
  const base = PAD.t + PLOT_H
  return `${smoothLine(pts)} L ${pts[pts.length - 1][0]} ${base} L ${pts[0][0]} ${base} Z`
}

/** Convert per-day delta buckets into cumulative running totals. */
function toCumulative(buckets) {
  let running = 0
  return buckets.map((b) => ({ ...b, count: (running += b.count) }))
}

const RANGE_PRESETS = [
  { days: 7,    label: '7d'  },
  { days: 30,   label: '30d' },
  { days: 90,   label: '90d' },
  { days: null, label: 'All' },
]

function KnowledgeGrowthChart({ saves, manualContent, memoryEntries }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [tip,        setTip       ] = useState({ x: 0, y: 0, pct: 0 })
  const [rangeDays,  setRangeDays ] = useState(30)  // 7 | 30 | 90 | null=all-time
  // Force SVG remount on every component mount so SMIL animations replay on
  // every page visit — including tab-switches that keep the component alive.
  const [mountKey, setMountKey] = useState(0)
  useEffect(() => { setMountKey((k) => k + 1) }, [])

  // Also remount the SVG whenever the range changes so animations replay
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setMountKey((k) => k + 1) }, [rangeDays])

  const { deltaBuckets, cumBuckets, baseMeta, activeSeries, peak, totalCount, rangeStartMs } = useMemo(() => {
    // Resolve range start
    const DAY_MS      = 86_400_000
    const earliestTs  = findEarliestTimestamp(saves, manualContent, memoryEntries)
    const rangeStartMs = rangeDays != null
      ? Date.now() - rangeDays * DAY_MS
      : (earliestTs ?? Date.now() - 30 * DAY_MS)

    const base = buildRangeBuckets(rangeStartMs)

    const deltaBuckets = {
      video:       fillBuckets(base, Object.values(saves)
        .filter((s) => s?.item?.type === 'video').map((s) => s?.savedAt)),
      article:     fillBuckets(base, Object.values(saves)
        .filter((s) => s?.item?.type === 'article').map((s) => s?.savedAt)),
      social_post: fillBuckets(base, Object.values(saves)
        .filter((s) => s?.item?.type === 'social_post').map((s) => s?.savedAt)),
      pdf:         fillBuckets(base, Object.values(saves)
        .filter((s) => s?.item?.type === 'pdf').map((s) => s?.savedAt)),
      url:         fillBuckets(base, Object.values(manualContent || {}).map((m) => m?.savedAt)),
      memory:      fillBuckets(base, Object.values(memoryEntries || {}).map((m) => m?.addedAt)),
    }

    const allDelta   = Object.values(deltaBuckets).flatMap((bs) => bs.map((b) => b.count))
    const totalCount = allDelta.reduce((a, b) => a + b, 0)
    const activeSeries = SERIES.filter((s) => deltaBuckets[s.key].some((b) => b.count > 0))

    const cumBuckets = Object.fromEntries(
      Object.entries(deltaBuckets).map(([k, v]) => [k, toCumulative(v)])
    )
    const allCum = Object.values(cumBuckets).flatMap((bs) => bs.map((b) => b.count))
    const peak   = Math.max(1, ...allCum)

    return { deltaBuckets, cumBuckets, baseMeta: base, activeSeries, peak, totalCount, rangeStartMs }
  }, [saves, manualContent, memoryEntries, rangeDays])

  const N       = baseMeta.length - 1   // 27 intervals across 28 slots
  const isEmpty = totalCount === 0
  const yTicks  = [peak, Math.round(peak / 2), 0].filter((v, i, a) => a.indexOf(v) === i && v >= 0)

  function handleMouseMove(e) {
    const rect  = e.currentTarget.getBoundingClientRect()
    const scaleX = VB_W / rect.width
    const svgX  = (e.clientX - rect.left) * scaleX
    const idx   = Math.max(0, Math.min(N, Math.round((svgX - PAD.l) / (PLOT_W / N))))
    setHoveredIdx(idx)
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, pct: (e.clientX - rect.left) / rect.width })
  }

  return (
    <div
      className="glass-panel p-5 fm-fade-up overflow-hidden border-white/[0.09]"
      style={{ '--fm-delay': '0ms', background: 'linear-gradient(160deg, #0d0f1c 0%, #07090f 100%)' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-[13px] font-semibold">Knowledge growth</h2>
          <p className="text-[10px] text-[color:var(--color-text-tertiary)] mt-0.5">
            {rangeDays != null
              ? `Cumulative ingest · daily · last ${rangeDays} days`
              : `Cumulative ingest · all time · since ${new Date(rangeStartMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Range picker */}
          <div className="flex items-center gap-0.5 rounded-lg p-0.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {RANGE_PRESETS.map(({ days, label }) => (
              <button
                key={label}
                onClick={() => setRangeDays(days)}
                className="text-[10px] px-2.5 py-[3px] rounded-md transition-colors font-medium"
                style={
                  rangeDays === days
                    ? { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.90)' }
                    : { color: 'rgba(255,255,255,0.30)' }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* Legend + count */}
          <div className="flex items-center gap-3 flex-wrap">
            {(activeSeries.length > 0 ? activeSeries : SERIES.slice(0, 3)).map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-[color:var(--color-text-secondary)]">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
            {totalCount > 0 && <Pill tone="neutral">{totalCount} ingested</Pill>}
          </div>
        </div>
      </div>

      {/* Chart wrapper — relative container for tooltip */}
      <div className="relative">
        <svg
          key={mountKey}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          aria-label={rangeDays != null ? `Knowledge growth over the last ${rangeDays} days` : 'Knowledge growth all time'}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.key} id={`kg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={s.color} stopOpacity=".30" />
                <stop offset="35%"  stopColor={s.color} stopOpacity=".14" />
                <stop offset="75%"  stopColor={s.color} stopOpacity=".04" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
            <clipPath id="kg-reveal">
              <rect x={PAD.l} y={0} width={PLOT_W} height={VB_H}>
                <animate attributeName="width" from="0" to={PLOT_W}
                  dur="1.4s" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" />
              </rect>
            </clipPath>
          </defs>

          {/* Vertical grid lines — solid at labeled day marks, subtle dashed for every other day */}
          {baseMeta.map((slot, i) => {
            const x = PAD.l + i * (PLOT_W / N)
            return slot.dayLabel ? (
              <line key={i} x1={x} y1={PAD.t} x2={x} y2={PAD.t + PLOT_H}
                stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
            ) : (
              <line key={i} x1={x} y1={PAD.t} x2={x} y2={PAD.t + PLOT_H}
                stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="2 4" />
            )
          })}

          {/* Horizontal grid lines + Y labels */}
          {yTicks.map((tick) => {
            const y = PAD.t + PLOT_H * (1 - tick / peak)
            return (
              <g key={tick}>
                <line x1={PAD.l} y1={y} x2={PAD.l + PLOT_W} y2={y}
                  stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <text x={PAD.l - 4} y={y + 3.5} textAnchor="end"
                  fontSize="4.5" fill="rgba(255,255,255,0.28)">
                  {tick}
                </text>
              </g>
            )
          })}

          {/* Baseline */}
          <line x1={PAD.l} y1={PAD.t + PLOT_H} x2={PAD.l + PLOT_W} y2={PAD.t + PLOT_H}
            stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

          {/* Empty state dashed baseline */}
          {isEmpty && (
            <line x1={PAD.l} y1={PAD.t + PLOT_H} x2={PAD.l + PLOT_W} y2={PAD.t + PLOT_H}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" strokeDasharray="4 4" />
          )}

          {/* Per-series fills + dots — revealed by sliding clipPath */}
          <g clipPath="url(#kg-reveal)">
            {activeSeries.map((s) => {
              const pts = toPoints(cumBuckets[s.key], peak)
              return (
                <g key={s.key}>
                  <path d={areaShape(pts)} fill={`url(#kg-${s.key})`} />
                  {pts.map(([x, y], i) =>
                    deltaBuckets[s.key][i].count > 0 ? (
                      <g key={i}>
                        <circle cx={x} cy={y} r="4" fill={s.color} fillOpacity=".18" />
                        <circle cx={x} cy={y} r="2.2" fill={s.color} />
                      </g>
                    ) : null
                  )}
                </g>
              )
            })}
          </g>

          {/* Per-series lines — drawn via stroke-dashoffset so each line
              traces itself along its curve shape rather than being revealed
              by a sliding window. pathLength="1" normalises the dash values
              so we never need to compute the actual pixel path length. */}
          {activeSeries.map((s) => {
            const pts = toPoints(cumBuckets[s.key], peak)
            const d   = smoothLine(pts)
            return (
              <g key={s.key}>
                {/* Glow pass */}
                <path d={d} fill="none"
                  stroke={s.color} strokeWidth="1.5" strokeOpacity=".18"
                  strokeLinecap="round" strokeLinejoin="round"
                  pathLength="1" strokeDasharray="1" strokeDashoffset="1">
                  <animate attributeName="stroke-dashoffset"
                    from="1" to="0" dur="1.4s"
                    calcMode="spline" keyTimes="0;1" keySplines="0.25 0.46 0.45 0.94"
                    fill="freeze" />
                </path>
                {/* Crisp pass */}
                <path d={d} fill="none"
                  stroke={s.color} strokeWidth="0.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  pathLength="1" strokeDasharray="1" strokeDashoffset="1">
                  <animate attributeName="stroke-dashoffset"
                    from="1" to="0" dur="1.4s"
                    calcMode="spline" keyTimes="0;1" keySplines="0.25 0.46 0.45 0.94"
                    fill="freeze" />
                </path>
              </g>
            )
          })}

          {/* Hover vertical rule */}
          {hoveredIdx !== null && (() => {
            const hx = PAD.l + hoveredIdx * (PLOT_W / N)
            return (
              <line x1={hx} y1={PAD.t} x2={hx} y2={PAD.t + PLOT_H}
                stroke="rgba(255,255,255,0.16)" strokeWidth="1" strokeDasharray="3 3" />
            )
          })()}

          {/* Hover dots — all active series at hovered slot */}
          {hoveredIdx !== null && activeSeries.map((s) => {
            const cumCount = cumBuckets[s.key][hoveredIdx]?.count ?? 0
            if (!cumCount) return null
            const hx = PAD.l + hoveredIdx * (PLOT_W / N)
            const hy = PAD.t + PLOT_H - (cumCount / peak) * PLOT_H
            return (
              <g key={s.key}>
                <circle cx={hx} cy={hy} r="7" fill={s.color} fillOpacity=".18" />
                <circle cx={hx} cy={hy} r="3.5" fill={s.color} />
                <circle cx={hx} cy={hy} r="1.4" fill="white" fillOpacity=".9" />
              </g>
            )
          })}

          {/* X-axis: day labels at midnight (bottom row) + hour marks above them */}
          {baseMeta.map((slot, i) => {
            const x = PAD.l + i * (PLOT_W / N)
            if (slot.dayLabel) return (
              <g key={i}>
                <line x1={x} y1={PAD.t + PLOT_H} x2={x} y2={PAD.t + PLOT_H + 5}
                  stroke="rgba(255,255,255,0.30)" strokeWidth="0.8" />
                <text x={x} y={VB_H - 4} textAnchor="middle" fontSize="4.5"
                  fill={hoveredIdx === i ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.65)'}>
                  {slot.dayLabel}
                </text>
              </g>
            )
            if (slot.hourLabel) return (
              <g key={i}>
                <line x1={x} y1={PAD.t + PLOT_H} x2={x} y2={PAD.t + PLOT_H + 3}
                  stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
                <text x={x} y={VB_H - 4} textAnchor="middle" fontSize="4.5"
                  fill={hoveredIdx === i ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.38)'}>
                  {slot.hourLabel}
                </text>
              </g>
            )
            return null
          })}

          {isEmpty && (
            <text x={PAD.l + PLOT_W / 2} y={PAD.t + PLOT_H / 2}
              textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.20)">
              No ingest activity in the last 30 days
            </text>
          )}
        </svg>

        {/* Tooltip */}
        {hoveredIdx !== null && activeSeries.length > 0 && (
          <div
            className="absolute pointer-events-none z-20 min-w-[148px]"
            style={{
              left: tip.pct > 0.62 ? tip.x - 160 : tip.x + 14,
              top:  Math.max(4, tip.y - 14),
            }}
          >
            <div className="rounded-xl border border-white/[0.1] px-3 py-2.5 shadow-2xl space-y-1.5"
              style={{ background: 'rgba(10,12,22,0.96)', backdropFilter: 'blur(14px)' }}>
              <p className="text-[10px] font-semibold text-white/40 tracking-wide uppercase mb-2">
                {baseMeta[hoveredIdx]?.tipLabel}
              </p>
              {activeSeries.map((s) => {
                const cum   = cumBuckets[s.key][hoveredIdx]?.count   ?? 0
                const delta = deltaBuckets[s.key][hoveredIdx]?.count ?? 0
                return (
                  <div key={s.key} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-white/55 flex-1">{s.label}</span>
                    <span className="tabular-nums font-medium text-white/90">{cum}</span>
                    {delta > 0 && (
                      <span className="text-[10px] font-medium tabular-nums" style={{ color: s.color }}>
                        +{delta}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Recent captures ──────────────────────────────────────────────────────────

const ITEM_CHIP = { video: 'VIDEO', article: 'ARTICLE', social_post: 'POST' }
const ITEM_ICON = { video: Play, article: FileText, social_post: MessageCircle }
const ITEM_CLR  = { video: C.video, article: C.article, social_post: C.social_post }

function RecentCaptures({ saves, contentById }) {
  const rows = useMemo(() =>
    Object.entries(saves)
      .filter(([, s]) => s?.savedAt)
      .sort(([, a], [, b]) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, 7)
      .map(([id, s]) => ({ item: s.item || contentById(id), savedAt: s.savedAt }))
      .filter((r) => r.item),
    [saves, contentById],
  )

  if (!rows.length) return (
    <p className="text-[13px] text-[color:var(--color-text-tertiary)] py-2">
      Nothing saved yet — bookmark items from Discover or Topics.
    </p>
  )

  return (
    <ul>
      {rows.map(({ item, savedAt }) => {
        const Icon  = ITEM_ICON[item.type] ?? FileText
        const color = ITEM_CLR[item.type]
        return (
          <li key={item.id}
            className="flex items-center gap-3 py-2.5 border-t border-[color:var(--color-border-subtle)] first:border-t-0">
            <Icon size={11} className="flex-shrink-0" style={{ color }} />
            <span className="chip text-[10px]">{ITEM_CHIP[item.type] ?? 'ITEM'}</span>
            <span className="text-[13px] leading-snug line-clamp-1 flex-1 min-w-0">{item.title}</span>
            <Pill tone="neutral">{timeAgo(savedAt)}</Pill>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Signal pulse ─────────────────────────────────────────────────────────────

const SIG_TONE  = { reddit: 'warning', hackernews: 'accent', youtube: 'danger' }
// Source-specific tint dots — Reddit orange, HN amber, YouTube signal red
const SIG_COLOR = { reddit: '#f97316', hackernews: '#f59e0b', youtube: C.signal }

function SignalPulse({ signals }) {
  if (!signals.length) return (
    <p className="text-[13px] text-[color:var(--color-text-tertiary)] py-2">
      No signals yet — run a scan from Opportunity Radar.
    </p>
  )

  return (
    <ul>
      {[...signals].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).slice(0, 6).map((s) => (
        <li key={s.id}
          className="flex items-start gap-3 py-2.5 border-t border-[color:var(--color-border-subtle)] first:border-t-0">
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-[5px]"
            style={{ background: SIG_COLOR[s.source] ?? 'rgba(255,255,255,0.3)',
              opacity: 0.4 + (s.intensityScore / 10) * 0.6 }} />
          <span className="chip text-[10px] flex-shrink-0">{s.source.toUpperCase()}</span>
          <p className="text-[12px] leading-snug line-clamp-1 text-[color:var(--color-text-secondary)] flex-1 min-w-0">
            {s.painText.length > 80 ? `${s.painText.slice(0, 80)}…` : s.painText}
          </p>
          <Pill tone={SIG_TONE[s.source] ?? 'neutral'}>{timeAgo(s.detectedAt)}</Pill>
        </li>
      ))}
    </ul>
  )
}

// ─── Content mix ──────────────────────────────────────────────────────────────

const MIX = [
  { key: 'video',       label: 'Videos',   color: C.video       },
  { key: 'article',     label: 'Articles', color: C.article     },
  { key: 'social_post', label: 'Posts',    color: C.social_post },
  { key: 'pdf',         label: 'Docs',     color: C.pdf         },
]

// Mini chart constants (shared by ContentMix line chart)
const VB2_W  = 280, VB2_H  = 120
const PAD2   = { l: 18, r: 4, t: 8, b: 20 }
const PLT2_W = VB2_W - PAD2.l - PAD2.r   // 258
const PLT2_H = VB2_H - PAD2.t - PAD2.b   // 52

function ContentMix({ saves }) {
  // Force SVG remount on every component mount so SMIL animations replay on
  // every page visit — including tab-switches that keep the component alive.
  const [mountKey, setMountKey] = useState(0)
  useEffect(() => { setMountKey((k) => k + 1) }, [])

  const { dayBuckets, dayLabels, activeSeries, peak, totals, totalAll } = useMemo(() => {
    const base   = buildDayBuckets()
    const labels = base.map((b) => b.label)
    const byType = {
      video:       fillBuckets(base, Object.values(saves).filter((s) => s?.item?.type === 'video').map((s) => s?.savedAt)),
      article:     fillBuckets(base, Object.values(saves).filter((s) => s?.item?.type === 'article').map((s) => s?.savedAt)),
      social_post: fillBuckets(base, Object.values(saves).filter((s) => s?.item?.type === 'social_post').map((s) => s?.savedAt)),
      pdf:         fillBuckets(base, Object.values(saves).filter((s) => s?.item?.type === 'pdf').map((s) => s?.savedAt)),
    }
    const allCounts    = Object.values(byType).flatMap((bs) => bs.map((b) => b.count))
    const peak         = Math.max(1, ...allCounts)
    const totals       = {
      video:       Object.values(saves).filter((s) => s?.item?.type === 'video').length,
      article:     Object.values(saves).filter((s) => s?.item?.type === 'article').length,
      social_post: Object.values(saves).filter((s) => s?.item?.type === 'social_post').length,
      pdf:         Object.values(saves).filter((s) => s?.item?.type === 'pdf').length,
    }
    const totalAll     = Object.values(totals).reduce((a, b) => a + b, 0)
    const activeSeries = MIX.filter((s) => byType[s.key].some((b) => b.count > 0))
    return { dayBuckets: byType, dayLabels: labels, activeSeries, peak, totals, totalAll }
  }, [saves])

  const step     = PLT2_W / 6
  const toMini   = (bs) => bs.map((b, i) => [PAD2.l + i * step, PAD2.t + PLT2_H - (peak > 0 ? (b.count / peak) * PLT2_H : 0)])
  const miniBase = PAD2.t + PLT2_H
  const miniArea = (pts) => pts.length
    ? `${smoothLine(pts)} L ${pts[pts.length - 1][0]} ${miniBase} L ${pts[0][0]} ${miniBase} Z`
    : ''

  if (!totalAll) return (
    <p className="text-[12px] text-[color:var(--color-text-tertiary)]">Save items to see your content mix.</p>
  )

  const series = activeSeries.length ? activeSeries : MIX

  return (
    <div className="space-y-3">
      {/* Mini line chart — dark inset background */}
      <div className="rounded-xl overflow-hidden p-3 pb-1" style={{ background: 'rgba(6,8,16,0.75)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <svg key={mountKey} viewBox={`0 0 ${VB2_W} ${VB2_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-label="Content type breakdown over 7 days">
        <defs>
          {MIX.map((s) => (
            <linearGradient key={s.key} id={`cm-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity=".28" />
              <stop offset="55%"  stopColor={s.color} stopOpacity=".08" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
          <clipPath id="cm-reveal">
            <rect x={PAD2.l} y={0} width={PLT2_W} height={VB2_H}>
              <animate attributeName="width" from="0" to={PLT2_W}
                dur="1.4s" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" />
            </rect>
          </clipPath>
        </defs>
        {/* Y-axis grid lines + left-side metric labels (0, mid, peak) */}
        {[0, 0.5, 1].map((frac, idx) => {
          const y   = miniBase - frac * PLT2_H
          const val = idx === 0 ? 0 : idx === 1 ? Math.round(peak / 2) : peak
          return (
            <g key={idx}>
              {frac > 0 && (
                <line
                  x1={PAD2.l} y1={y} x2={PAD2.l + PLT2_W} y2={y}
                  stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="2 3"
                />
              )}
              <text
                x={PAD2.l - 2} y={y + (idx === 0 ? -2 : 2.5)}
                textAnchor="end" fontSize="6" fill="rgba(255,255,255,0.20)"
              >
                {val}
              </text>
            </g>
          )
        })}

        {/* Baseline — drawn on top of dashed grid so it stays solid */}
        <line x1={PAD2.l} y1={miniBase} x2={PAD2.l + PLT2_W} y2={miniBase}
          stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

        {/* Fills — revealed by sliding clipPath */}
        <g clipPath="url(#cm-reveal)">
          {series.map((s) => {
            const pts = toMini(dayBuckets[s.key])
            return <path key={s.key} d={miniArea(pts)} fill={`url(#cm-${s.key})`} />
          })}
        </g>

        {/* Lines — drawn via stroke-dashoffset */}
        {series.map((s) => {
          const pts = toMini(dayBuckets[s.key])
          const d   = smoothLine(pts)
          return (
            <g key={s.key}>
              <path d={d} fill="none" stroke={s.color}
                strokeWidth="2" strokeOpacity=".20" strokeLinecap="round" strokeLinejoin="round"
                pathLength="1" strokeDasharray="1" strokeDashoffset="1">
                <animate attributeName="stroke-dashoffset"
                  from="1" to="0" dur="1.4s"
                  calcMode="spline" keyTimes="0;1" keySplines="0.25 0.46 0.45 0.94"
                  fill="freeze" />
              </path>
              <path d={d} fill="none" stroke={s.color}
                strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"
                pathLength="1" strokeDasharray="1" strokeDashoffset="1">
                <animate attributeName="stroke-dashoffset"
                  from="1" to="0" dur="1.4s"
                  calcMode="spline" keyTimes="0;1" keySplines="0.25 0.46 0.45 0.94"
                  fill="freeze" />
              </path>
            </g>
          )
        })}

        {/* X-axis labels — reduced font size */}
        {dayLabels.map((label, i) => (
          <text key={i} x={PAD2.l + i * step} y={VB2_H - 4}
            textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.22)">{label}</text>
        ))}
      </svg>
      </div>

      {/* Legend */}
      <div className="space-y-1.5">
        {MIX.filter(({ key }) => totals[key] > 0).map(({ key, label, color }) => {
          const pct = Math.round((totals[key] / totalAll) * 100)
          return (
            <div key={key} className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="chip text-[10px]">{label}</span>
              <span className="flex-1 text-right text-[color:var(--color-text-tertiary)] tabular-nums">{pct}%</span>
              <span className="tabular-nums w-6 text-right text-white/60">{totals[key]}</span>
            </div>
          )
        })}
        <p className="text-[10px] text-right text-[color:var(--color-text-tertiary)] pt-0.5">{totalAll} total</p>
      </div>
    </div>
  )
}

// ─── Top searches ─────────────────────────────────────────────────────────────

function TopSearches({ searches }) {
  const sorted = useMemo(() =>
    Object.entries(searches)
      .sort(([, a], [, b]) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 6),
    [searches],
  )

  if (!sorted.length) return (
    <p className="text-[12px] text-[color:var(--color-text-tertiary)] py-2">No searches recorded yet.</p>
  )

  const peak = sorted[0]?.[1]?.count ?? 1
  return (
    <ul>
      {sorted.map(([query, data]) => {
        const pct = Math.round(((data.count ?? 0) / peak) * 100)
        return (
          <li key={query} className="py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <Search size={9} className="flex-shrink-0 text-[color:var(--color-text-tertiary)]" />
              <span className="text-[12px] truncate flex-1">{query}</span>
              <Pill tone="neutral">{data.count}×</Pill>
            </div>
            {/* Line-style indicator */}
            <div className="ml-[17px] relative h-px">
              <div className="absolute inset-0 rounded-full bg-white/[0.06]" />
              <div className="absolute top-0 left-0 h-px rounded-full"
                style={{ width: `${pct}%`, background: `linear-gradient(to right, transparent, ${C.tool}88, ${C.tool})` }} />
              {pct > 3 && (
                <div className="absolute w-[5px] h-[5px] rounded-full"
                  style={{ left: `${pct}%`, top: '50%', background: C.tool,
                    boxShadow: `0 0 5px 2px ${C.tool}44`, transform: 'translateX(-50%) translateY(-50%)' }} />
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ─── AI context health ────────────────────────────────────────────────────────

const CTX_ROWS = [
  { id: 'identity',       label: 'Identity context',  max: 8, color: C.memory      },
  { id: 'research_focus', label: 'Research focus',     max: 5, color: C.article     },
  { id: 'topic_rule',     label: 'Topic rules',        max: 5, color: C.tool        },
  { id: 'source_pref',    label: 'Source preferences', max: 5, color: C.url         },
  { id: 'personal_stack', label: 'Personal stack',     max: 5, color: C.social_post },
]

function ContextHealth({ allMemory, follows, userTopics }) {
  const identityCount = allMemory.filter((m) => m.isIdentityPinned).length
  const catCounts = useMemo(() => {
    const c = {}
    for (const m of allMemory) c[m.category] = (c[m.category] ?? 0) + 1
    return c
  }, [allMemory])
  const getValue = (id) => id === 'identity' ? identityCount : (catCounts[id] ?? 0)

  return (
    <ul>
      {CTX_ROWS.map(({ id, label, max, color }) => {
        const n    = getValue(id)
        const pct  = Math.min(100, Math.round((n / max) * 100))
        const tone = pct >= 80 ? 'positive' : pct >= 40 ? 'warning' : 'neutral'
        return (
          <li key={id} className="py-2">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="chip text-[10px] flex-shrink-0 max-w-[130px] truncate">{label}</span>
              <div className="flex-1" />
              <Pill tone={tone}>{n} / {max}</Pill>
            </div>
            {/* Line-style indicator */}
            <div className="relative h-px">
              <div className="absolute inset-0 rounded-full bg-white/[0.06]" />
              <div className="absolute top-0 left-0 h-px rounded-full transition-all"
                style={{ width: `${pct}%`, background: `linear-gradient(to right, transparent, ${color}88, ${color})` }} />
              {pct > 0 && (
                <div className="absolute w-[5px] h-[5px] rounded-full"
                  style={{ left: `${pct}%`, top: '50%', background: color,
                    boxShadow: `0 0 5px 2px ${color}44`, transform: 'translateX(-50%) translateY(-50%)' }} />
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ─── AI engine (Ollama models) ───────────────────────────────────────────────

const KNOWN_MODELS = [
  {
    id:      'llama3.2:3b',
    label:   'Llama 3.2',
    params:  '3B',
    ctx:     128_000,
    sizeMb:  2100,
    note:    'Default · fast summaries',
    color:   '#6366f1',
  },
  {
    id:      'qwen2.5:7b',
    label:   'Qwen 2.5',
    params:  '7B',
    ctx:     128_000,
    sizeMb:  4700,
    note:    'Balanced · code-aware',
    color:   '#a855f7',
  },
  {
    id:      'llama3.1:8b',
    label:   'Llama 3.1',
    params:  '8B',
    ctx:     128_000,
    sizeMb:  4700,
    note:    'Balanced · stronger reasoning',
    color:   '#8b5cf6',
  },
  {
    id:      'phi4-mini',
    label:   'Phi-4 Mini',
    params:  '3.8B',
    ctx:     128_000,
    sizeMb:  2300,
    note:    'Fast · chain-of-thought',
    color:   '#14b8a6',
  },
  {
    id:      'gemma3:9b',
    label:   'Gemma 3',
    params:  '9B',
    ctx:     131_072,
    sizeMb:  5800,
    note:    'Balanced · multilingual',
    color:   '#f59e0b',
  },
  {
    id:      'llama3.3:70b',
    label:   'Llama 3.3',
    params:  '70B',
    ctx:     128_000,
    sizeMb:  43_000,
    note:    'High quality · needs GPU RAM',
    color:   '#f43f5e',
  },
]

function fmtCtx(n) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}K`
}
function fmtSize(mb) {
  return mb >= 1000 ? `~${(mb / 1000).toFixed(0)} GB` : `~${mb} MB`
}
function fmtTokens(n) {
  if (!n || n <= 0) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)    return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ── Mini 7-day bar chart ──────────────────────────────────────────────────────

function MiniUsageChart({ data, color }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-[2px]" style={{ width: 50, height: 14 }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{
            height: v > 0 ? `${Math.max(3, Math.round((v / max) * 14))}px` : '2px',
            background: v > 0 ? color : 'rgba(255,255,255,0.07)',
          }}
        />
      ))}
    </div>
  )
}

// Match a KNOWN_MODELS id against a pulled model name.
// e.g. 'phi4-mini' matches 'phi4-mini:latest', 'llama3.2:3b' matches 'llama3.2:3b'
function modelMatches(knownId, pulledName) {
  return pulledName === knownId || pulledName.startsWith(`${knownId}:`) || knownId.startsWith(`${pulledName.split(':')[0]}:`)
}

function OllamaModels() {
  const [activeModel,   setActiveModel]   = useState(OLLAMA_CONFIG.model)
  const [enabled,       setEnabled]       = useState(OLLAMA_CONFIG.enabled)
  const [tokenUsage,    setTokenUsage]    = useState(() => getTokenUsage())
  const [tokenHistory,  setTokenHistory]  = useState(() => getTokenHistory())
  const [pulledNames,   setPulledNames]   = useState(null)   // null = loading, [] = offline

  // Fetch what's actually pulled from Ollama
  useEffect(() => {
    let cancelled = false
    fetch('/api/ollama/api/tags')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (cancelled) return
        setPulledNames((json?.models || []).map((m) => m.name))
      })
      .catch(() => { if (!cancelled) setPulledNames([]) })
    return () => { cancelled = true }
  }, [])

  function handleToggleEnabled() {
    const next = !enabled
    setOllamaEnabled(next)
    setEnabled(next)
  }

  function handleSelectModel(id) {
    setOllamaModel(id)
    setActiveModel(id)
    setTokenUsage(getTokenUsage())
    setTokenHistory(getTokenHistory())
  }

  const totalTokens = Object.values(tokenUsage).reduce((a, b) => a + b, 0)

  // Grand 7-day total across all models
  const total7d = useMemo(() => {
    const history = tokenHistory
    const result  = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const dayTotal = Object.values(history[key] ?? {}).reduce((a, b) => a + b, 0)
      result.push(dayTotal)
    }
    return result
  }, [tokenHistory])

  const total7dSum = total7d.reduce((a, b) => a + b, 0)

  // Build display list: only what's actually pulled, enriched with catalog metadata.
  const displayModels = useMemo(() => {
    if (!pulledNames) return []   // still loading
    return pulledNames.map((pulledName) => {
      const catalog = KNOWN_MODELS.find((m) => modelMatches(m.id, pulledName))
      return catalog
        ? { ...catalog, id: pulledName, resolvedId: pulledName, installed: true }
        : { id: pulledName, resolvedId: pulledName, label: pulledName,
            params: '', ctx: 0, sizeMb: 0, note: '', color: '#6b7280', installed: true }
    })
  }, [pulledNames])

  return (
    <div>
      {/* Status row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={handleToggleEnabled}
          className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
            enabled
              ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-emerald-400/20'
              : 'bg-white/[0.04] text-white/30 border-white/10 hover:text-white/50'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-white/20'}`} />
          {enabled ? 'Ollama enabled' : 'Ollama disabled'}
        </button>
        {enabled && (
          <span className="text-[10px] text-[color:var(--color-text-tertiary)]">
            Active: <span className="text-white/60 font-mono">{activeModel}</span>
          </span>
        )}
        <span className="text-[10px] text-[color:var(--color-text-tertiary)]">
          ctx per call: <span className="font-mono text-white/40">32K</span>
        </span>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 my-2 py-1.5 rounded-md bg-black/20 text-[9px] text-[color:var(--color-text-tertiary)] uppercase tracking-wide">
        <span className="w-1.5 flex-shrink-0" />
        <span className="w-[88px] flex-shrink-0">Model</span>
        <span className="w-[28px] flex-shrink-0 text-center">Size</span>
        <span className="w-[40px] flex-shrink-0 text-right">Ctx</span>
        <span className="w-[46px] flex-shrink-0 text-right">Disk</span>
        <span className="flex-1 hidden sm:block">Notes</span>
        <span className="w-[50px] flex-shrink-0 text-right hidden sm:block">7 days</span>
        <span className="w-[44px] flex-shrink-0 text-right">All time</span>
        <span className="w-[40px] flex-shrink-0" />
      </div>

      {/* Model rows */}
      {pulledNames === null ? (
        <div className="px-3 py-4 text-[11px] text-white/20">Loading…</div>
      ) : displayModels.length === 0 ? (
        <div className="px-3 py-4 text-[11px] text-white/20">
          No models pulled. Run <span className="font-mono">docker exec ollama ollama pull llama3.2:3b</span> to get started.
        </div>
      ) : (
        <div className="space-y-0.5">
          {displayModels.map((m) => {
            const isActive = activeModel === m.resolvedId || activeModel === m.id
            const used     = tokenUsage[m.id] ?? tokenUsage[m.resolvedId] ?? 0
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                  isActive
                    ? 'border-white/10 bg-white/[0.05]'
                    : 'border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-20'}`}
                  style={{ background: m.color }}
                />
                <span className="font-mono text-[11px] text-white/70 w-[88px] flex-shrink-0 truncate">{m.id}</span>
                {m.params
                  ? <span className="chip text-[9px] flex-shrink-0 w-[28px] text-center">{m.params}</span>
                  : <span className="w-[28px] flex-shrink-0" />}
                <span
                  className="text-[11px] tabular-nums font-medium flex-shrink-0 w-[40px] text-right"
                  style={{ color: m.ctx ? m.color : 'transparent' }}
                  title={m.ctx ? `${m.ctx.toLocaleString()} token context window` : ''}
                >
                  {m.ctx ? fmtCtx(m.ctx) : ''}
                </span>
                <span className="text-[10px] text-[color:var(--color-text-tertiary)] tabular-nums flex-shrink-0 w-[46px] text-right">
                  {m.sizeMb ? fmtSize(m.sizeMb) : ''}
                </span>
                <span className="text-[10px] text-[color:var(--color-text-tertiary)] flex-1 min-w-0 truncate hidden sm:block">
                  {m.note}
                </span>
                {/* 7-day mini chart */}
                <div className="w-[50px] flex-shrink-0 flex justify-end hidden sm:flex">
                  <MiniUsageChart data={get7DayUsage(m.id, tokenHistory)} color={m.color} />
                </div>
                {/* All-time tokens */}
                <span
                  className={`text-[11px] tabular-nums flex-shrink-0 w-[44px] text-right font-medium ${
                    used > 0 ? 'text-white/60' : 'text-white/20'
                  }`}
                  title={used > 0 ? `${used.toLocaleString()} tokens (all time)` : 'No usage recorded'}
                >
                  {fmtTokens(used)}
                </span>
                {enabled && (
                  isActive
                    ? <span className="text-[10px] px-2 py-0.5 rounded border border-white/20 text-white/40 flex-shrink-0 w-[40px] text-center select-none pointer-events-none">active</span>
                    : <button
                        onClick={() => handleSelectModel(m.resolvedId ?? m.id)}
                        className="text-[10px] px-2 py-0.5 rounded border transition-colors flex-shrink-0 w-[40px] text-center border-white/10 text-white/30 hover:text-white/70 hover:border-white/25"
                      >use</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Grand total footer */}
      <div className="flex items-center gap-3 px-3 py-2 mt-1 border-t border-white/[0.06]">
        <span className="w-1.5 flex-shrink-0" />
        <span className="font-mono text-[11px] text-white/30 w-[88px] flex-shrink-0">total</span>
        <span className="w-[28px] flex-shrink-0" />
        <span className="w-[40px] flex-shrink-0" />
        <span className="w-[46px] flex-shrink-0" />
        <span className="flex-1 hidden sm:block" />
        {/* 7-day total chart */}
        <div className="w-[50px] flex-shrink-0 flex justify-end hidden sm:flex">
          <MiniUsageChart data={total7d} color="#6b7280" />
        </div>
        {/* All-time total */}
        <span
          className={`text-[11px] tabular-nums flex-shrink-0 w-[44px] text-right font-semibold ${
            totalTokens > 0 ? 'text-white/70' : 'text-white/20'
          }`}
          title={totalTokens > 0 ? `${totalTokens.toLocaleString()} tokens (all time) · ${total7dSum.toLocaleString()} in last 7 days` : 'No usage recorded'}
        >
          {fmtTokens(totalTokens)}
        </span>
        {enabled && <span className="w-[40px] flex-shrink-0" />}
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function KnowledgeOverview() {
  const {
    saves, follows, userTopics, searches,
    memoryEntries, manualContent, isMemoryDismissed,
  } = useStore()
  const { contentById, seedMemory } = useSeed()
  const [signals, setSignals] = useState([])
  const [restoring, setRestoring] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState(null)
  const [sync, setSync] = useState(() => ({ ...syncState }))

  useEffect(() => subscribeSyncStatus(() => setSync({ ...syncState })), [])

  useEffect(() => {
    try { setSignals(loadSignals()) } catch {}
  }, [])

  const allMemory = useMemo(() => {
    const visible = (seedMemory || []).filter((m) => !isMemoryDismissed(m.id))
    return [...visible, ...Object.values(memoryEntries || {})]
  }, [seedMemory, memoryEntries, isMemoryDismissed])

  const resolvedItems = useMemo(() =>
    Object.entries(saves).map(([id, s]) => s?.item || contentById(id)).filter(Boolean),
    [saves, contentById],
  )

  const totalSaved    = Object.keys(saves).length
  const totalFollowed = Object.keys(follows || {}).length + Object.keys(userTopics || {}).length
  const totalMemory   = allMemory.length
  const totalSignals  = signals.length

  // Show a restore prompt when the user's personal data appears missing.
  // Triggers when: saves + followed-topics + userTopics are all zero but the
  // disk sync has a lastModified timestamp (meaning a file exists on disk).
  const looksEmpty    = totalSaved === 0 && Object.keys(userTopics || {}).length === 0
  const diskHasData   = Boolean(sync.lastModified)
  const showRestoreHint = looksEmpty && diskHasData && sync.status !== 'offline' && !restoreMsg

  async function handleRestore() {
    setRestoring(true)
    setRestoreMsg(null)
    try {
      await pullSyncedState(true)
      const s = syncState
      if (s.status === 'synced') {
        setRestoreMsg({ kind: 'ok', text: 'Data restored from disk.' })
      } else {
        setRestoreMsg({ kind: 'err', text: s.error || 'Sync server unreachable — is the Vite dev server running?' })
      }
    } catch {
      setRestoreMsg({ kind: 'err', text: 'Restore failed.' })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* ── Missing-data restore banner ──────────────────────────────────── */}
      {(showRestoreHint || restoreMsg) && (
        <div className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border text-sm fm-fade-up ${
          restoreMsg?.kind === 'err'
            ? 'border-amber-500/30 bg-amber-500/5 text-amber-200/90'
            : restoreMsg?.kind === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200/90'
              : 'border-sky-500/30 bg-sky-500/8 text-sky-100/80'
        }`}>
          <span>
            {restoreMsg
              ? restoreMsg.text
              : 'Your saved data is on disk but not loaded yet in this session.'}
          </span>
          {!restoreMsg && (
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="btn text-xs flex-shrink-0"
            >
              {restoring
                ? <><RefreshCw size={12} className="animate-spin" /> Restoring…</>
                : <><RefreshCw size={12} /> Restore from disk</>}
            </button>
          )}
        </div>
      )}

      {/* ── Hero line chart ──────────────────────────────────────────────── */}
      <KnowledgeGrowthChart
        saves={saves}
        manualContent={manualContent}
        memoryEntries={memoryEntries}
      />

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 fm-fade-up" style={{ '--fm-delay': '130ms' }}>
        <StatCard icon={BookmarkCheck} value={totalSaved}    label="Saved items"
          color={C.article} spark={totalSaved / 100}    delay={0.06} />
        <StatCard icon={TrendingUp}    value={totalFollowed} label="Topics followed"
          color={C.topic}   spark={totalFollowed / 50}  delay={0.13} />
        <StatCard icon={Brain}         value={totalMemory}   label="Memory rules"
          color={C.memory}  spark={totalMemory / 20}    delay={0.20} />
        <StatCard icon={Zap}           value={totalSignals}  label="Signals captured"
          color={C.signal}  spark={totalSignals / 100}  delay={0.27} />
      </div>

      {/* ── Content mix + Top searches + AI context health ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 fm-fade-up" style={{ '--fm-delay': '190ms' }}>
        <div className="glass-panel p-5">
          <SectionHead title="Content mix" sub="breakdown of what you save" />
          <ContentMix saves={saves} />
        </div>
        <div className="glass-panel p-5">
          <SectionHead title="Top searches" sub="your most frequent queries" />
          <TopSearches searches={searches || {}} />
        </div>
        <div className="glass-panel p-5">
          <SectionHead title="AI context health" sub="how well FlowAI knows you" />
          <ContextHealth allMemory={allMemory} follows={follows} userTopics={userTopics} />
        </div>
      </div>

      {/* ── Recent captures + Signal pulse ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 fm-fade-up" style={{ '--fm-delay': '220ms' }}>
        <div className="glass-panel p-5">
          <SectionHead title="Recent captures" sub="what you've been saving" />
          <RecentCaptures saves={saves} contentById={contentById} />
        </div>
        <div className="glass-panel p-5">
          <SectionHead title="Signal pulse" sub="latest from radar scans" />
          <SignalPulse signals={signals} />
        </div>
      </div>

      {/* ── AI engine (full-width) ────────────────────────────────────────── */}
      <div className="glass-panel p-5 fm-fade-up" style={{ '--fm-delay': '280ms' }}>
        <SectionHead
          title={<span className="flex items-center gap-1.5"><Cpu size={12} className="text-[color:var(--color-tool)]" />AI engine</span>}
          sub="Ollama models · context windows"
        />
        <OllamaModels />
      </div>

    </div>
  )
}
