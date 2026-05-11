import { useEffect, useState, useMemo } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { PYTHON_CURRICULUM } from '../curriculum/python'
import { saveProgress } from '../storage/progressStorage'
import ChallengePanel from './ChallengePanel'

export default function SubLessonView({ groupId, subLessonId, progress, onBack, onProgressChange, onNext }) {
  const [tldrOpen, setTldrOpen] = useState(false)

  const group = useMemo(
    () => PYTHON_CURRICULUM.find((g) => g.id === groupId),
    [groupId],
  )
  const subLesson = useMemo(
    () => group?.subLessons.find((sl) => sl.id === subLessonId),
    [group, subLessonId],
  )
  const nextSubLesson = useMemo(() => {
    if (!group || !subLesson) return null
    const idx = group.subLessons.findIndex((sl) => sl.id === subLessonId)
    return group.subLessons[idx + 1] ?? null
  }, [group, subLesson, subLessonId])

  useEffect(() => {
    if (!subLessonId) return
    saveProgress(subLessonId, { viewed: true })
    onProgressChange()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subLessonId])

  if (!subLesson || !group) {
    return <div className="p-6 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Lesson not found.</div>
  }

  function handlePracticed() {
    saveProgress(subLessonId, { practiced: true })
    onProgressChange()
  }
  function handleComplete() {
    saveProgress(subLessonId, { completed: true })
    onProgressChange()
    onNext()
  }
  function handleSkip() {
    saveProgress(subLessonId, { skipped: true })
    onProgressChange()
    onNext()
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100%' }}>
      <div
        className="flex items-center gap-3 px-6 py-3 border-b text-sm flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <ArrowLeft size={14} /> Back to map
        </button>
        <span className="flex-1 text-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {group.title} › {subLesson.title}
        </span>
        <button onClick={handleSkip} className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Skip →
        </button>
        {nextSubLesson && (
          <button onClick={onNext} className="text-xs font-medium" style={{ color: '#2dd4bf' }}>
            Next →
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 lg:max-w-[55%]">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>
            {subLesson.title}
          </h1>
          <p className="text-xs mb-6 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {group.title}
          </p>

          <div className="flex flex-col gap-4 mb-6">
            {subLesson.explanation.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {para}
              </p>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
            <div
              className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide border-b"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
            >
              Example
            </div>
            <pre className="p-4 text-[13px] leading-relaxed overflow-x-auto" style={{ background: 'rgba(0,0,0,0.3)', color: '#a5d6ff', fontFamily: 'monospace' }}>
              {subLesson.example.code}
            </pre>
            {subLesson.example.output && (
              <>
                <div
                  className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide border-t border-b"
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }}
                >
                  Output
                </div>
                <pre className="px-4 py-3 text-[13px]" style={{ background: 'rgba(0,0,0,0.2)', color: '#6ee7b7', fontFamily: 'monospace' }}>
                  {subLesson.example.output}
                </pre>
              </>
            )}
          </div>

          <button
            onClick={() => setTldrOpen((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold mb-1"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            {tldrOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} TL;DR
          </button>
          {tldrOpen && (
            <p className="text-sm pl-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {subLesson.tldr}
            </p>
          )}
        </div>

        <div
          className="lg:w-[45%] flex-shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l p-6"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <ChallengePanel
            challenge={subLesson.challenge}
            onPracticed={handlePracticed}
            onComplete={handleComplete}
            onSkip={handleSkip}
          />
        </div>
      </div>
    </div>
  )
}
