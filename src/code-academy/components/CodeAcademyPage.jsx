import { useState, useEffect } from 'react'
import {
  ArrowLeft, Play, RotateCcw, Lightbulb,
  Loader2, PartyPopper, ChevronRight, Code2, Target,
} from 'lucide-react'
import CodeEditorPanel   from './CodeEditorPanel.jsx'
import WorkedExampleCard from './WorkedExampleCard.jsx'
import TermHoverCard     from './TermHoverCard.jsx'
import { buildIframeSrc } from '../validatorEngine.js'

// ─── Persistent page-level header ─────────────────────────────────────────────
function AcademyHeader({ onHome }) {
  return (
    <div className="px-6 pt-6 pb-1 flex-shrink-0">
      <h1
        className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2.5 cursor-pointer hover:text-teal-400 transition-colors"
        onClick={onHome}
      >
        <Code2 size={20} className="text-teal-400" /> Code Academy
      </h1>
    </div>
  )
}

/**
 * The lesson workspace — three states:
 *
 *  lesson     → light-mode article card (mirrors Flow Academy CourseFrame)
 *  exercising → W3Schools-style split: editor left | output right
 *  complete   → celebration
 */
export default function CodeAcademyPage({ academy }) {
  const {
    stage, lesson, currentExercise, exerciseIndex,
    userCode, setUserCode, validationResult, aiFeedback,
    isFetchingFeedback, isRunning, visibleHints, hasMoreHints,
    runCode, useHint, resetCode, nextExercise, backToHome, beginExercises,
  } = academy

  const [hintsOpen, setHintsOpen] = useState(false)
  useEffect(() => { setHintsOpen(false) }, [exerciseIndex])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="flex flex-col h-full">
        <AcademyHeader onHome={backToHome} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-white/70">Flow AI is writing your lesson…</p>
            <p className="text-xs text-white/35">This takes about 15–30 seconds</p>
          </div>
        </div>
      </div>
    )
  }

  if (!lesson) return null

  // ── Complete ───────────────────────────────────────────────────────────────
  if (stage === 'complete') {
    return (
      <div className="flex flex-col h-full">
        <AcademyHeader onHome={backToHome} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
          <PartyPopper size={40} className="text-teal-400 mb-4" />
          <h2 className="text-2xl font-semibold text-white mb-2">Lesson complete!</h2>
          <p className="text-sm text-white/50 mb-6 max-w-sm">
            You finished <strong className="text-white/80">{lesson.title}</strong>.{' '}
            Keep going — pick your next concept.
          </p>
          <button
            onClick={backToHome}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
          >
            Pick next lesson
          </button>
        </div>
      </div>
    )
  }

  const passed      = validationResult?.passed === true
  const hasRun      = validationResult !== null
  const showPreview = hasRun && (lesson.language === 'html' || lesson.language === 'css') && userCode?.trim()
  const isLast      = exerciseIndex + 1 >= (lesson.exercises?.length ?? 0)

  // ── Lesson intro (light-mode card — mirrors Flow Academy CourseFrame) ──────
  if (stage === 'lesson') {
    return (
      <div className="flex flex-col h-full">
        <AcademyHeader onHome={backToHome} />

        <div className="flex-1 overflow-y-auto p-5 pb-10">

          {/* Light-mode card — same spec as Flow Academy's CourseFrame white panel */}
          <div
            className="max-w-[700px] mx-auto rounded-2xl border border-slate-300/60 shadow-sm overflow-hidden"
            style={{ background: '#eef0f4', color: '#0f172a' }}
          >
            <div className="px-10 pt-8 pb-12">

              {/* Back button */}
              <button
                onClick={backToHome}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-800 mb-6 transition-colors"
              >
                ← Code Academy
              </button>

              {/* Lesson header */}
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-widest mb-1.5"
                  style={{ color: '#0d9488' }}>
                  {lesson.language} · {lesson.concept}
                </p>
                <h2 className="text-2xl font-bold text-slate-900">{lesson.title}</h2>
                {lesson.summary && (
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{lesson.summary}</p>
                )}
              </div>

              {/* What you'll learn — teal box matching Flow Academy */}
              {lesson.objectives?.length > 0 && (
                <div className="mb-6 p-5 rounded-xl bg-teal-50 border border-teal-100">
                  <h3 className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Target size={11} /> What you will learn
                  </h3>
                  <ul className="space-y-2">
                    {lesson.objectives.map((obj, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start gap-2.5">
                        <span className="text-teal-500 font-bold flex-shrink-0 mt-0.5">·</span>
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Worked example */}
              {lesson.workedExample && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                    Example
                  </h3>
                  {/* Description or title for the example */}
                  {lesson.workedExample.title && (
                    <p className="text-sm text-slate-700 mb-3 leading-relaxed">
                      {lesson.workedExample.title}
                    </p>
                  )}
                  <WorkedExampleCard example={lesson.workedExample} />
                </div>
              )}

              {/* Key terms */}
              {lesson.terminology?.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                    Key terms
                  </h3>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {lesson.terminology.map((term) => (
                      <TermHoverCard key={term.term} term={term.term} definition={term} />
                    ))}
                  </div>
                </div>
              )}

              {/* Start exercises CTA */}
              <button
                onClick={beginExercises}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
              >
                Start {lesson.exercises?.length ?? 0} exercises →
              </button>

            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Exercise stage (W3Schools-style split) ─────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      <AcademyHeader onHome={backToHome} />

      {/* Action bar */}
      <div
        className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
        style={{ background: '#161b27', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <button
          onClick={backToHome}
          className="flex items-center gap-1 text-[11px] mr-2 transition-colors"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
        >
          <ArrowLeft size={11} /> Back
        </button>

        <span className="text-[11px] truncate max-w-[170px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {lesson.title}
        </span>

        <div className="flex-1" />

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mr-2">
          {lesson.exercises?.map((_, i) => (
            <div
              key={i}
              style={{
                width:        6,
                height:       6,
                borderRadius: '50%',
                transition:   'background 0.3s',
                background:   i < exerciseIndex
                  ? '#2dd4bf'
                  : i === exerciseIndex
                    ? (passed ? '#2dd4bf' : 'rgba(255,255,255,0.75)')
                    : 'rgba(255,255,255,0.14)',
              }}
            />
          ))}
        </div>

        {/* Swap buttons after passing */}
        {passed ? (
          <button
            onClick={nextExercise}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
          >
            {isLast ? 'Finish lesson' : 'Next exercise'}
            <ChevronRight size={12} />
          </button>
        ) : (
          <>
            {hasMoreHints && (
              <button
                onClick={() => { useHint(); setHintsOpen(true) }}
                disabled={isRunning}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40"
                style={{ color: 'rgba(251,191,36,0.8)', background: 'rgba(251,191,36,0.08)' }}
              >
                <Lightbulb size={11} /> Hint
              </button>
            )}
            <button
              onClick={resetCode}
              disabled={isRunning}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-40 transition-colors"
              style={{ color: 'rgba(255,255,255,0.38)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
            >
              <RotateCcw size={11} /> Reset
            </button>
            <button
              onClick={runCode}
              disabled={isRunning || !userCode?.trim()}
              className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ background: '#0d9488' }}
            >
              {isRunning
                ? <><Loader2 size={11} className="animate-spin" /> Running…</>
                : <><Play   size={11} className="fill-current"  /> Run ▸</>}
            </button>
          </>
        )}

        <span
          className="ml-1 text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }}
        >
          {lesson.language}
        </span>
      </div>

      {/* Task description */}
      <div
        className="flex-shrink-0 px-5 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wider mr-2"
          style={{ color: 'rgba(255,255,255,0.22)' }}
        >
          Exercise {exerciseIndex + 1} of {lesson.exercises?.length ?? 0}
        </span>
        <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.68)' }}>
          {currentExercise?.prompt}
        </span>
      </div>

      {/* Inline hints */}
      {visibleHints?.length > 0 && hintsOpen && (
        <div
          className="flex-shrink-0 px-5 py-3 space-y-1.5"
          style={{ background: 'rgba(251,191,36,0.04)', borderBottom: '1px solid rgba(251,191,36,0.1)' }}
        >
          {visibleHints.map((hint, i) => (
            <p key={i} className="text-xs leading-relaxed" style={{ color: 'rgba(251,191,36,0.75)' }}>
              <span className="font-semibold mr-1" style={{ color: 'rgba(251,191,36,0.9)' }}>
                Hint {i + 1}:
              </span>
              {hint}
            </p>
          ))}
          <button
            onClick={() => setHintsOpen(false)}
            className="text-[10px] transition-colors mt-1"
            style={{ color: 'rgba(251,191,36,0.4)' }}
          >
            Hide
          </button>
        </div>
      )}

      {/* W3Schools-style split: Editor | Output */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — live syntax-highlighted editor */}
        <div className="flex-1 overflow-hidden" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <CodeEditorPanel
            code={userCode}
            language={lesson.language}
            onChange={setUserCode}
            onRun={runCode}
            disabled={isRunning || isFetchingFeedback}
          />
        </div>

        {/* Right — output */}
        <div className="flex-1 overflow-auto flex flex-col" style={{ background: '#0f1117' }}>
          <div
            className="flex items-center px-5 py-2.5 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'rgba(255,255,255,0.22)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            Output
            {hasRun && (
              <span
                className="ml-auto font-bold text-[11px]"
                style={{ color: validationResult?.passed ? '#2dd4bf' : '#f87171' }}
              >
                {validationResult?.passed ? '✓ Passed' : '✗ Failed'}
              </span>
            )}
          </div>

          <div className="flex-1 p-5">
            {!hasRun ? (
              <p className="text-xs mt-8 text-center" style={{ color: 'rgba(255,255,255,0.14)' }}>
                Press{' '}
                <kbd
                  className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.28)' }}
                >
                  Ctrl+Enter
                </kbd>{' '}
                or click <strong style={{ color: 'rgba(255,255,255,0.28)' }}>Run ▸</strong> to see results
              </p>
            ) : (
              <div className="space-y-5">
                {showPreview && (
                  <div className="rounded-lg overflow-hidden border border-white/[0.08]">
                    <iframe
                      srcDoc={buildIframeSrc(userCode, lesson.language)}
                      sandbox="allow-scripts"
                      style={{ width: '100%', height: '200px', border: 'none', background: '#fff' }}
                      title="Preview"
                    />
                  </div>
                )}

                {validationResult && (
                  <div>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: validationResult.passed ? '#5eead4' : '#fca5a5' }}
                    >
                      {validationResult.reason}
                    </p>

                    {!validationResult.passed && (aiFeedback || isFetchingFeedback) && (
                      <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <p
                          className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                          style={{ color: 'rgba(255,255,255,0.2)' }}
                        >
                          Explanation
                        </p>
                        {isFetchingFeedback && !aiFeedback ? (
                          <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                            <Loader2 size={11} className="animate-spin" /> Getting explanation…
                          </div>
                        ) : (
                          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            {aiFeedback}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
