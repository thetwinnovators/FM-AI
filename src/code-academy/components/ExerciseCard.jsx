import { CheckCircle2, ArrowRight } from 'lucide-react'

/**
 * Shows the current exercise prompt, success indicator, and Next button.
 */
export default function ExerciseCard({ exercise, exerciseIndex, totalExercises, validationResult, onNext }) {
  const passed = validationResult?.passed === true

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors ${
        passed ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
      }`}
    >
      {/* Exercise header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Exercise {exerciseIndex + 1} of {totalExercises}
        </span>
        {passed && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 size={12} /> Correct!
          </span>
        )}
      </div>

      {/* Prompt */}
      <div className="px-4 py-4">
        <p className="text-sm text-slate-800 leading-relaxed">{exercise.prompt}</p>
      </div>

      {/* Next button — visible only after passing */}
      {passed && (
        <div className="px-4 pb-4">
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
          >
            {exerciseIndex + 1 < totalExercises ? 'Next exercise' : 'Finish lesson'}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
