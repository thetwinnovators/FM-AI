import { useEffect, useMemo, useState } from 'react'
import { Loader2, BookOpen, Target, Lightbulb, RotateCcw, Play, FileText } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import { generateLessonContent } from '../courseGenerator.js'
import VideoPlayerModal from '../../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../../components/content/ArticleReader.jsx'

// Stop words that don't help with relevance matching
const STOP_WORDS = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'have', 'will', 'your', 'how', 'what', 'into', 'they', 'not', 'its', 'been'])

function useRelatedItems(course, lesson) {
  const { saves } = useStore()
  return useMemo(() => {
    const allSaves = Object.values(saves || {})
    if (!allSaves.length) return []

    const tokenize = (str) =>
      String(str || '').toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w))

    // Build weighted keyword set: lesson-specific terms matter more
    const topicKws   = new Set(tokenize(course.topic))
    const lessonKws  = new Set([...tokenize(lesson.title), ...(lesson.objectives || []).flatMap(tokenize)])
    const courseKws  = new Set(tokenize(course.title))

    if (!topicKws.size && !lessonKws.size) return []

    return allSaves
      .map(({ item }) => {
        if (!item?.title) return null
        const haystack = `${item.title} ${item.summary || item.excerpt || ''}`.toLowerCase()
        let score = 0
        // Lesson-specific keywords score 3× — ensures lesson relevance, not just topic
        for (const kw of lessonKws)  if (haystack.includes(kw)) score += 3
        for (const kw of topicKws)   if (haystack.includes(kw)) score += 2
        for (const kw of courseKws)  if (haystack.includes(kw)) score += 1
        return score >= 2 ? { item, score } : null   // minimum threshold
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ item }) => item)
  }, [saves, course.topic, course.title, lesson.title, lesson.objectives])
}

