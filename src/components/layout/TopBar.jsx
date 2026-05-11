import { Search, Settings, BookOpen, FileText, Wrench, User, Lightbulb, Clock, Globe, ChevronDown, Check, Radio } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore, unreadBriefCount } from '../../store/useStore.js'
import { useSeed } from '../../store/useSeed.js'
import SettingsMenu from './SettingsMenu.jsx'
import BriefsDropdown from '../briefs/BriefsDropdown.jsx'
import BriefModal from '../briefs/BriefModal.jsx'
import { useDailyDigestCheck } from '../briefs/useDailyDigestCheck.js'
import { fetchAiNews } from '../../lib/briefs/fetchAiNews.js'
import { generateNewsDigest } from '../../lib/briefs/generateNewsDigest.js'

const TYPE_META = {
  recent:  { Icon: Clock,     label: 'Recent',   accent: 'var(--color-text-tertiary)' },
  topic:   { Icon: BookOpen,  label: 'Topic',    accent: 'var(--color-topic)' },
  doc:     { Icon: FileText,  label: 'Document', accent: 'var(--color-article)' },
  tool:    { Icon: Wrench,    label: 'Tool',     accent: 'var(--color-tool)' },
  creator: { Icon: User,      label: 'Creator',  accent: 'var(--color-creator)' },
  concept: { Icon: Lightbulb, label: 'Concept',  accent: 'var(--color-concept)' },
}

const SEARCH_MODES = [
  { id: 'flowmap', label: 'FlowMap', Icon: Search,  accent: 'var(--color-topic)' },
  { id: 'web',     label: 'Web',     Icon: Globe,   accent: 'var(--color-article)' },
]

const MAX_SUGGESTIONS = 10

