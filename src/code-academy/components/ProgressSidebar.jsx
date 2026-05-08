import { Target, AlertTriangle, Loader2, Bot } from 'lucide-react'

/**
 * Right-side panel showing:
 * - Lesson objectives
 * - Exercise progress dots
 * - AI feedback (error explanation)
 * - Common mistakes
 */
export default function ProgressSidebar({ lesson, exerciseIndex, exercisesTotal, aiFeedback, isFetchingFeedback }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Lesson objectives */}
      {lesson && lesson.objectives.length > 0 && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 uppercase tracking-wider mb-3">
            <Target size={12} /> Lesson goals
          </h3>
          <ul className="space-y-2">
            {lesson.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-teal-900 leading-relaxed">
                <span className="text-teal-500 font-bold flex-shrink-0 mt-0.5">·</span>
                {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Exercise progress dots */}
      {exercisesTotal > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Progress
          </h3>
          <div className="flex items-center gap-2">
            {Array.from({ length: exercisesTotal }).map((_, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
                style={{
                  background: i < exerciseIndex
                    ? 'linear-gradient(135deg, #0d9488, #6366f1)'
                    : i === exerciseIndex
                    ? 'rgba(13,148,136,0.15)'
                    : 'rgba(0,0,0,0.05)',
                  color: i < exerciseIndex ? '#fff' : i === exerciseIndex ? '#0d9488' : '#94a3b8',
                  border: i === exerciseIndex ? '2px solid #0d9488' : '2px solid transparent',
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI feedback */}
      {(isFetchingFeedback || aiFeedback) && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 uppercase tracking-wider mb-3">
            <Bot size={12} /> Flow AI says
          </h3>
          {isFetchingFeedback ? (
            <div className="flex items-center gap-2 text-xs text-indigo-600">
              <Loader2 size={12} className="animate-spin" />
              Thinking…
            </div>
          ) : (
            <p className="text-xs text-indigo-900 leading-relaxed">{aiFeedback}</p>
          )}
        </div>
      )}

      {/* Common mistakes */}
      {lesson && lesson.commonMistakes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-3">
            <AlertTriangle size={12} /> Common mistakes
          </h3>
          <ul className="space-y-2">
            {lesson.commonMistakes.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-900 leading-relaxed">
                <span className="text-amber-500 flex-shrink-0 mt-0.5">!</span>
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
