import { useState } from 'react'
import { Sparkles, Loader2, PenLine, BookMarked } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import { generateCourseSyllabus } from '../courseGenerator.js'

export default function TopicPicker({ suggestedTopics, onCourseCreated, isPersonalised = true }) {
  const { addCourse, updateCourse } = useStore()
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  async function handleGenerate(topic) {
    const t = String(topic || input).trim()
    if (!t) return
    if (!OLLAMA_CONFIG.enabled) {
      setError('Ollama is not enabled. Turn it on in Settings and make sure the Docker container is running.')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const data = await generateCourseSyllabus(t)
      if (!data) {
        setError('Could not generate a course. Make sure Ollama is running and a model is pulled, then try again.')
        return
      }
      const course = addCourse(data)
      updateCourse(course.id, { status: 'in_progress' })
      onCourseCreated(course.id)
    } catch {
      setError('Something went wrong generating the course. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">

      {/* ── Section 1: Create from scratch ─────────────────────────── */}
      <div
        className="rounded-2xl border border-teal-500/20 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.12) 0%, rgba(99,102,241,0.07) 100%)' }}
      >
        {/* Coloured top accent bar */}
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

          {/* Input row */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !generating) handleGenerate(input) }}
              placeholder="e.g. How does the immune system work?"
              className="glass-input text-sm flex-1"
              disabled={generating}
            />
            <button
              onClick={() => handleGenerate(input)}
              disabled={generating || !input.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? 'Generating…' : 'Generate'}
            </button>
          </div>

          {error && <p className="mt-2.5 text-xs text-amber-300/90">{error}</p>}
          {generating && (
            <p className="mt-2.5 text-xs text-teal-400/80">
              Flow AI is building your course syllabus — this takes about 15–30 seconds…
            </p>
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
        {/* Coloured top accent bar */}
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
                disabled={generating}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-400/20 bg-indigo-500/10 text-indigo-200/80 hover:border-indigo-400/50 hover:bg-indigo-500/20 hover:text-indigo-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>

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
