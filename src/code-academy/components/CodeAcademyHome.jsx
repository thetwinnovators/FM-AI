import { useState } from 'react'
import { Code2, Loader2, Sparkles, CheckCircle2, ArrowRight, Trash2 } from 'lucide-react'
import { LANGUAGES, CONCEPTS_BY_LANGUAGE, GOALS } from '../constants.js'

// ─── Language colours ──────────────────────────────────────────────────────────
const LANG_MAP = Object.fromEntries(LANGUAGES.map((l) => [l.id, l]))

// ─── Progress card (In Progress / Completed tabs) ─────────────────────────────
function LessonCard({ progress, onResume, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const lang = LANG_MAP[progress.language]
  const pct  = progress.exercisesTotal > 0
    ? Math.round((progress.exercisesCompleted / progress.exercisesTotal) * 100)
    : 0
  const done = progress.masteryState === 'passed'

  // Build one dot per exercise slot
  const dots = Array.from({ length: progress.exercisesTotal || 0 }, (_, i) => ({
    passed: i < (progress.exercisesCompleted || 0),
  }))

  function handleDelete(e) {
    e.stopPropagation()
    if (confirming) {
      onDelete(progress.lessonKey)
    } else {
      setConfirming(true)
    }
  }

  function cancelDelete(e) {
    e.stopPropagation()
    setConfirming(false)
  }

  return (
    <div
      className="relative group w-full text-left rounded-xl border overflow-hidden cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg"
      style={{
        background:  confirming
          ? 'linear-gradient(160deg, rgba(30,10,10,0.85) 0%, rgba(18,6,6,0.92) 100%)'
          : 'linear-gradient(160deg, rgba(15,17,28,0.75) 0%, rgba(8,10,18,0.85) 100%)',
        borderColor: confirming ? 'rgba(239,68,68,0.35)' : done ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)',
        boxShadow:   done && !confirming ? '0 0 0 1px rgba(52,211,153,0.1) inset' : 'none',
      }}
      onClick={() => !confirming && onResume(progress.language, progress.concept)}
      onMouseLeave={() => setConfirming(false)}
    >
      <div className="p-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-semibold text-white/90 leading-snug mb-1"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {progress.concept}
            </p>
            <p
              className="text-[11px] font-semibold uppercase tracking-wide truncate"
              style={{ color: lang?.color ?? 'rgba(255,255,255,0.35)' }}
            >
              {lang?.label ?? progress.language}
            </p>
          </div>

          {/* Status badge / delete controls */}
          {confirming ? (
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
              <span className="text-[10px] text-red-400/80 font-semibold">Delete?</span>
              <button
                onClick={handleDelete}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/20 border border-red-400/30 text-red-400 hover:bg-red-500/35 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={cancelDelete}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.10] text-white/50 hover:text-white/80 transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border ${
                done
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-400/25'
                  : 'text-teal-400/80 bg-teal-500/10 border-teal-400/15'
              }`}>
                {done ? 'Completed' : 'In Progress'}
              </span>
              <button
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/15 hover:text-red-400 text-white/40"
                title="Delete lesson"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {/* ── Exercises meta ── */}
        {progress.exercisesTotal > 0 && (
          <div className="flex items-center gap-1.5 mb-4">
            <span className="text-xs font-medium text-white/50">
              {progress.exercisesTotal} exercises
            </span>
          </div>
        )}

        {/* ── Progress bar ── */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-white/30 font-medium">Progress</span>
            <span className="text-[11px] font-bold text-white/60">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: done
                  ? 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)'
                  : 'linear-gradient(90deg, #0d9488 0%, #6366f1 100%)',
              }}
            />
          </div>
        </div>

        {/* ── Exercise dots + count ── */}
        {dots.length > 0 && (
          <div className="flex items-center gap-1.5">
            {dots.map((d, i) => (
              <div
                key={i}
                className="rounded-full flex-shrink-0 transition-all"
                style={{
                  width:      d.passed ? 8 : 6,
                  height:     d.passed ? 8 : 6,
                  background: d.passed ? '#2dd4bf' : 'rgba(255,255,255,0.08)',
                }}
              />
            ))}
            <span className="text-[11px] text-white/35 ml-0.5">
              {progress.exercisesCompleted} / {progress.exercisesTotal} done
            </span>
          </div>
        )}

      </div>
    </div>
  )
}

/**
 * Code Academy home with tabs: Discover · In Progress · Completed
 *
 * Props:
 *   onStart(language, concept) — start / resume a lesson
 *   isLoading — true while lesson is generating
 *   error — error string or null
 *   progressList — array of CodeLessonProgress
 */
export default function CodeAcademyHome({ onStart, onDelete, isLoading, error, progressList }) {
  const [tab, setTab] = useState('discover')

  // Discover tab state
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [selectedConcept,  setSelectedConcept]  = useState('')
  const [searchQuery,      setSearchQuery]       = useState('')

  const concepts        = selectedLanguage ? (CONCEPTS_BY_LANGUAGE[selectedLanguage] || []) : []
  const filteredConcepts = searchQuery.trim()
    ? concepts.filter((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
    : concepts
  const customConcept   = searchQuery.trim() &&
    !concepts.some((c) => c.toLowerCase() === searchQuery.trim().toLowerCase())
    ? searchQuery.trim()
    : null
  const canStart        = selectedLanguage && selectedConcept && !isLoading

  function handleGoal(goal) {
    setSelectedLanguage(goal.language)
    setSelectedConcept(goal.concept)
    setSearchQuery('')
  }

  const inProgress  = (progressList || []).filter((p) => p.masteryState === 'in_progress')
  const completed   = (progressList || []).filter((p) => p.masteryState === 'passed')

  const TABS = [
    { id: 'discover',    label: 'Discover' },
    { id: 'in_progress', label: 'In Progress', count: inProgress.length },
    { id: 'completed',   label: 'Completed',   count: completed.length  },
  ]

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Page header ── */}
      <div className="px-6 pt-6 pb-1 flex-shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2.5">
          <Code2 size={20} className="text-teal-400" /> Code Academy
        </h1>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 px-6 pt-4 border-b border-white/[0.08] flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative -mb-px ${
              tab === t.id
                ? 'text-white border-b-2 border-teal-400'
                : 'text-[color:var(--color-text-secondary)] hover:text-white'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-white/[0.08] text-[color:var(--color-text-tertiary)]">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Discover tab ── */}
      {tab === 'discover' && (
        <div className="flex-1 flex flex-col items-center px-6 pt-10 pb-16 overflow-auto">
          {/* Heading */}
          <div className="flex flex-col items-center gap-1.5 mb-10 text-center">
            <h2 className="text-4xl font-light tracking-tight">
              What would you like to code?
            </h2>
            <p className="text-sm text-[color:var(--color-text-tertiary)] max-w-md">
              Flow AI generates a lesson with examples and exercises — one concept at a time.
            </p>
          </div>

          <div className="w-full max-w-2xl space-y-6">

            {/* Step 1: Language */}
            <div
              className="rounded-2xl border border-teal-500/20 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.10) 0%, rgba(99,102,241,0.06) 100%)' }}
            >
              <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #0d9488 0%, #6366f1 100%)' }} />
              <div className="p-5">
                <p className="text-xs font-semibold text-teal-300/70 uppercase tracking-wider mb-3">
                  Step 1 · Choose a language
                </p>
                <div className="flex gap-2 flex-wrap">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => { setSelectedLanguage(lang.id); setSelectedConcept('') }}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
                      style={{
                        borderColor: selectedLanguage === lang.id ? lang.color : 'rgba(255,255,255,0.12)',
                        background:  selectedLanguage === lang.id ? `${lang.color}22` : 'rgba(255,255,255,0.04)',
                        color:       selectedLanguage === lang.id ? lang.color : 'rgba(255,255,255,0.65)',
                      }}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
                {selectedLanguage && (
                  <p className="mt-2 text-xs text-white/35">
                    {LANGUAGES.find((l) => l.id === selectedLanguage)?.desc}
                  </p>
                )}
              </div>
            </div>

            {/* Step 2: Concept */}
            {selectedLanguage && (
              <div
                className="rounded-2xl border border-indigo-500/20 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.05) 100%)' }}
              >
                <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)' }} />
                <div className="p-5">
                  <p className="text-xs font-semibold text-indigo-300/70 uppercase tracking-wider mb-3">
                    Step 2 · Choose a concept
                  </p>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search or type any topic…"
                    className="w-full mb-3 px-3 py-2 rounded-lg text-sm bg-white/[0.06] border border-white/[0.10] text-white placeholder-white/25 focus:outline-none focus:border-indigo-400/50"
                  />
                  <div className="flex flex-wrap gap-2">
                    {customConcept && (
                      <button
                        onClick={() => setSelectedConcept(customConcept)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                        style={{
                          borderColor: selectedConcept === customConcept ? 'rgba(45,212,191,0.6)'  : 'rgba(45,212,191,0.25)',
                          background:  selectedConcept === customConcept ? 'rgba(13,148,136,0.22)' : 'rgba(13,148,136,0.08)',
                          color:       selectedConcept === customConcept ? '#5eead4'                : 'rgba(153,246,228,0.7)',
                        }}
                      >
                        + "{customConcept}"
                      </button>
                    )}
                    {filteredConcepts.map((concept) => (
                      <button
                        key={concept}
                        onClick={() => setSelectedConcept(concept)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                        style={{
                          borderColor: selectedConcept === concept ? 'rgba(129,140,248,0.6)'  : 'rgba(129,140,248,0.2)',
                          background:  selectedConcept === concept ? 'rgba(99,102,241,0.20)' : 'rgba(99,102,241,0.07)',
                          color:       selectedConcept === concept ? '#a5b4fc'               : 'rgba(199,210,254,0.75)',
                        }}
                      >
                        {concept}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quick goals */}
            <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles size={11} /> Or pick a goal
              </p>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((goal) => (
                  <button
                    key={goal.label}
                    onClick={() => handleGoal(goal)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.10] bg-white/[0.04] text-white/50 hover:border-white/[0.22] hover:text-white/80 transition-all"
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-400/25 text-sm text-amber-300">
                {error}
              </div>
            )}

            {/* Start button */}
            {canStart && (
              <button
                onClick={() => onStart(selectedLanguage, selectedConcept)}
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
              >
                {isLoading
                  ? <><Loader2 size={16} className="animate-spin" /> Generating lesson…</>
                  : <><Code2 size={16} /> Start lesson: {selectedConcept}</>}
              </button>
            )}

          </div>
        </div>
      )}

      {/* ── In Progress tab ── */}
      {tab === 'in_progress' && (
        inProgress.length === 0 ? (
          <div className="py-16 text-center text-sm text-[color:var(--color-text-tertiary)]">
            <Code2 size={28} className="mx-auto mb-3 opacity-40" />
            <p>
              No lessons in progress.{' '}
              <button className="underline text-white" onClick={() => setTab('discover')}>
                Discover
              </button>{' '}
              a topic to start one.
            </p>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-3 gap-3">
            {inProgress.map((p) => (
              <LessonCard key={p.lessonKey} progress={p} onResume={onStart} onDelete={onDelete} />
            ))}
          </div>
        )
      )}

      {/* ── Completed tab ── */}
      {tab === 'completed' && (
        completed.length === 0 ? (
          <div className="py-16 text-center text-sm text-[color:var(--color-text-tertiary)]">
            <CheckCircle2 size={28} className="mx-auto mb-3 opacity-40" />
            <p>No completed lessons yet. Keep coding!</p>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-3 gap-3">
            {completed.map((p) => (
              <LessonCard key={p.lessonKey} progress={p} onResume={onStart} onDelete={onDelete} />
            ))}
          </div>
        )
      )}

    </div>
  )
}
