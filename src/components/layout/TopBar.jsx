import { Search, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useStore } from '../../store/useStore.js'

export default function TopBar() {
  const navigate = useNavigate()
  const { recordSearch } = useStore()
  const [q, setQ] = useState('')

  function onSubmit(e) {
    e.preventDefault()
    const trimmed = q.trim()
    if (trimmed) {
      recordSearch(trimmed)
      navigate(`/search?q=${encodeURIComponent(trimmed)}`)
    }
  }

  return (
    <header className="glass-panel m-3 ml-0 mb-0 px-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
      <form onSubmit={onSubmit} className="flex items-center gap-2 flex-1 max-w-[640px]">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-tertiary)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search topics, tools, creators, content…"
            className="glass-input w-full pl-9 text-sm"
          />
        </div>
      </form>

      <div className="flex items-center gap-3">
        <span className="chip border-[color:var(--color-creator)]/40 bg-[color:var(--color-creator)]/10 text-[color:var(--color-creator)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-creator)] animate-pulse" />
          Live · seed
        </span>
        <button className="btn p-2" aria-label="Settings">
          <Settings size={15} />
        </button>
      </div>
    </header>
  )
}
