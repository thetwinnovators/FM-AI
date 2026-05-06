import { Lock, CheckCircle, Circle, Clock, BookOpen, Target } from 'lucide-react'
import { computePercentComplete } from '../quizEngine.js'

function LessonIcon({ status }) {
  if (status === 'passed')   return <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
  if (status === 'unlocked') return <Circle       size={18} className="text-teal-500 flex-shrink-0" />
  return <Lock size={16} className="text-slate-300 flex-shrink-0" />
}

export default function SyllabusView({ course, onOpenLesson }) {
  const pct = computePercentComplete(course)
  const nextLesson = course.lessons.find((l) => l.status === 'unlocked')

  return (
    <div className="max-w-2xl">
      {/* Course header */}
      <div className="mb-7">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{course.title}</h2>
        <p className="text-base text-slate-600 mt-2 leading-relaxed">{course.summary}</p>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-5 text-[13px] text-slate-500 mb-7 flex-wrap">
        <span className="flex items-center gap-1.5">
          <Clock size={13} className="text-slate-400" /> ~{course.estimatedDurationMinutes} min
        </span>
        <span className="flex items-center gap-1.5">
          <BookOpen size={13} className="text-slate-400" /> {course.lessons.length} lessons
        </span>
        {pct > 0 && (
          <span className="text-teal-600 font-medium">{pct}% complete</span>
        )}
        {course.status === 'completed' && (
          <span className="text-[11px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
            Completed
          </span>
        )}
      </div>

      {/* Progress bar */}
      {pct > 0 && (
        <div className="mb-7 h-2 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Start / Continue button */}
      {nextLesson && (
        <button
          onClick={() => onOpenLesson(course.id, nextLesson.id)}
          className="mb-8 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
        >
          {pct === 0 ? 'Start Lesson 1' : `Continue — ${nextLesson.title}`}
        </button>
      )}

      {/* What you will learn */}
      {course.objectives.length > 0 && (
        <div className="mb-7 p-5 rounded-xl bg-teal-50 border border-teal-100">
          <h3 className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Target size={11} /> What you will learn
          </h3>
          <ul className="space-y-2">
            {course.objectives.map((obj, i) => (
              <li key={i} className="text-sm text-slate-700 flex items-start gap-2.5">
                <span className="text-teal-500 font-bold flex-shrink-0 mt-0.5">✓</span> {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key vocabulary */}
      {course.keyVocabulary.length > 0 && (
        <div className="mb-7">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Key vocabulary
          </h3>
          <div className="flex flex-wrap gap-2">
            {course.keyVocabulary.map((word, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lesson list */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
          Lessons
        </h3>
        <div className="space-y-2">
          {course.lessons.map((lesson, i) => {
            const clickable = lesson.status !== 'locked'
            return (
              <button
                key={lesson.id}
                onClick={() => clickable && onOpenLesson(course.id, lesson.id)}
                disabled={!clickable}
                className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  !clickable
                    ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                    : lesson.status === 'passed'
                    ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300'
                    : 'border-slate-200 bg-white/70 hover:border-teal-300 hover:bg-teal-50/40 shadow-xs'
                }`}
              >
                <div className="mt-0.5">
                  <LessonIcon status={lesson.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-sm font-semibold truncate ${
                      !clickable ? 'text-slate-400' : 'text-slate-900'
                    }`}>
                      {i + 1}. {lesson.title}
                    </p>
                    {lesson.bestScore !== null && (
                      <span className="text-xs font-semibold text-emerald-600 flex-shrink-0 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                        {lesson.bestScore}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{lesson.summary}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
