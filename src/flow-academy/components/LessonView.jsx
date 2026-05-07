import { useEffect, useMemo, useState } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { Loader2, BookOpen, Target, Lightbulb, RotateCcw, Play, FileText } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import { generateLessonContent } from '../courseGenerator.js'
import VideoPlayerModal from '../../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../../components/content/ArticleReader.jsx'

// ── Glossary tooltip ──────────────────────────────────────────────────────────
// Wraps a recognised term in a dashed underline; shows its definition on hover.
function GlossaryTerm({ term, definition }) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="border-b border-dashed border-indigo-300/60 cursor-help">
        {term}
      </span>
      {visible && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-56 p-3 rounded-xl text-xs text-white/90 leading-relaxed z-50 pointer-events-none"
          style={{
            background: 'rgba(12,14,26,0.97)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid rgba(99,102,241,0.18)',
          }}
        >
          <span className="block font-semibold text-teal-300 mb-1">{term}</span>
          {definition}
          {/* downward arrow */}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid rgba(12,14,26,0.97)' }}
          />
        </span>
      )}
    </span>
  )
}

// ── Escape helper for building term-match regex ───────────────────────────────
function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Inline code style ─────────────────────────────────────────────────────────
const INLINE_CODE_STYLE = { background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.18)', color: '#4338ca' }
const INLINE_CODE_CLASS = 'px-1.5 py-0.5 rounded-md font-mono text-[0.85em] border'

// Detects code-like tokens in plain prose that the AI didn't wrap in backticks:
//   • .method() / .method(args)  — dot-notation calls  e.g. .items(), .keys()
//   • snake_case identifiers     — e.g. my_dict, squared_numbers
// Split uses a capture group so odd-indexed segments are the matched tokens.
const AUTO_CODE_RE = /(\.[a-zA-Z_]\w*\([^)]{0,30}\)|[a-z_][a-z0-9]*(?:_[a-z0-9]+)+)/

function InlineCode({ children, codeKey }) {
  return (
    <code key={codeKey} className={INLINE_CODE_CLASS} style={INLINE_CODE_STYLE}>
      {children}
    </code>
  )
}