export default function TopBar() {
  const navigate = useNavigate()
  const { recordSearch, recentSearches, userTopics, documents, briefs, addBrief, deleteBrief } = useStore()
  const unread = unreadBriefCount(briefs)
  const [briefsOpen, setBriefsOpen] = useState(false)
  const [activeBrief, setActiveBrief] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const briefsBtnRef = useRef(null)

  async function handleRefreshDigest(briefId) {
    if (refreshing) return
    setRefreshing(true)
    deleteBrief(briefId)
    setActiveBrief(null)
    try {
      const stories = await fetchAiNews()
      if (!stories.length) return
      const digest = await generateNewsDigest(stories)
      if (digest) {
        addBrief(digest)
        setActiveBrief(digest)
      }
    } finally {
      setRefreshing(false)
    }
  }

  useDailyDigestCheck()
  const { topics: seedTopics, tools, creators, concepts } = useSeed()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchMode, setSearchMode] = useState('flowmap') // 'flowmap' | 'web'
  const [modeOpen, setModeOpen] = useState(false)
  const [modeRect, setModeRect] = useState(null)
  const settingsBtnRef = useRef(null)
  const modeBtnRef = useRef(null)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
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
          out.push({ type: 'topic', label: t.name, sublabel: t.summary, action: 'topic', slug: t.slug || t.id })
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

  useEffect(() => { setHighlight(-1) }, [q])

  // Close dropdowns on outside click
  useEffect(() => {
    if (!open && !modeOpen) return
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false)
        setModeOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, modeOpen])

  function applySuggestion(s) {
    setOpen(false)
    setModeOpen(false)
    if (s.action === 'topic') {
      setQ('')
      navigate(`/topic/${s.slug}`)
    } else if (s.action === 'doc') {
      setQ('')
      navigate(`/documents/${s.id}`)
    } else {
      recordSearch(s.label)
      setQ('')
      navigate(`/search?q=${encodeURIComponent(s.label)}`)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); setModeOpen(false); return }
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
    }
  }

  function onSubmit(e) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    setOpen(false)
    setModeOpen(false)
    setQ('')
    recordSearch(trimmed)
    if (searchMode === 'web') {
      navigate(`/search?q=${encodeURIComponent(trimmed)}&mode=web`)
    } else {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`)
    }
  }

  const currentMode = SEARCH_MODES.find((m) => m.id === searchMode)

  return (
    <header className="glass-panel m-3 mb-0 pl-5 pr-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
      <form onSubmit={onSubmit} className="flex items-center gap-2 flex-1 max-w-[640px]" ref={wrapRef}>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-tertiary)] z-10" />

          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setModeOpen(false); refreshAnchor() }}
            onFocus={() => { setOpen(true); refreshAnchor() }}
            onKeyDown={onKeyDown}
            placeholder={searchMode === 'web' ? 'Search the web…' : 'Search topics, tools, creators, content…'}
            className="glass-input w-full pl-9 pr-28 text-sm"
            aria-autocomplete="list"
            aria-expanded={open && suggestions.length > 0}
            role="combobox"
          />

          {/* Mode switcher pill — sits inside the input on the right */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
            <button
              ref={modeBtnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                const r = modeBtnRef.current?.getBoundingClientRect()
                if (r) setModeRect({ top: r.bottom + 4, right: window.innerWidth - r.right })
                setModeOpen((v) => !v)
                setOpen(false)
              }}
              className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80 px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition-colors"
            >
              <currentMode.Icon size={10} style={{ color: currentMode.accent }} />
              <span>{currentMode.label}</span>
              <ChevronDown size={9} className={`transition-transform ${modeOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Mode switcher dropdown — portalled so it escapes the stacking context */}
          {modeOpen && modeRect ? createPortal(
            <div
              className="fixed z-[90] rounded-lg overflow-hidden min-w-[168px]"
              style={{
                top: modeRect.top,
                right: modeRect.right,
                background: 'rgba(11,13,24,0.97)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {SEARCH_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setSearchMode(mode.id)
                    setModeOpen(false)
                    inputRef.current?.focus()
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-left transition-colors hover:bg-white/[0.05]"
                >
                  <mode.Icon size={13} style={{ color: mode.accent }} className="flex-shrink-0" />
                  <span className={searchMode === mode.id ? 'text-white' : 'text-white/60'}>
                    Search {mode.label}
                  </span>
                  {searchMode === mode.id ? (
                    <Check size={12} style={{ color: mode.accent }} className="ml-auto flex-shrink-0" />
                  ) : null}
                </button>
              ))}
            </div>,
            document.body
          ) : null}

          {/* Suggestions dropdown */}
          {open && anchorRect ? createPortal(
            <div
              className="fixed rounded-lg z-[80] overflow-hidden"
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
              {suggestions.length > 0 ? (
                <ul role="listbox" className="max-h-[340px] overflow-auto">
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
                </ul>
              ) : null}

              {/* Submit action — reflects current mode */}
              <div className={`${suggestions.length > 0 ? 'border-t border-white/[0.06]' : ''} p-1`}>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const trimmed = q.trim()
                    setOpen(false)
                    setQ('')
                    if (trimmed) recordSearch(trimmed)
                    if (searchMode === 'web') {
                      navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}&mode=web` : '/search?mode=web')
                    } else {
                      navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search')
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors text-left"
                >
                  <currentMode.Icon size={13} style={{ color: currentMode.accent }} className="flex-shrink-0" />
                  <span>
                    Search {currentMode.label}
                    {q.trim() ? <> for <span className="text-white/90">"{q.trim()}"</span></> : null}
                  </span>
                </button>
              </div>
            </div>,
            document.body
          ) : null}
        </div>
      </form>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[color:var(--color-topic)]/25 flex items-center justify-center text-[11px] font-semibold">
            JU
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-medium">JenoU</div>
            <div className="text-[10px] text-[color:var(--color-text-tertiary)]">researcher</div>
          </div>
        </div>
          {/* Briefs button */}
          <div className="relative">
            <button
              ref={briefsBtnRef}
              onClick={() => setBriefsOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12px] font-semibold transition-colors"
              style={{
                background: 'rgba(13,148,136,0.15)',
                border: '1px solid rgba(45,212,191,0.25)',
                color: '#2dd4bf',
              }}
              aria-label="Open AI Briefs"
            >
              <Radio size={13} />
              Briefs
            </button>
            {unread > 0 && (
              <span
                className="absolute flex items-center justify-center text-[10px] font-bold text-white"
                style={{
                  top: -6,
                  right: -6,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  background: 'linear-gradient(135deg,#0d9488,#6366f1)',
                  border: '2px solid var(--color-bg, #070a14)',
                  padding: '0 4px',
                }}
              >
                {unread}
              </span>
            )}
          </div>
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
          {briefsOpen && (
            <BriefsDropdown
              anchorRect={briefsBtnRef.current?.getBoundingClientRect()}
              onClose={() => setBriefsOpen(false)}
              onOpenBrief={(brief) => setActiveBrief(brief)}
              onViewAll={() => { setBriefsOpen(false); navigate('/briefs') }}
            />
          )}
          <BriefModal
            brief={activeBrief}
            onClose={() => setActiveBrief(null)}
            onRefresh={handleRefreshDigest}
            refreshing={refreshing}
          />
    </header>
  )
}
