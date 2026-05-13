import { useState, useEffect, useRef } from 'react'
import { Sparkles, Loader2, PenLine, BookMarked, HelpCircle, ArrowRight, Download } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import { generateCourseSyllabus, getClarificationQuestion } from '../courseGenerator.js'

// stage: 'input' | 'clarifying' | 'picking' | 'generating'

export default function TopicPicker({ suggestedTopics, onCourseCreated, isPersonalised = true, onImportClick }) {
  const { addCourse, updateCourse } = useStore()
  const [input, setInput] = useState('')
  const [goal, setGoal]   = useState('')
  const [stage, setStage] = useState('input')
  const [clarifyData, setClarifyData] = useState(null) // { question, options }
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef(null)

  const generating = stage === 'generating'
  const busy       = stage !== 'input'       // disable inputs during any async work

  // ── Progress bar (runs only during course generation) ────────────────────────
  useEffect(() => {
    if (generating) {
      setProgress(0)
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 84) return prev
          return Math.min(prev + Math.max((85 - prev) * 0.07, 0.3), 84)
        })
      }, 250)
      return () => {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    } else {
      setProgress((prev) => (prev > 0 ? 100 : 0))
      const t = setTimeout(() => setProgress(0), 700)
      return () => clearTimeout(t)
    }
  }, [generating])

  // ── Step 1: clarify then generate ────────────────────────────────────────────
  async function handleGenerate(topic) {
    const t = String(topic || input).trim()
    if (!t) return
    if (!OLLAMA_CONFIG.enabled) {
      setError('Ollama is not enabled. Turn it on in Settings and make sure the Docker container is running.')
      return
    }
    setError(null)
    setStage('clarifying')

    const clarify = await getClarificationQuestion(t, goal)

    if (clarify.skip) {
      // Topic is already specific — go straight to generation
      await createCourse(t, goal)
      return
    }

    setClarifyData(clarify)
    setStage('picking')
  }

  // ── Step 2: actually build the course ────────────────────────────────────────
  async function createCourse(topic, courseGoal) {
    setStage('generating')
    setClarifyData(null)
    setError(null)
    try {
      const data = await generateCourseSyllabus(topic, courseGoal ?? goal)
      if (!data) {
        setError('Could not generate a course. Make sure Ollama is running and a model is pulled, then try again.')
        setStage('input')
        return
      }
      const course = addCourse(data)
      updateCourse(course.id, { status: 'in_progress' })
      onCourseCreated(course.id)
    } catch {
      setError('Something went wrong generating the course. Please try again.')
      setStage('input')
    }
  }

  function handleOptionPick(option) {
    setGoal(option)
    setStage('input')
    setClarifyData(null)
  }

  function handleAllOptions() {
    const opts  = clarifyData?.options ?? []
    const combined = opts.length
      ? `${input.trim()} covering: ${opts.join(', ')}`
      : input.trim()
    setInput(combined)
    createCourse(combined, goal)
  }

  function handleSkipClarification() {
    const t = input.trim()
    if (!t) return
    setClarifyData(null)
    createCourse(t, goal)
  }

  function handleReset() {
    setStage('input')
    setClarifyData(null)
    setError(null)
  }

  return (
    <div className="max-w-2xl space-y-4">

      {/* ── Section 1: Create from scratch ─────────────────────────── */}
      <div
        className="rounded-2xl border border-teal-500/20 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.12) 0%, rgba(99,102,241,0.07) 100%)' }}
      >
        {/* Top accent bar */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #0d9488 0%, #6366f1 100%)' }} />

        <div className="p-5">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-teal-500/20 border border-teal-400/20">
              <PenLine size={15} className="text-teal-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Create a course</h2>
              <p className="text-xs text-teal-300/70 mt-0.5">
                Any topic · 4–6 lessons · quizzes included
              </p>
            </div>
          </div>

          <p className="text-xs text-white/40 mb-4 mt-2 leading-relaxed">
            Type any subject below and Flow AI will build a beginner-friendly course tailored just for you.
          </p>

          {/* Topic input row */}
          <div className="flex gap-2 mb-3">
            <input
              value={input}
              onChange={(e) => { setInput(e.target.value); if (stage === 'clarifying' || stage === 'picking') handleReset() }}
              onKeyDown={(e) => { if (e.key === 'Enter' && stage !== 'generating') handleGenerate(e.target.value) }}
              placeholder="e.g. How does the immune system work?"
              className="glass-input text-sm flex-1"
              disabled={stage === 'generating'}
            />
            <button
              onClick={() => handleGenerate(input)}
              disabled={stage === 'generating' || !input.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {busy ? (generating ? 'Generating…' : 'Thinking…') : 'Generate'}
            </button>
          </div>

          {/* Learning goal textarea */}
          <div className="mb-1">
            <label className="block text-[11px] font-medium text-white/40 mb-1.5 uppercase tracking-wider">
              What do you want to learn? <span className="normal-case font-normal text-white/25">(optional)</span>
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. I want to understand how to apply this in my daily life, focusing on practical examples…"
              rows={2}
              disabled={stage === 'generating'}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm text-white/80 placeholder-white/20 px-3 py-2.5 resize-none focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20 disabled:opacity-40 transition-colors leading-relaxed"
            />
          </div>

          {error && <p className="mt-2.5 text-xs text-amber-300/90">{error}</p>}

          {/* ── Clarification panel ──────────────────────────────────────── */}
          {(stage === 'clarifying' || stage === 'picking') && (
            <div
              className="mt-3 rounded-xl border border-white/[0.08] overflow-hidden"
              style={{ background: 'rgba(6,8,18,0.60)' }}
            >
              {stage === 'clarifying' ? (
                /* Thinking spinner */
                <div className="flex items-center gap-2.5 px-4 py-3.5">
                  <Loader2 size={13} className="animate-spin text-teal-400 flex-shrink-0" />
                  <span className="text-xs text-white/50">Understanding your topic…</span>
                </div>
              ) : (
                /* Question + options */
                <div className="p-4">
                  <div className="flex items-start gap-2.5 mb-3">
                    <HelpCircle size={14} className="text-teal-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold text-white/85 leading-snug">
                      {clarifyData.question}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {clarifyData.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleOptionPick(opt)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-left border transition-all"
                        style={{
                          borderColor: 'rgba(45,212,191,0.25)',
                          background: 'rgba(13,148,136,0.10)',
                          color: 'rgba(204,251,241,0.85)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(45,212,191,0.55)'
                          e.currentTarget.style.background  = 'rgba(13,148,136,0.22)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(45,212,191,0.25)'
                          e.currentTarget.style.background  = 'rgba(13,148,136,0.10)'
                        }}
                      >
                        {opt}
                      </button>
                    ))}

                    {/* "All" — covers every option in one course */}
                    <button
                      onClick={handleAllOptions}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                      style={{
                        borderColor: 'rgba(99,102,241,0.35)',
                        background: 'rgba(99,102,241,0.12)',
                        color: 'rgba(199,210,254,0.90)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.60)'
                        e.currentTarget.style.background  = 'rgba(99,102,241,0.22)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'
                        e.currentTarget.style.background  = 'rgba(99,102,241,0.12)'
                      }}
                    >
                      All of the above
                    </button>
                  </div>

                  {/* Skip clarification */}
                  <button
                    onClick={handleSkipClarification}
                    className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors"
                  >
                    <ArrowRight size={11} />
                    Generate with &ldquo;{input}&rdquo; as-is
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Progress bar — visible while generating */}
          {(generating || progress > 0) && (
            <div className="mt-3">
              <div className="h-1 w-full rounded-full overflow-hidden bg-white/[0.08]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #0d9488 0%, #6366f1 100%)',
                    transition: 'width 0.25s ease-out',
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-teal-400/80">
                {progress >= 100
                  ? 'Done! Opening your course…'
                  : 'Flow AI is building your course syllabus — this takes about 15–30 seconds…'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-[11px] font-medium text-white/20 uppercase tracking-widest">or</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      {/* ── Section 2: Topics from your FlowMap ─────────────────────── */}
      <div
        className="rounded-2xl border border-indigo-500/20 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(168,85,247,0.07) 100%)' }}
      >
        {/* Top accent bar */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)' }} />

        <div className="p-5">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/20">
              <BookMarked size={15} className="text-indigo-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {isPersonalised ? 'From your FlowMap interests' : 'Suggested topics'}
              </h2>
              <p className="text-xs text-indigo-300/70 mt-0.5">
                {isPersonalised ? 'Based on topics you follow & search' : 'Popular beginner topics'}
              </p>
            </div>
          </div>

          <p className="text-xs text-white/40 mb-4 mt-2 leading-relaxed">
            {isPersonalised
              ? 'Click any topic to instantly generate a course from your existing interests.'
              : 'Click any topic below to instantly generate a beginner course.'}
          </p>

          <div className="flex flex-wrap gap-2">
            {suggestedTopics.map((topic) => (
              <button
                key={topic}
                onClick={() => { setInput(topic); handleGenerate(topic) }}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-400/20 bg-indigo-500/10 text-indigo-200/80 hover:border-indigo-400/50 hover:bg-indigo-500/20 hover:text-indigo-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      {onImportClick && (
        <>
          <div className="flex items-center gap-3 px-1">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[11px] font-medium text-white/20 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* ── Section 3: Import a shared course ───────────────────────── */}
          <div
            className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.025)' }}
          >
            <div className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08] flex-shrink-0">
                  <Download size={15} className="text-white/40" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white/70">Import a shared course</h2>
                  <p className="text-xs text-white/30 mt-0.5">
                    Open a .json package someone shared with you
                  </p>
                </div>
              </div>
              <button
                onClick={onImportClick}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.11)',
                  color: 'rgba(255,255,255,0.55)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.10)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.80)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.11)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                }}
              >
                <Download size={12} /> Import
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Ollama not enabled warning ───────────────────────────────── */}
      {!OLLAMA_CONFIG.enabled && (
        <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-500/5">
          <p className="text-amber-200/90 font-medium mb-1 text-sm">Ollama is not enabled</p>
          <p className="text-amber-200/60 text-xs leading-relaxed">
            Flow Academy uses your local Ollama AI to generate courses. Enable Ollama in Settings
            and make sure the Docker container is running.
          </p>
          <code className="block mt-2 text-[11px] text-amber-200/50 font-mono break-all">
            docker run -d -p 11434:11434 -v ollama:/root/.ollama --name ollama ollama/ollama
          </code>
        </div>
      )}

    </div>
  )
}