// ── Inline backtick → <code> renderer + optional glossary highlighting ────────
// glossary: { [term.toLowerCase()]: definition } — pass {} to skip highlighting.
// usedTerms: Set shared across all calls for this lesson (first-occurrence only).
function renderText(text, glossary = {}, usedTerms = new Set()) {
  const terms = Object.keys(glossary)

  // Level 1 — split on explicit backtick code spans
  const backtickParts = String(text).split(/(`[^`\n]+`)/)

  return backtickParts.flatMap((part, i) => {
    // Explicit backtick code — never scan further inside
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return [<InlineCode key={`bt${i}`}>{part.slice(1, -1)}</InlineCode>]
    }

    // Level 2 — scan prose for glossary terms (first occurrence only)
    let glossaryParts
    if (terms.length) {
      const sorted  = [...terms].sort((a, b) => b.length - a.length)
      const pattern = new RegExp(`(\\b(?:${sorted.map(escapeRe).join('|')})\\b)`, 'gi')
      glossaryParts = part.split(pattern)
    } else {
      glossaryParts = [part]
    }

    return glossaryParts.flatMap((sp, j) => {
      const gkey  = `${i}-${j}`
      const lower = sp.toLowerCase()
      const def   = glossary[lower]

      // Glossary term — render tooltip, skip further scanning
      if (def && !usedTerms.has(lower)) {
        usedTerms.add(lower)
        return [<GlossaryTerm key={gkey} term={sp} definition={def} />]
      }

      // Level 3 — auto-detect code patterns in remaining plain prose
      // (.method(), snake_case_identifiers) that AI forgot to backtick-wrap
      const codeParts = sp.split(AUTO_CODE_RE)
      if (codeParts.length <= 1) return [<span key={gkey}>{sp}</span>]

      return codeParts.map((cp, k) => {
        if (!cp) return null
        const ck = `${gkey}-${k}`
        // Odd indices are the captured code tokens
        return k % 2 === 1
          ? <InlineCode key={ck}>{cp}</InlineCode>
          : <span key={ck}>{cp}</span>
      }).filter(Boolean)
    })
  })
}

// ── Dark code block with line numbers ─────────────────────────────────────────
const LESSON_THEME = {
  ...themes.vsDark,
  plain: { ...themes.vsDark.plain, backgroundColor: '#1a1d2e' },
}

function CodeBlock({ code, language }) {
  const lang = language || 'python'
  return (
    <div className="rounded-xl overflow-hidden font-mono text-sm" style={{ background: '#1a1d2e' }}>
      {/* macOS-style header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.05]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
          <div className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
          <div className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
        </div>
        {language && (
          <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {language}
          </span>
        )}
      </div>
      {/* Highlighted lines */}
      <Highlight theme={LESSON_THEME} code={String(code || '').trimEnd()} language={lang}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <div className="overflow-x-auto p-4">
            <table className="border-collapse w-full">
              <tbody>
                {tokens.map((line, i) => (
                  <tr key={i} className="leading-7" {...getLineProps({ line })}>
                    <td
                      className="pr-5 text-right select-none align-top w-8"
                      style={{ color: 'rgba(255,255,255,0.18)', fontVariantNumeric: 'tabular-nums', fontSize: '11px', minWidth: '2rem' }}
                    >
                      {i + 1}
                    </td>
                    <td className="align-top whitespace-pre">
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Highlight>
    </div>
  )
}

// ── Legacy example parser ─────────────────────────────────────────────────────
// Old lessons stored examples as plain strings with code embedded inline.
// This extracts code blocks by heuristic so they always render as CodeBlock.

function isCodeLine(line) {
  const t = line.trim()
  if (!t) return false
  if (t.startsWith('#')) return true   // comment
  // Common code keywords at start of line
  if (/^(def |elif |else:|for |while |try:|except|import |from |return |class |print\(|with |if [a-z_])/.test(t)) return true
  // Assignment: lowercase_name = ...
  if (/^[a-z_]\w*\s*(\[.*\])?\s*=(?!=)/.test(t)) return true
  // Function call as statement: name(...)
  if (/^[a-z_]\w*\s*\(/.test(t)) return true
  // Indented (continuation lines inside a block)
  if (/^(\s{2,}|\t)/.test(line) && t.length > 0) return true
  return false
}

function parseExampleText(raw) {
  // Strip leading "Example N:" / "Example N." prefix the AI sometimes adds
  const text = raw.replace(/^Example\s+\d+[:.]\s*/i, '').trim()
  const blocks = text.split(/\n{2,}/)
  const segments = []
  for (const block of blocks) {
    if (!block.trim()) continue
    const lines     = block.split('\n')
    const nonEmpty  = lines.filter((l) => l.trim())
    const codeLikes = nonEmpty.filter(isCodeLine)
    const isCode    = nonEmpty.length > 0 && codeLikes.length / nonEmpty.length >= 0.5
    segments.push({ type: isCode ? 'code' : 'prose', content: block.trim() })
  }
  return segments
}

// Stop words that don't help with relevance matching
const STOP_WORDS = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'have', 'will', 'your', 'how', 'what', 'into', 'they', 'not', 'its', 'been'])

function useRelatedItems(course, lesson) {
  const { saves } = useStore()
  return useMemo(() => {
    const allSaves = Object.values(saves || {})
    if (!allSaves.length) return []

    const tokenize = (str) =>
      String(str || '').toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w))

    const topicKws  = new Set(tokenize(course.topic))
    const courseKws = new Set(tokenize(course.title))

    // Lesson-specific keywords: title + objectives + summary + (if generated)
    // explanation text and glossary terms. The richer the pool, the more precise
    // the match — so this improves automatically once a lesson has been generated.
    const lessonKws = new Set([
      ...tokenize(lesson.title),
      ...(lesson.objectives || []).flatMap(tokenize),
      ...(lesson.summary ? tokenize(lesson.summary) : []),
      // Post-generation: explanation text provides rich domain-specific vocabulary
      ...(lesson.explanation ? tokenize(lesson.explanation).filter((w) => w.length > 4) : []),
      // Glossary keys are precise terms explicitly defined in this lesson
      ...(lesson.glossary ? Object.keys(lesson.glossary).flatMap(tokenize) : []),
    ])
    // Strip broad topic/course terms so they can't inflate the lesson score
    for (const kw of topicKws)  lessonKws.delete(kw)
    for (const kw of courseKws) lessonKws.delete(kw)

    if (!topicKws.size && !lessonKws.size) return []

    return allSaves
      .map(({ item }) => {
        if (!item?.title) return null
        const haystack = `${item.title} ${item.summary || item.excerpt || ''}`.toLowerCase()

        let lessonScore = 0
        let broadScore  = 0
        for (const kw of lessonKws) if (haystack.includes(kw)) lessonScore += 3
        for (const kw of topicKws)  if (haystack.includes(kw)) broadScore  += 2
        for (const kw of courseKws) if (haystack.includes(kw)) broadScore  += 1

        // Hard gates:
        // 1. Must hit at least 3 lesson-specific keywords (lessonScore >= 9) — raised
        //    from 6 to prevent tangential content from passing on generic terms.
        // 2. Must also match the course topic with at least 2 hits (broadScore >= 4)
        //    so content from unrelated domains can't slip through on shared vocabulary.
        if (lessonScore < 9) return null
        if (broadScore  < 4) return null
        return { item, score: lessonScore + broadScore }
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ item }) => item)
  }, [saves, course.topic, course.title, lesson.title, lesson.objectives, lesson.summary, lesson.explanation, lesson.glossary])
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
          course.goal,
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
      course.title, lesson.title, lesson.objectives, lesson.order, course.lessons.length, course.goal,
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

  // Glossary lookup + shared set so each term is only highlighted on first use.
  const glossary  = lesson.glossary || {}
  const usedTerms = new Set()

  // Primary language for inline code blocks detected in the explanation text.
  const primaryLanguage = lesson.examples?.find(e => e?.language)?.language || 'python'

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
        {/* Main explanation — each paragraph is either prose or a code block */}
        <div className="mb-7 space-y-4">
          {paragraphs.flatMap((para, i) => {
            // Run the same heuristic used for legacy example strings so code
            // blocks embedded in explanation text are lifted out and highlighted.
            const segments = parseExampleText(para)
            return segments.map((seg, j) =>
              seg.type === 'code'
                ? <CodeBlock key={`${i}-${j}`} code={seg.content} language={primaryLanguage} />
                : <p key={`${i}-${j}`}>{renderText(seg.content, glossary, usedTerms)}</p>
            )
          })}
        </div>

        {/* Examples — description + optional dark code block */}
        {lesson.examples && lesson.examples.length > 0 && (
          <div className="mb-7">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-sans)' }}>
              <Lightbulb size={11} /> Examples
            </h3>
            <div className="space-y-4">
              {lesson.examples.map((ex, i) => {
                let description, code, language

                if (typeof ex === 'object' && ex !== null) {
                  // New structured format
                  description = String(ex.description || '').replace(/^Example\s+\d+[:.]\s*/i, '').trim()
                  code        = ex.code ? String(ex.code).trim() : null
                  language    = ex.language || null
                } else {
                  // Legacy plain-string format — extract embedded code blocks by heuristic
                  const segments   = parseExampleText(String(ex))
                  const proseParts = segments.filter((s) => s.type === 'prose').map((s) => s.content)
                  const codeParts  = segments.filter((s) => s.type === 'code').map((s) => s.content)
                  description = proseParts.join(' ').trim()
                  code        = codeParts.length ? codeParts.join('\n\n') : null
                  language    = null
                }

                return (
                  <div key={i} className="rounded-xl border border-indigo-100 overflow-hidden">
                    {/* Description strip — regular weight; container already provides separation */}
                    <div className="px-5 py-4 bg-indigo-50">
                      <p className="text-sm leading-relaxed text-slate-700">
                        <span
                          className="font-bold text-indigo-600 mr-2"
                          style={{ fontFamily: 'var(--font-sans)' }}
                        >
                          Example {i + 1}.
                        </span>
                        {renderText(description, glossary, usedTerms)}
                      </p>
                    </div>
                    {/* Dark code block */}
                    {code && (
                      <div className="p-3 border-t border-indigo-100" style={{ background: '#f8f9fc' }}>
                        <CodeBlock code={code} language={language} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick recap */}
        {lesson.recap && (
          <div className="mb-9 p-5 rounded-xl border border-slate-200 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-sans)' }}>
              <BookOpen size={11} /> Quick recap
            </h3>
            <p>{renderText(lesson.recap, glossary, usedTerms)}</p>
          </div>
        )}
      </div>

      {/* Related from your FlowMap — only shown when there are strong matches */}
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

      {/* Search YouTube for topic videos */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Find videos on this topic
        </h3>
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(lesson.title + ' ' + course.topic)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-left flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-white/80 hover:border-slate-300 hover:bg-white transition-all group"
        >
          <div className="flex-shrink-0 p-1.5 rounded-lg bg-red-50 text-red-500">
            <Play size={12} className="fill-current" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 leading-snug">Search YouTube: "{lesson.title}"</p>
            <p className="text-xs text-slate-500 mt-0.5">Opens YouTube search for this lesson topic</p>
          </div>
          <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-600 flex-shrink-0 mt-0.5 uppercase tracking-wide transition-colors">
            Open ↗
          </span>
        </a>
      </div>

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
