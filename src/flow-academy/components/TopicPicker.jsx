import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
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
    <div className="max-w-2xl">
      {/* Manual input */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-white/80 mb-2">
          What do you want to learn?
        </label>
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
            className="btn flex items-center gap-2 px-4 disabled:opacity-40"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-amber-300/90">{error}</p>
        )}
        {generating && (
          <p className="mt-2 text-xs text-teal-400/80">
            Flow AI is building your course syllabus. This takes about 15–30 seconds…
          </p>
        )}
      </div>

      {/* Suggested topics */}
      <div>
        <p className="text-xs font-medium text-[color:var(--color-text-tertiary)] uppercase tracking-wide mb-3">
          {isPersonalised ? 'Based on your topics and interests' : 'Or pick a suggested topic'}
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestedTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => { setInput(topic); handleGenerate(topic) }}
              disabled={generating}
              className="px-3 py-1.5 rounded-lg text-sm border border-white/[0.08] text-[color:var(--color-text-secondary)] hover:border-teal-400/40 hover:text-teal-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* Ollama not enabled warning */}
      {!OLLAMA_CONFIG.enabled && (
        <div className="mt-8 p-4 rounded-xl border border-amber-400/20 bg-amber-500/5">
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
