import { useRef, useState } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'
import { scoreQuiz } from '../quizEngine.js'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import { streamChat } from '../../lib/llm/ollama.js'

// ── Quiz question code-block helpers ─────────────────────────────────────────
// Question text sometimes embeds code after the prose question. These helpers
// split the two apart so the code can be rendered in a proper dark block.

function isCodeLine(line) {
  const t = line.trim()
  if (!t) return false
  if (/^(def |elif |else:|for |while |try:|except|import |from |return |class |print\(|if [a-z_]|with )/.test(t)) return true
  if (/^[a-z_]\w*\s*(\[.*\])?\s*=(?!=)/.test(t)) return true
  if (/^[a-z_]\w*\s*\(/.test(t)) return true
  if (/^(\s{2,}|\t)/.test(line) && t.length > 0) return true
  return false
}

// Returns { prose, code } — prose is the question sentence, code is the
// embedded snippet (or null if none detected).
function parseQuestionText(raw) {
  const lines = raw.split('\n')
  const proseLines = []
  const codeLines  = []
  let inCode = false

  for (const line of lines) {
    if (!inCode && isCodeLine(line)) inCode = true
    if (inCode) codeLines.push(line)
    else if (line.trim()) proseLines.push(line.trim())
  }

  return {
    prose: proseLines.join(' ').trim(),
    code:  codeLines.length ? codeLines.join('\n').trimEnd() : null,
  }
}

const QUIZ_THEME = {
  ...themes.vsDark,
  plain: { ...themes.vsDark.plain, backgroundColor: '#1a1d2e' },
}

function QuizCodeBlock({ code, language = 'python' }) {
  return (
    <div className="mt-3 rounded-xl overflow-hidden font-mono" style={{ background: '#1a1d2e' }}>
      {/* Traffic-light header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.05]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
        </div>
        <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {language}
        </span>
      </div>

      <Highlight theme={QUIZ_THEME} code={String(code).trimEnd()} language={language}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <div className="px-4 py-3">
            <table className="border-collapse w-full">
              <tbody>
                {tokens.map((line, i) => (
                  <tr key={i} className="leading-6" {...getLineProps({ line })}>
                    <td
                      className="pr-4 text-right select-none align-top"
                      style={{ color: 'rgba(255,255,255,0.18)', fontSize: '11px', minWidth: '1.5rem', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {i + 1}
                    </td>
                    <td className="align-top text-[13px] whitespace-pre-wrap break-words">
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

// ── Per-question AI chat ───────────────────────────────────────────────────────
// Lets the student ask clarifying questions about the concept being tested.
// The system prompt deliberately withholds the correct answer so the chat
// helps them reason rather than just giving it away.

function QuestionChat({ lesson, question }) {
  const [open, setOpen]         = useState(false)
  const [input, setInput]       = useState('')
  const [messages, setMessages] = useState([])   // [{role, content}]
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy]         = useState(false)
  const inputRef = useRef(null)
  const bottomRef = useRef(null)

  const systemMsg = {
    role: 'system',
    content:
      `You are a concise teaching assistant for Flow Academy. ` +
      `The student is learning about: "${lesson.title}".\n\n` +
      `They are answering this quiz question:\n"${question.question}"\n\n` +
      `Answer options:\n` +
      question.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n') +
      `\n\nYour job: help the student understand the CONCEPT being tested — ` +
      `do NOT reveal which answer is correct or eliminate wrong options. ` +
      `Explain the relevant idea, clarify terminology, or give a real-world analogy. ` +
      `Be brief: 2–3 sentences maximum.`,
  }

  async function send() {
    const text = input.trim()
    if (!text || busy) return

    const userMsg = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setBusy(true)
    setStreaming('')

    let full = ''
    try {
      for await (const chunk of streamChat([systemMsg, ...history], { temperature: 0.65, num_ctx: 4096 })) {
        full += chunk
        setStreaming(full)
      }
    } catch { /* silently fail — streaming errors already handled inside streamChat */ }

    setMessages((prev) => [...prev, { role: 'assistant', content: full || 'Sorry, I could not connect to Flow AI. Make sure Ollama is running.' }])
    setStreaming('')
    setBusy(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function handleOpen() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  // ── Collapsed toggle ─────────────────────────────────────────────────────────
  if (!open) {
    return (
      <div className="mt-4 pt-3.5 border-t border-slate-100">
        <button
          onClick={handleOpen}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-500 transition-colors"
        >
          <MessageCircle size={12} />
          Ask Flow AI about this question
        </button>
      </div>
    )
  }

  // ── Expanded chat ────────────────────────────────────────────────────────────
  return (
    <div className="mt-4 pt-3.5 border-t border-slate-100">
      {/* Message thread */}
      {(messages.length > 0 || streaming) && (
        <div
          className="mb-3 space-y-2.5 overflow-y-auto"
          style={{ maxHeight: '18rem', scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.25) transparent' }}
        >
          {messages.map((m, i) => (
            m.role === 'user' ? (
              /* User bubble — right-aligned */
              <div key={i} className="flex justify-end">
                <div
                  className="max-w-[78%] rounded-2xl rounded-tr-sm px-3 py-2 text-xs leading-relaxed text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                >
                  {m.content}
                </div>
              </div>
            ) : (
              /* AI bubble — left-aligned */
              <div key={i} className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide ml-1">Flow AI</span>
                <div
                  className="rounded-2xl rounded-tl-sm px-3 py-2.5 text-xs leading-relaxed text-slate-700"
                  style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.13)' }}
                >
                  {m.content}
                </div>
              </div>
            )
          ))}

          {/* Streaming response */}
          {streaming && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide ml-1">Flow AI</span>
              <div
                className="rounded-2xl rounded-tl-sm px-3 py-2.5 text-xs leading-relaxed text-slate-700"
                style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.13)' }}
              >
                {streaming}
                <span className="inline-block w-1.5 h-3 rounded-sm bg-indigo-400 ml-0.5 align-middle animate-pulse" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-1.5 items-center">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={OLLAMA_CONFIG.enabled ? 'Ask about this concept…' : 'Ollama is not enabled'}
          disabled={busy || !OLLAMA_CONFIG.enabled}
          className="flex-1 text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-700 placeholder-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
        />
        <button
          onClick={send}
          disabled={!input.trim() || busy || !OLLAMA_CONFIG.enabled}
          className="p-2 rounded-lg text-white flex-shrink-0 transition-colors disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
          title="Send (Enter)"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="p-2 rounded-lg text-slate-300 hover:text-slate-500 flex-shrink-0 transition-colors"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

// ── QuizView ───────────────────────────────────────────────────────────────────

export default function QuizView({ lesson, onSubmit }) {
  const { quiz } = lesson
  const [answers, setAnswers]     = useState({})
  const [submitted, setSubmitted] = useState(false)

  // Derive the primary code language from the lesson examples so quiz code
  // blocks use the correct syntax highlighting (defaults to 'python').
  const primaryLanguage = lesson.examples?.find(e => e?.language)?.language || 'python'

  if (!quiz) return null

  const allAnswered    = quiz.questions.every((q) => answers[q.id] !== undefined)
  const answeredCount  = Object.keys(answers).length

  function handleSubmit() {
    if (!allAnswered || submitted) return
    const result = scoreQuiz(quiz.questions, answers)
    setSubmitted(true)
    onSubmit(result)
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-7">
        <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-1.5">Quiz</p>
        <h2 className="text-2xl font-bold text-slate-900">{lesson.title}</h2>
        <p className="text-sm text-slate-600 mt-1.5">
          Answer all {quiz.questions.length} questions. You need {quiz.passingScore}% to pass.
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-5 mb-9">
        {quiz.questions.map((q, qi) => {
          const { prose, code } = parseQuestionText(q.question)
          return (
          <div
            key={q.id}
            className="p-5 rounded-xl border border-slate-200 bg-white/70 shadow-xs"
          >
            <div className="mb-4">
              <p className="text-[15px] font-semibold text-slate-900 leading-snug">
                <span className="text-slate-400 font-normal mr-2">{qi + 1}.</span>
                {prose}
              </p>
              {code && <QuizCodeBlock code={code} language={primaryLanguage} />}
            </div>

            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const selected = answers[q.id] === oi
                return (
                  <button
                    key={oi}
                    onClick={() => !submitted && setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                    disabled={submitted}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      selected
                        ? 'border-teal-400 bg-teal-50 text-teal-900 font-medium shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    <span className={`mr-2 font-semibold ${selected ? 'text-teal-600' : 'text-slate-400'}`}>
                      {String.fromCharCode(65 + oi)}.
                    </span>
                    {opt}
                  </button>
                )
              })}
            </div>

            {/* Per-question AI chat — hidden until toggled */}
            {!submitted && <QuestionChat lesson={lesson} question={q} />}
          </div>
          )
        })}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitted}
        className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all ${
          allAnswered && !submitted
            ? 'text-white shadow-sm hover:opacity-90'
            : 'text-slate-400 bg-slate-200 cursor-not-allowed'
        }`}
        style={allAnswered && !submitted
          ? { background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }
          : undefined}
      >
        {submitted
          ? 'Submitted'
          : allAnswered
          ? 'Submit answers'
          : `Answer all questions to continue (${answeredCount} / ${quiz.questions.length})`}
      </button>
    </div>
  )
}
