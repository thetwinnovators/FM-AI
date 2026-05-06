import { useState } from 'react'
import { scoreQuiz } from '../quizEngine.js'

export default function QuizView({ lesson, onSubmit }) {
  const { quiz } = lesson
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  if (!quiz) return null

  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined)
  const answeredCount = Object.keys(answers).length

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
        {quiz.questions.map((q, qi) => (
          <div
            key={q.id}
            className="p-5 rounded-xl border border-slate-200 bg-white/70 shadow-xs"
          >
            <p className="text-[15px] font-semibold text-slate-900 mb-4 leading-snug">
              <span className="text-slate-400 font-normal mr-2">{qi + 1}.</span>
              {q.question}
            </p>
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
          </div>
        ))}
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
