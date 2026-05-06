import { useRef } from 'react'
import { CheckCircle, XCircle, RotateCcw, ArrowRight } from 'lucide-react'
import { useStore } from '../../store/useStore.js'

export default function QuizResults({ course, lesson, result, onRetry, onContinue, onBackToSyllabus }) {
  const { updateLesson, updateCourse } = useStore()
  const { score, passed, correct, total, missedIndexes } = result

  // Persist exactly once — ref prevents double-write in React strict mode.
  const persisted = useRef(false)
  if (!persisted.current) {
    persisted.current = true
    const now = new Date().toISOString()
    const prevBest = lesson.bestScore ?? -1
    const newBest = Math.max(prevBest, score)

    if (passed) {
      updateLesson(course.id, lesson.id, { status: 'passed', bestScore: newBest, lastAttemptAt: now })
      const nextLesson = course.lessons.find((l) => l.order === lesson.order + 1)
      if (nextLesson && nextLesson.status === 'locked') {
        updateLesson(course.id, nextLesson.id, { status: 'unlocked' })
      }
      const allPassed = course.lessons.every((l) => l.id === lesson.id || l.status === 'passed')
      if (allPassed) updateCourse(course.id, { status: 'completed', completedAt: now })
    } else {
      updateLesson(course.id, lesson.id, { bestScore: newBest, lastAttemptAt: now })
    }
  }

  const missedQuestions = lesson.quiz
    ? missedIndexes.map((i) => lesson.quiz.questions[i]).filter(Boolean)
    : []

  const allNowPassed = course.lessons.every((l) => l.id === lesson.id ? passed : l.status === 'passed')

  return (
    <div className="max-w-2xl">
      {/* Score hero */}
      <div className={`mb-7 p-8 rounded-2xl border text-center ${
        passed
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-amber-200 bg-amber-50'
      }`}>
        {passed
          ? <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
          : <XCircle size={40} className="mx-auto mb-3 text-amber-500" />}
        <p className="text-4xl font-bold text-slate-900 mb-1">{score}%</p>
        <p className="text-sm text-slate-600">
          {correct} correct out of {total} questions
        </p>
        <p className={`text-sm font-semibold mt-2 ${passed ? 'text-emerald-700' : 'text-amber-700'}`}>
          {passed ? '✓ Passed!' : '✗ Not quite — you need 70% to pass'}
        </p>
      </div>

      {/* Course completion banner */}
      {passed && allNowPassed && (
        <div className="mb-7 p-5 rounded-xl border border-teal-200 bg-teal-50 text-center">
          <p className="text-sm font-semibold text-teal-800">🎓 Course complete! All lessons passed.</p>
        </div>
      )}

      {/* Retry encouragement + missed answers */}
      {!passed && missedQuestions.length > 0 && (
        <div className="mb-7">
          <p className="text-sm font-semibold text-slate-800 mb-3">
            You are close. Review these ideas first, then try again:
          </p>
          <div className="space-y-3">
            {missedQuestions.map((q) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-slate-200 bg-white/70"
              >
                <p className="text-sm font-medium text-slate-800 mb-1">{q.question}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{q.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {passed && !allNowPassed && (
          <button
            onClick={onContinue}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
          >
            Continue to next lesson <ArrowRight size={14} />
          </button>
        )}
        {passed && allNowPassed && (
          <button
            onClick={onBackToSyllabus}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
          >
            View completed course
          </button>
        )}
        {!passed && (
          <button
            onClick={onRetry}
            className="w-full py-3.5 rounded-xl text-sm font-semibold bg-slate-800 text-white flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors"
          >
            <RotateCcw size={14} /> Review lesson and retry quiz
          </button>
        )}
        <button
          onClick={onBackToSyllabus}
          className="text-sm text-slate-500 hover:text-slate-800 transition-colors text-center py-2"
        >
          Back to course overview
        </button>
      </div>
    </div>
  )
}
