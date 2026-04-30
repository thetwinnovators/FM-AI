// Procedural cover for topic cards. Deterministic by slug — each topic gets a
// stable, distinct gradient + initials so cards are easy to scan visually.
// Magenta / blue / teal palette only (matches the no-orange UI rule).
const PALETTE = [
  ['#d946ef', '#6366f1'],  // fuchsia → indigo
  ['#06b6d4', '#3b82f6'],  // cyan    → blue
  ['#14b8a6', '#06b6d4'],  // teal    → cyan
  ['#8b5cf6', '#ec4899'],  // violet  → pink
  ['#a855f7', '#d946ef'],  // purple  → fuchsia
  ['#3b82f6', '#8b5cf6'],  // blue    → violet
  ['#10b981', '#14b8a6'],  // emerald → teal
  ['#f43f5e', '#a855f7'],  // rose    → purple
]

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export default function TopicCover({ slug = '', name = '', image = null, className = '' }) {
  const seed = slug || name || 'topic'
  const hash = hashStr(seed)
  const [c1, c2] = PALETTE[hash % PALETTE.length]
  const angle = 110 + (hashStr(seed + ':a') % 100)  // 110°–210°

  return (
    <div className={`relative overflow-hidden rounded-xl aspect-[16/7] ${className}`}>
      {image ? (
        <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 100%)` }}
        />
      )}
      {/* Soft inner shadow + dark bottom gradient for contrast */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.45) 100%),' +
            'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18) 0%, transparent 55%)',
        }}
      />
    </div>
  )
}
