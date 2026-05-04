import { useState } from 'react'
import { Compass, Filter, Tags, Brain } from 'lucide-react'

const STAGES = [
  { icon: Compass, color: '#14b8a6', title: 'Discover', sub: 'Sources · Searches · Triggers',   seed: 7 },
  { icon: Filter,  color: '#6366f1', title: 'Parse',    sub: 'Metadata · Transcripts · Entities', seed: 13 },
  { icon: Tags,    color: '#8b5cf6', title: 'Classify', sub: 'Topics · Concepts · Relations',     seed: 31 },
  { icon: Brain,   color: '#10b981', title: 'Retain',   sub: 'Memory · Patterns · Suggestions',   seed: 53 },
]

const VW = 200
const VH = 44

function genSignal(seed, pct, n) {
  let s = seed
  const raw = Array.from({ length: n }, () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  })
  const pass = (arr) => arr.map((v, i) => ((arr[i - 1] ?? v) + v + (arr[i + 1] ?? v)) / 3)
  const smooth = pass(pass(raw))
  const base = 0.25 + pct * 0.45
  const amp  = 0.18 + pct * 0.12
  const vals = smooth.map((v) => Math.min(0.97, Math.max(0.03, base + (v - 0.5) * amp * 2)))
  // Anchor "now" (last point) to a height that reflects the real pct so the
  // label is self-consistent with the chart height at "now".
  const nowVal = Math.min(0.95, Math.max(0.05, 0.12 + pct * 0.82))
  vals[n - 2] = vals[n - 2] * 0.55 + nowVal * 0.45
  vals[n - 1] = nowVal
  return vals
}

function splinePath(values, close = false) {
  const pts = values.map((v, i) => [(i / (values.length - 1)) * VW, VH - v * VH])
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = (pts[i][0] + pts[i + 1][0]) / 2
    d += ` C ${cx.toFixed(1)},${pts[i][1].toFixed(1)} ${cx.toFixed(1)},${pts[i + 1][1].toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`
  }
  if (close) d += ` L ${VW},${VH} L 0,${VH} Z`
  return d
}

function fmt12(h24) {
  const h = h24 % 12 || 12
  return `${h}${h24 < 12 ? 'am' : 'pm'}`
}

function getLabels(period) {
  const now = new Date()
  if (period === '24h') {
    const h = now.getHours()
    return [fmt12((h - 18 + 24) % 24), fmt12((h - 12 + 24) % 24), fmt12((h - 6 + 24) % 24), 'now']
  }
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const d = now.getDay()
  return [DAYS[(d + 2) % 7], DAYS[(d + 4) % 7], DAYS[(d + 6) % 7], 'today']
}

function SignalChart({ color, seed, pct, period }) {
  const n      = period === '24h' ? 24 : 7
  const values = genSignal(seed, pct, n)
  const gid    = `sc-${color.replace('#', '')}`
  const mgid   = `mg-${color.replace('#', '')}`
  const mid    = `fm-${color.replace('#', '')}`
  const cid    = `cr-${color.replace('#', '')}`
  const labels = getLabels(period)

  const nowIdx   = n - 1
  const peakYPct = (1 - values[nowIdx]) * 100

  return (
    <div className="mt-2.5">
      <div className="relative" style={{ height: VH }}>
        <svg key={period} width="100%" height={VH} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id={mgid} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="white" stopOpacity="0" />
              <stop offset="30%"  stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </linearGradient>
            <mask id={mid}>
              <rect x="0" y="0" width={VW} height={VH} fill={`url(#${mgid})`} />
            </mask>
            <clipPath id={cid}>
              <rect x="0" y="0" height={VH} width="0">
                <animate attributeName="width" from="0" to={VW} dur="1.1s" fill="freeze"
                  calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
              </rect>
            </clipPath>
          </defs>
          <g clipPath={`url(#${cid})`} mask={`url(#${mid})`}>
            <path d={splinePath(values, true)} fill={`url(#${gid})`} />
            <path d={splinePath(values)}       fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </svg>

        {/* Glowing dot at "now" — fades in after the chart sweep */}
        <div
          className="absolute pointer-events-none"
          style={{
            right: 0, top: `${peakYPct}%`, transform: 'translate(50%, -50%)',
            animation: 'fm-dot-in 0.3s ease-out 1s both',
          }}
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px 3px ${color}55, 0 0 3px 1px ${color}` }}
          />
        </div>
      </div>
      <div className="flex justify-between mt-1">
        {labels.map((l, i) => (
          <span key={i} className="text-[9px] text-white/20">{l}</span>
        ))}
      </div>
    </div>
  )
}

export default function PipelineStrip({ counts = {} }) {
  const [period, setPeriod] = useState('24h')
  const allCounts = STAGES.map((s) => counts[s.title.toLowerCase()] ?? 0)
  const globalMax = Math.max(...allCounts, 1)

  return (
    <div
      className="glass-panel overflow-hidden border-white/[0.09]"
      style={{
        background: 'linear-gradient(160deg, #0d0f1c 0%, #07090f 100%)',
        boxShadow: 'rgba(0,0,0,0.65) 0px 18px 48px, rgba(0,0,0,0.45) 0px 6px 16px, rgba(255,255,255,0.10) 0px 1px 0px inset',
      }}
    >
      <div className="px-5 py-2.5 border-b border-[color:var(--color-border-subtle)] flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-tertiary)]">
          Topic Intelligence Pipeline
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-px bg-white/[0.05] rounded p-0.5">
            {['24h', '7d'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                  period === p
                    ? 'bg-white/[0.1] text-white/80'
                    : 'text-white/35 hover:text-white/55'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-[color:var(--color-text-tertiary)]">4-stage loop · always running</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[color:var(--color-border-subtle)]">
        {STAGES.map((s, i) => {
          const Icon  = s.icon
          const count = allCounts[i]
          const pct   = count / globalMax
          return (
            <div key={i} className="px-4 pt-3.5 pb-3">
              <div className="flex items-center gap-2 mb-0.5">
                <Icon size={13} style={{ color: s.color }} />
                <p className="text-[13px] font-semibold">{s.title}</p>
                <p className="text-[13px] font-semibold ml-auto">{count}</p>
              </div>
              <p className="text-[10px] text-[color:var(--color-text-tertiary)] mb-0">
                {s.sub}
              </p>
              <SignalChart color={s.color} seed={s.seed} pct={pct} period={period} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
