import { Search, Settings, BookOpen, FileText, Wrench, User, Lightbulb, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store/useStore.js'
import { useSeed } from '../../store/useSeed.js'
import SettingsMenu from './SettingsMenu.jsx'

// Categorization for autosuggest dropdown — each row gets a colored icon and a
// small uppercase tag on the right so the user can tell topic from doc from
// recent search at a glance.
const TYPE_META = {
  recent:  { Icon: Clock,     label: 'Recent',   accent: 'var(--color-text-tertiary)' },
  topic:   { Icon: BookOpen,  label: 'Topic',    accent: 'var(--color-topic)' },
  doc:     { Icon: FileText,  label: 'Document', accent: 'var(--color-article)' },
  tool:    { Icon: Wrench,    label: 'Tool',     accent: 'var(--color-tool)' },
  creator: { Icon: User,      label: 'Creator',  accent: 'var(--color-creator)' },
  concept: { Icon: Lightbulb, label: 'Concept',  accent: 'var(--color-concept)' },
}

const MAX_SUGGESTIONS = 10

export default function TopBar() {
  const navigate = useNavigate()
  const { recordSearch, recentSearches, userTopics, documents } = useStore()
  const { topics: seedTopics, tools, creators, concepts } = useSeed()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [menuOpen, setMenuOpen] = useState(false)
  const settingsBtnRef = useRef(null)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  // Tracks the search input's viewport position so the portal'd dropdown
  // can sit directly under it. Recalculated on focus / scroll / resize.
  const [anchorRect, setAnchorRect] = useState(null)
  function refreshAnchor() {
    const r = inputRef.current?.getBoundingClientRect()
    if (r) setAnchorRect({ left: r.left, top: r.bottom + 4, width: r.width })
  }
  useEffect(() => {
    if (!open) return
    refreshAnchor()
    window.addEventListener('resize', refreshAnchor)
    window.addEventListener('scroll', refreshAnchor, true)
    return () => {
      window.removeEventListener('resize', refreshAnchor)
      window.removeEventListener('scroll', refreshAnchor, true)
    }
  }, [open])

  // Build the suggestion list. Recent searches always lead; on empty input we
  // show only those (history affordance). When the user types we filter every
  // source by substring against the trimmed query.
  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase()
    const out = []

    const recents = recentSearches(5)
    for (const r of recents) {
      if (!term || r.query.toLowerCase().includes(term)) {
        out.push({ type: 'recent', label: r.query, action: 'search' })
      }
    }

    if (term) {
      const allTopics = [
        ...(seedTopics || []).map((t) => ({ ...t, isUser: false })),
        ...Object.values(userTopics || {}).map((t) => ({ ...t, isUser: true })),
      ]
      for (const t of allTopics) {
        const hay = `${t.name || ''} ${t.summary || ''}`.toLowerCase()
        if (hay.includes(term)) {
          out.push({
            type: 'topic',
            label: t.name,
            sublabel: t.summary,
            action: 'topic',
            slug: t.slug || t.id,
          })
        }
      }

      for (const d of Object.values(documents || {})) {
        if ((d.title || '').toLowerCase().includes(term)) {
          out.push({ type: 'doc', label: d.title, sublabel: d.excerpt, action: 'doc', id: d.id })
        }
      }

      for (const x of tools || []) {
        if ((x.name || '').toLowerCase().includes(term)) {
          out.push({ type: 'tool', label: x.name, sublabel: x.summary, action: 'search' })
        }
      }
      for (const x of creators || []) {
        if ((x.name || '').toLowerCase().includes(term)) {
          out.push({ type: 'creator', label: x.name, sublabel: x.summary, action: 'search' })
        }
      }
      for (const x of concepts || []) {
        if ((x.name || '').toLowerCase().includes(term)) {
          out.push({ type: 'concept', label: x.name, sublabel: x.summary, action: 'search' })
        }
      }
    }

    // De-dupe by (type, label) — recent + topic with same name shouldn't double-up.
    const seen = new Set()
    const deduped = []
    for (const s of out) {
      const key = `${s.type}|${s.label.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(s)
      if (deduped.length >= MAX_SUGGESTIONS) break
    }
    return deduped
  }, [q, recentSearches, seedTopics, userTopics, documents, tools, creators, concepts])

  // Reset the highlighted index whenever the query changes — stale index would
  // otherwise point past the end of a smaller filtered list.
  useEffect(() => { setHighlight(-1) }, [q])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function applySuggestion(s) {
    setOpen(false)
    if (s.action === 'topic') {
      setQ('')
      navigate(`/topic/${s.slug}`)
    } else if (s.action === 'doc') {
      setQ('')
      navigate(`/documents/${s.id}`)
    } else {
      // 'search' — record and route to the search page with the query
      recordSearch(s.label)
      setQ('')
      navigate(`/search?q=${encodeURIComponent(s.label)}`)
    }
  }

  function onKeyDown(e) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && highlight < suggestions.length) {
        e.preventDefault()
        applySuggestion(suggestions[highlight])
      }
      // else: fall through to the form's onSubmit (raw query)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function onSubmit(e) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    recordSearch(trimmed)
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
    setOpen(false)
    setQ('')
  }

  return (
    <header className="glass-panel m-3 mb-0 pl-5 pr-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
      <form onSubmit={onSubmit} className="flex items-center gap-2 flex-1 max-w-[640px]" ref={wrapRef}>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-tertiary)] z-10" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); refreshAnchor() }}
            onFocus={() => { setOpen(true); refreshAnchor() }}
            onKeyDown={onKeyDown}
            placeholder="Search topics, tools, creators, content…"
            className="glass-input w-full pl-9 text-sm"
            aria-autocomplete="list"
            aria-expanded={open && suggestions.length > 0}
            role="combobox"
          />
          {open && suggestions.length > 0 && anchorRect ? createPortal(
            <ul
              role="listbox"
              className="fixed max-h-[400px] overflow-auto rounded-lg z-[80]"
              style={{
                top: anchorRect.top,
                left: anchorRect.left,
                width: anchorRect.width,
                background: 'rgba(11, 13, 24, 0.95)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              {suggestions.map((s, i) => {
                const meta = TYPE_META[s.type]
                const Icon = meta.Icon
                const active = i === highlight
                return (
                  <li
                    key={`${s.type}-${i}`}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => { e.preventDefault(); applySuggestion(s) }}
                    className={`px-3 py-2 cursor-pointer flex items-center gap-2.5 ${
                      active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon size={13} style={{ color: meta.accent }} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{s.label}</div>
                      {s.sublabel ? (
                        <div className="text-[11px] text-[color:var(--color-text-tertiary)] truncate">
                          {s.sublabel}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className="text-[10px] uppercase tracking-wide font-medium flex-shrink-0"
                      style={{ color: meta.accent, opacity: 0.7 }}
                    >
                      {meta.label}
                    </span>
                  </li>
                )
              })}
            </ul>,
            document.body
          ) : null}
        </div>
      </form>

      <div className="flex items-center gap-3">
        <span className="chip bg-[color:var(--color-creator)]/10 text-[color:var(--color-creator)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-creator)] animate-pulse" />
          Live · seed
        </span>
        <button
          ref={settingsBtnRef}
          onClick={() => setMenuOpen((v) => !v)}
          className={`btn p-2 ${menuOpen ? 'bg-white/[0.06]' : ''}`}
          aria-label="Settings"
          aria-expanded={menuOpen}
        >
          <Settings size={15} />
        </button>
      </div>
      <SettingsMenu anchorRef={settingsBtnRef} open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  )
}
