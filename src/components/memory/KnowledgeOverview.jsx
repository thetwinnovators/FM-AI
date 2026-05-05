/**
 * KnowledgeOverview — "Overview" tab on the Knowledge Base page.
 * Design language: glass-panel, SparkArc KPI cards, chip labels, Pill values,
 * fm-fade-up stagger. Hero 7-day multi-series line chart at the top.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  BookmarkCheck, Brain, FileText, MessageCircle,
  Play, Search, TrendingUp, Zap,
} from 'lucide-react'
import Pill from '../ui/Pill.jsx'
import { useStore } from '../../store/useStore.js'
import { useSeed } from '../../store/useSeed.js'
import { loadSignals } from '../../opportunity-radar/storage/radarStorage.js'

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
  pdf:         '#f59e0b',  // amber — documents / PDFs
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

/** Build 28 × 6-hour buckets (~7 days at 6h granularity) for the hero chart.
 *  Slots are aligned to LOCAL 6h marks (0/6/12/18h) so getHours()===0 correctly
 *  fires at local midnight regardless of the user's UTC offset. */
function build6hBuckets() {
  const SIX_H  = 6 * 3600_000
  // Snap to the most-recent local 6h boundary
  const now    = new Date()
  const snapped = new Date(now)
  snapped.setHours(Math.floor(now.getHours() / 6) * 6, 0, 0, 0)
  const periodStart = snapped.getTime()

  return Array.from({ length: 28 }, (_, i) => {
    const start      = periodStart - (27 - i) * SIX_H
    const d          = new Date(start)
    const hour       = d.getHours()          // local hours
    const isLast     = i === 27
    const isDayStart = hour === 0 || i === 0
    const dayLabel   = isLast ? 'Now'
      : isDayStart ? d.toLocaleDateString('en-US', { weekday: 'short' })
      : null
    const hourLabel  = !isLast && !isDayStart && [6, 12, 18].includes(hour)
      ? `${hour}h` : null
    const tipLabel   = isLast ? 'Now'
      : `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${String(hour).padStart(2, '0')}:00`
    return { dayLabel, hourLabel, tipLabel, isDayStart, start, end: start + SIX_H, count: 0 }
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
  const r    = 20
  const circ = 2 * Math.PI * r
  const arc  = circ * 0.75
  const fill = arc * Math.min(1, Math.max(0, pct))
  const gid  = `kbo-${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg width="44" height="44" viewBox="0 0 44 44"
      className="absolute -bottom-2 -right-2 pointer-events-none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity=".2" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeOpacity=".12"
        strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${arc} ${circ}`} transform="rotate(135 22 22)" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={`url(#${gid})`}
        strokeWidth="4.5" strokeLinecap="round"
        strokeDasharray={`0 ${circ}`} transform="rotate(135 22 22)">
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

function KnowledgeGrowthChart({ saves, manualContent, memoryEntries }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [tip, setTip] = useState({ x: 0, y: 0, pct: 0 })

  const { deltaBuckets, cumBuckets, baseMeta, activeSeries, peak, totalCount } = useMemo(() => {
    const base = build6hBuckets()   // 28 × 6-hour slots

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

    return { deltaBuckets, cumBuckets, baseMeta: base, activeSeries, peak, totalCount }
  }, [saves, manualContent, memoryEntries])

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
            Cumulative ingest · 6h intervals · last 7 days
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {(activeSeries.length > 0 ? activeSeries : SERIES.slice(0, 3)).map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-[color:var(--color-text-secondary)]">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
          {totalCount > 0 && <Pill tone="neutral">{totalCount} ingested</Pill>}
        </div>
      </div>

      {/* Chart wrapper — relative container for tooltip */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          aria-label="Knowledge growth over the last 7 days"
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
          </defs>

          {/* Vertical grid lines — solid at day boundaries, dashed at 6h marks */}
          {baseMeta.map((slot, i) => {
            if (!slot.dayLabel && !slot.hourLabel) return null
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

          {/* Per-series: area → line → delta dots */}
          {activeSeries.map((s) => {
            const pts = toPoints(cumBuckets[s.key], peak)
            return (
              <g key={s.key}>
                <path d={areaShape(pts)} fill={`url(#kg-${s.key})`} />
                {/* Glow pass */}
                <path d={smoothLine(pts)} fill="none"
                  stroke={s.color} strokeWidth="1.5" strokeOpacity=".18"
                  strokeLinecap="round" strokeLinejoin="round" />
                {/* Crisp pass */}
                <path d={smoothLine(pts)} fill="none"
                  stroke={s.color} strokeWidth="0.5"
                  strokeLinecap="round" strokeLinejoin="round" />
                {/* Dots on days with new ingest */}
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
              No ingest activity in the last 7 days
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
const VB2_W  = 280, VB2_H  = 80
const PAD2   = { l: 18, r: 4, t: 8, b: 20 }
const PLT2_W = VB2_W - PAD2.l - PAD2.r   // 258
const PLT2_H = VB2_H - PAD2.t - PAD2.b   // 52

function ContentMix({ saves }) {
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
      {/* Mini line chart */}
      <svg viewBox={`0 0 ${VB2_W} ${VB2_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-label="Content type breakdown over 7 days">
        <defs>
          {MIX.map((s) => (
            <linearGradient key={s.key} id={`cm-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity=".28" />
              <stop offset="55%"  stopColor={s.color} stopOpacity=".08" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {/* Baseline */}
        <line x1={PAD2.l} y1={miniBase} x2={PAD2.l + PLT2_W} y2={miniBase}
          stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        {series.map((s) => {
          const pts = toMini(dayBuckets[s.key])
          return (
            <g key={s.key}>
              <path d={miniArea(pts)} fill={`url(#cm-${s.key})`} />
              <path d={smoothLine(pts)} fill="none" stroke={s.color}
                strokeWidth="2" strokeOpacity=".20" strokeLinecap="round" strokeLinejoin="round" />
              <path d={smoothLine(pts)} fill="none" stroke={s.color}
                strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )
        })}
        {/* X-axis labels */}
        {dayLabels.map((label, i) => (
          <text key={i} x={PAD2.l + i * step} y={VB2_H - 4}
            textAnchor="middle" fontSize="7.5" fill="rgba(255,255,255,0.22)">{label}</text>
        ))}
      </svg>

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

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function KnowledgeOverview() {
  const {
    saves, follows, userTopics, searches,
    memoryEntries, manualContent, isMemoryDismissed,
  } = useStore()
  const { contentById, seedMemory } = useSeed()
  const [signals, setSignals] = useState([])

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

  return (
    <div className="space-y-4">

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 fm-fade-up" style={{ '--fm-delay': '250ms' }}>
        <div className="glass-panel p-5">
          <SectionHead title="Recent captures" sub="what you've been saving" />
          <RecentCaptures saves={saves} contentById={contentById} />
        </div>
        <div className="glass-panel p-5">
          <SectionHead title="Signal pulse" sub="latest from radar scans" />
          <SignalPulse signals={signals} />
        </div>
      </div>

    </div>
  )
}
