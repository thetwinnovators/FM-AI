import { useState, useMemo, useRef, useEffect } from 'react'
import { ArrowLeft, Search, CheckCircle2, Download, Upload } from 'lucide-react'
import { PYTHON_CURRICULUM } from '../curriculum/python'
import { exportProgress, importProgress } from '../storage/progressStorage'

function lessonStatus(p) {
  if (!p)          return 'not_started'
  if (p.completed) return 'completed'
  if (p.skipped)   return 'skipped'
  if (p.viewed || p.practiced) return 'in_progress'
  return 'not_started'
}

function cardStyle(status) {
  if (status === 'completed')   return { background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(45,212,191,0.3)' }
  if (status === 'in_progress') return { background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid #0d9488', border: '1px solid transparent' }
  if (status === 'skipped')     return { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', opacity: 0.5 }
  return { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }
}

export default function LessonMap({ progress, onSelectLesson, onBack, onProgressChange, initialScrollTop, onScrollChange }) {
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)
  const importRef = useRef(null)

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importProgress(file)
      onProgressChange?.()
    } catch {
      alert('Could not import — make sure you selected a valid progress file.')
    }
    e.target.value = ''
  }

  useEffect(() => {
    if (containerRef.current && initialScrollTop) containerRef.current.scrollTop = initialScrollTop
  }, [initialScrollTop])

  const titleById = useMemo(() => {
    const map = {}
    PYTHON_CURRICULUM.forEach((g) => g.subLessons.forEach((sl) => { map[sl.id] = sl.title }))
    return map
  }, [])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return PYTHON_CURRICULUM
    return PYTHON_CURRICULUM
      .map((group) => ({
        ...group,
        subLessons: group.subLessons.filter((sl) =>
          sl.title.toLowerCase().includes(q) ||
          sl.searchableTerms.some((t) => t.toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.subLessons.length > 0)
  }, [query])

  return (
    <div
      ref={containerRef}
      className="p-6 max-w-4xl mx-auto overflow-auto"
      onScroll={() => onScrollChange?.(containerRef.current?.scrollTop ?? 0)}
    >
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <h1 className="text-xl font-bold flex-1 text-center" style={{ color: 'rgba(255,255,255,0.88)' }}>
          Python Curriculum
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={exportProgress}
            title="Export progress"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px]"
            style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Download size={11} /> Export
          </button>
          <button
            onClick={() => importRef.current?.click()}
            title="Import progress"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px]"
            style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Upload size={11} /> Import
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      <div className="relative mb-8">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
        <input
          type="text"
          placeholder="Search lessons…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.8)' }}
        />
      </div>

      {filteredGroups.length === 0 && (
        <p className="text-center text-sm py-12" style={{ color: 'rgba(255,255,255,0.25)' }}>
          No lessons match "{query}"
        </p>
      )}

      {filteredGroups.map((group) => {
        const total = group.subLessons.length
        const done  = group.subLessons.filter((sl) => progress[sl.id]?.completed).length
        return (
          <section key={group.id} className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {group.title}
              </h2>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: done === total ? 'rgba(13,148,136,0.2)' : 'rgba(255,255,255,0.06)', color: done === total ? '#2dd4bf' : 'rgba(255,255,255,0.35)' }}
              >
                {done} / {total}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.subLessons.map((sl) => {
                const status = lessonStatus(progress[sl.id])
                const tip    = sl.recommendedAfter ? `Helpful after: ${titleById[sl.recommendedAfter] ?? sl.recommendedAfter}` : null
                return (
                  <button
                    key={sl.id}
                    onClick={() => onSelectLesson(group.id, sl.id)}
                    title={tip ?? undefined}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:brightness-110"
                    style={cardStyle(status)}
                  >
                    {status === 'completed' && <CheckCircle2 size={13} style={{ color: '#2dd4bf', flexShrink: 0 }} />}
                    <span style={{
                      color:          status === 'skipped' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)',
                      textDecoration: status === 'skipped' ? 'line-through' : 'none',
                      fontWeight:     500,
                    }}>
                      {sl.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
