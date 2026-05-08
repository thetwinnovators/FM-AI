import { useState } from 'react'
import { Code2, Loader2, Sparkles } from 'lucide-react'
import { LANGUAGES, CONCEPTS_BY_LANGUAGE, GOALS } from '../constants.js'

/**
 * Entry screen — user picks language + concept/goal, then clicks Start Lesson.
 * Props:
 *   onStart(language, concept) — called when user clicks Start Lesson
 *   isLoading — true while lesson is being generated
 *   error — error string or null
 *   progressList — array of CodeLessonProgress for the "resume" section
 */
export default function CodeAcademyHome({ onStart, isLoading, error, progressList }) {
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [selectedConcept, setSelectedConcept]   = useState('')
  const [searchQuery, setSearchQuery]            = useState('')

  const concepts = selectedLanguage ? (CONCEPTS_BY_LANGUAGE[selectedLanguage] || []) : []
  const filteredConcepts = searchQuery.trim()
    ? concepts.filter((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
    : concepts

  function handleGoal(goal) {
    setSelectedLanguage(goal.language)
    setSelectedConcept(goal.concept)
  }

  const canStart = selectedLanguage && selectedConcept && !isLoading

  return (
    <div className="flex flex-col items-center px-6 pt-10 pb-16">
      {/* Hero */}
      <div className="flex flex-col items-center gap-2 mb-10">
        <div className="p-3 rounded-2xl mb-2" style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.2) 0%, rgba(99,102,241,0.15) 100%)', border: '1px solid rgba(45,212,191,0.2)' }}>
          <Code2 size={28} className="text-teal-400" />
        </div>
        <h1 className="text-3xl font-light tracking-tight text-center">Code Academy</h1>
        <p className="text-sm text-[color:var(--color-text-tertiary)] text-center max-w-md">
          Learn to code step by step. Flow AI teaches one concept at a time with examples, exercises, and plain-language explanations.
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
            <div className="flex gap-3 flex-wrap">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => { setSelectedLanguage(lang.id); setSelectedConcept('') }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                  style={{
                    borderColor: selectedLanguage === lang.id ? lang.color : 'rgba(255,255,255,0.12)',
                    background: selectedLanguage === lang.id ? `${lang.color}22` : 'rgba(255,255,255,0.04)',
                    color: selectedLanguage === lang.id ? lang.color : 'rgba(255,255,255,0.65)',
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: lang.color }}
                  />
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
                placeholder="Search concepts…"
                className="w-full mb-3 px-3 py-2 rounded-lg text-sm bg-white/[0.06] border border-white/[0.10] text-white placeholder-white/25 focus:outline-none focus:border-indigo-400/50"
              />
              <div className="flex flex-wrap gap-2">
                {filteredConcepts.map((concept) => (
                  <button
                    key={concept}
                    onClick={() => setSelectedConcept(concept)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                    style={{
                      borderColor: selectedConcept === concept ? 'rgba(129,140,248,0.6)' : 'rgba(129,140,248,0.2)',
                      background: selectedConcept === concept ? 'rgba(99,102,241,0.20)' : 'rgba(99,102,241,0.07)',
                      color: selectedConcept === concept ? '#a5b4fc' : 'rgba(199,210,254,0.75)',
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
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Code2 size={16} />}
            {isLoading ? 'Generating lesson…' : `Start lesson: ${selectedConcept}`}
          </button>
        )}

        {/* Resume section */}
        {progressList && progressList.filter((p) => p.masteryState === 'in_progress').length > 0 && (
          <div>
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Resume</p>
            <div className="space-y-2">
              {progressList
                .filter((p) => p.masteryState === 'in_progress')
                .slice(0, 4)
                .map((p) => (
                  <button
                    key={p.lessonKey}
                    onClick={() => onStart(p.language, p.concept)}
                    className="w-full text-left flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium text-white/80">{p.concept}</span>
                      <span className="ml-2 text-xs text-white/30 uppercase">{p.language}</span>
                    </div>
                    <span className="text-xs text-teal-400/70">
                      {p.exercisesCompleted}/{p.exercisesTotal} done
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