export default function LessonView({ course, lesson, onTakeQuiz }) {
  const { updateLesson, updateCourse } = useStore()
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)
  const relatedItems = useRelatedItems(course, lesson)
  const [openVideo, setOpenVideo]     = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  function openItem(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  // Lazy-generate lesson content the first time the lesson is opened.
  useEffect(() => {
    if (lesson.explanation) return
    if (!OLLAMA_CONFIG.enabled) return

    let cancelled = false

    async function generate() {
      setGenerating(true)
      setGenError(null)
      try {
        const content = await generateLessonContent(
          course.title,
          lesson.title,
          lesson.objectives,
          lesson.order,
          course.lessons.length,
        )
        if (cancelled) return
        if (!content) {
          setGenError('Could not generate lesson content. Make sure Ollama is running and a model is pulled, then try again.')
          return
        }
        updateLesson(course.id, lesson.id, content)
        if (course.status === 'draft') updateCourse(course.id, { status: 'in_progress' })
      } catch {
        if (!cancelled) setGenError('Something went wrong. Go back and try opening this lesson again.')
      } finally {
        if (!cancelled) setGenerating(false)
      }
    }

    generate()
    return () => { cancelled = true }
  }, [lesson.id])

  function handleRetry() {
    setGenError(null)
    if (!OLLAMA_CONFIG.enabled) return
    setGenerating(true)
    generateLessonContent(
      course.title, lesson.title, lesson.objectives, lesson.order, course.lessons.length,
    ).then((content) => {
      if (!content) { setGenError('Still could not generate. Check Ollama is running.'); setGenerating(false); return }
      updateLesson(course.id, lesson.id, content)
      if (course.status === 'draft') updateCourse(course.id, { status: 'in_progress' })
      setGenerating(false)
    }).catch(() => { setGenError('Something went wrong. Try again.'); setGenerating(false) })
  }

  // ── States ────────────────────────────────────────────────────────────────────

  if (!OLLAMA_CONFIG.enabled && !lesson.explanation) {
    return (
      <div className="max-w-2xl py-12 text-center">
        <p className="text-sm text-amber-700 mb-2 font-medium">Ollama is not enabled.</p>
        <p className="text-xs text-slate-500">
          Enable Ollama in Settings and make sure the Docker container is running to generate lesson content.
        </p>
      </div>
    )
  }

  if (generating) {
    return (
      <div className="max-w-2xl flex flex-col items-center justify-center py-24 gap-5">
        <div className="relative flex items-center justify-center w-16 h-16">
          <div
            className="absolute inset-0 rounded-full bg-teal-100 animate-ping"
            style={{ animationDuration: '1.8s' }}
          />
          <div className="absolute inset-0 rounded-full border border-teal-200" />
          <Loader2 size={30} className="animate-spin text-teal-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800">Writing your lesson…</p>
          <p className="text-xs text-slate-500 mt-1">
            Flow AI is crafting a beginner-friendly explanation just for you.
          </p>
        </div>
      </div>
    )
  }

  if (genError) {
    return (
      <div className="max-w-2xl py-12 text-center">
        <p className="text-sm text-amber-700 mb-4">{genError}</p>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors"
          onClick={handleRetry}
        >
          <RotateCcw size={13} /> Retry
        </button>
      </div>
    )
  }

  if (!lesson.explanation) return null

  // Split explanation on double-newlines; fall back to single newlines if the
  // model only used \n between paragraphs (common with smaller local models).
  const paragraphs = lesson.explanation.includes('\n\n')
    ? lesson.explanation.split('\n\n').filter(Boolean)
    : lesson.explanation.split('\n').filter(Boolean)

  // ── Lesson content ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">
      {/* Lesson header */}
      <div className="mb-7">
        <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-1.5">
          Lesson {lesson.order + 1} of {course.lessons.length}
        </p>
        <h2 className="text-2xl font-bold text-slate-900">{lesson.title}</h2>
      </div>

      {/* What you will learn */}
      {lesson.objectives.length > 0 && (
        <div className="mb-7 p-5 rounded-xl bg-teal-50 border border-teal-100">
          <h3 className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Target size={11} /> What you will learn
          </h3>
          <ul className="space-y-2">
            {lesson.objectives.map((obj, i) => (
              <li key={i} className="text-sm text-slate-700 flex items-start gap-2.5">
                <span className="text-teal-500 font-bold flex-shrink-0 mt-0.5">·</span> {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="lesson-prose">
        {/* Main explanation */}
        <div className="mb-7 space-y-4">
          {paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* Examples */}
        {lesson.examples && lesson.examples.length > 0 && (
          <div className="mb-7">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-sans)' }}>
              <Lightbulb size={11} /> Examples
            </h3>
            <div className="space-y-3">
              {lesson.examples.map((ex, i) => (
                <div
                  key={i}
                  className="p-5 rounded-xl border border-indigo-100 bg-indigo-50 leading-relaxed"
                >
                  <span className="font-semibold text-indigo-600 mr-2" style={{ fontFamily: 'var(--font-sans)', fontSize: '14px' }}>Example {i + 1}.</span>
                  {ex}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick recap */}
        {lesson.recap && (
          <div className="mb-9 p-5 rounded-xl border border-slate-200 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-sans)' }}>
              <BookOpen size={11} /> Quick recap
            </h3>
            <p>{lesson.recap}</p>
          </div>
        )}
      </div>

      {/* Related from your FlowMap */}
      {relatedItems.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Related from your FlowMap
          </h3>
          <div className="space-y-2">
            {relatedItems.map((item) => (
              <button
                key={item.id}
                onClick={() => openItem(item)}
                className="w-full text-left flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-white/80 hover:border-slate-300 hover:bg-white transition-all group"
              >
                <div className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg ${
                  item.type === 'video' ? 'bg-pink-50 text-pink-500' : 'bg-indigo-50 text-indigo-500'
                }`}>
                  {item.type === 'video'
                    ? <Play size={12} className="fill-current" />
                    : <FileText size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate leading-snug">{item.title}</p>
                  {(item.summary || item.excerpt) && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.summary || item.excerpt}</p>
                  )}
                </div>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-600 flex-shrink-0 mt-0.5 uppercase tracking-wide transition-colors">
                  {item.type === 'video' ? 'Watch' : 'Read'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Take quiz CTA */}
      {lesson.quiz && (
        <button
          onClick={onTakeQuiz}
          className="w-full py-3.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
        >
          Take the lesson quiz — {lesson.quiz.questions.length} questions
        </button>
      )}

      {/* Content modals — rendered via portal at document.body */}
      {openVideo   && <VideoPlayerModal item={openVideo}   onClose={() => setOpenVideo(null)} />}
      {openArticle && <ArticleReader    item={openArticle} onClose={() => setOpenArticle(null)} />}
    </div>
  )
}
