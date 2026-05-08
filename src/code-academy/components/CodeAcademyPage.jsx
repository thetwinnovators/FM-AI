import { ArrowLeft, PartyPopper } from 'lucide-react'
import WorkedExampleCard  from './WorkedExampleCard.jsx'
import TermHoverCard      from './TermHoverCard.jsx'
import CodeEditorPanel    from './CodeEditorPanel.jsx'
import OutputPanel        from './OutputPanel.jsx'
import ExerciseCard       from './ExerciseCard.jsx'
import ProgressSidebar    from './ProgressSidebar.jsx'

/**
 * 3-panel lesson workspace.
 * Left:   lesson nav (back button, lesson sections, key terms)
 * Center: lesson content → worked example → exercise + editor + output
 * Right:  objectives + progress + AI feedback + common mistakes
 */
export default function CodeAcademyPage({ academy }) {
  const {
    stage, lesson, currentExercise, exerciseIndex,
    userCode, setUserCode, validationResult, aiFeedback,
    isFetchingFeedback, isRunning, visibleHints, hasMoreHints,
    runCode, useHint, resetCode, nextExercise, backToHome, beginExercises,
  } = academy

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-white/70">Flow AI is writing your lesson…</p>
          <p className="text-xs text-white/35">This takes about 15–30 seconds</p>
        </div>
      </div>
    )
  }

  if (!lesson) return null

  // ── Complete ─────────────────────────────────────────────────────────────────
  if (stage === 'complete') {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <PartyPopper size={40} className="text-teal-400 mb-4" />
        <h2 className="text-2xl font-semibold text-white mb-2">Lesson complete!</h2>
        <p className="text-sm text-white/50 mb-6 max-w-sm">
          You finished <strong className="text-white/80">{lesson.title}</strong>. Keep going — pick your next concept below.
        </p>
        <button
          onClick={backToHome}
          className="px-6 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
        >
          Pick next lesson
        </button>
      </div>
    )
  }

  const hasRun = validationResult !== null

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.08] flex-shrink-0">
        <button
          onClick={backToHome}
          className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 transition-colors"
        >
          <ArrowLeft size={14} />
          Code Academy
        </button>
        <span className="text-white/20">/</span>
        <span className="text-sm font-medium text-white/70">{lesson.title}</span>
        <span
          className="ml-auto text-[11px] px-2 py-0.5 rounded-md font-medium uppercase tracking-wide"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
        >
          {lesson.language}
        </span>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel (lesson nav) ── */}
        <div
          className="w-[220px] flex-shrink-0 border-r border-white/[0.06] p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.15)' }}
        >
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-3">This lesson</p>
          <div className="space-y-1">
            {[
              { id: 'intro',     label: 'Introduction',    active: stage === 'lesson' },
              { id: 'exercises', label: 'Exercises',       active: stage === 'exercising' || stage === 'feedback' },
            ].map((item) => (
              <div
                key={item.id}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  item.active
                    ? 'text-teal-300 bg-teal-500/10'
                    : 'text-white/30'
                }`}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Key terms list */}
          {lesson.terminology.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-2">Key terms</p>
              <div className="space-y-1">
                {lesson.terminology.map((term) => (
                  <div key={term.term} className="px-3 py-1.5 rounded-lg">
                    <TermHoverCard term={term.term} definition={term} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Center panel ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto px-8 py-6" style={{ maxWidth: '680px' }}>

            {/* Lesson introduction */}
            {stage === 'lesson' && (
              <>
                <div className="mb-6">
                  <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-2">
                    {lesson.language.toUpperCase()} · {lesson.concept}
                  </p>
                  <h1 className="text-2xl font-bold text-white mb-3">{lesson.title}</h1>
                  <p className="text-sm text-white/60 leading-relaxed">{lesson.summary}</p>
                </div>

                {/* Objectives */}
                {lesson.objectives.length > 0 && (
                  <div className="mb-6 p-4 rounded-xl bg-teal-500/10 border border-teal-500/20">
                    <p className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider mb-2.5">
                      What you will learn
                    </p>
                    <ul className="space-y-1.5">
                      {lesson.objectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-teal-100/80">
                          <span className="text-teal-500 font-bold flex-shrink-0 mt-0.5">·</span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Worked example */}
                <WorkedExampleCard example={lesson.workedExample} />

                {/* Start exercises CTA */}
                <button
                  onClick={beginExercises}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
                >
                  Start practising →
                </button>
              </>
            )}

            {/* Exercise + editor */}
            {(stage === 'exercising' || stage === 'feedback') && currentExercise && (
              <div className="space-y-5">
                <ExerciseCard
                  exercise={currentExercise}
                  exerciseIndex={exerciseIndex}
                  totalExercises={lesson.exercises.length}
                  validationResult={validationResult}
                  onNext={nextExercise}
                />
                <CodeEditorPanel
                  code={userCode}
                  language={lesson.language}
                  onChange={setUserCode}
                  onRun={runCode}
                  onReset={resetCode}
                  onHint={useHint}
                  isRunning={isRunning}
                  disabled={stage === 'feedback' && isFetchingFeedback}
                  visibleHints={visibleHints}
                  hasMoreHints={hasMoreHints}
                />
                <OutputPanel
                  language={lesson.language}
                  userCode={userCode}
                  validationResult={validationResult}
                  hasRun={hasRun}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div
          className="w-[260px] flex-shrink-0 border-l border-white/[0.06] p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.10)' }}
        >
          <ProgressSidebar
            lesson={lesson}
            exerciseIndex={exerciseIndex}
            exercisesTotal={lesson.exercises.length}
            aiFeedback={aiFeedback}
            isFetchingFeedback={isFetchingFeedback}
          />
        </div>
      </div>
    </div>
  )
}
