import { useEffect, useState, useMemo } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { PYTHON_CURRICULUM } from '../curriculum/python'
import { useStore } from '../../store/useStore'
import ChallengePanel from './ChallengePanel'
import CodeBlock from './CodeBlock'
import TryItEditor from './TryItEditor'

export default function SubLessonView({ groupId, subLessonId, progress, onBack, onProgressChange, onNext }) {
  const { updatePythonProgress } = useStore()
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
    updatePythonProgress(subLessonId, { viewed: true })
    onProgressChange()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subLessonId])

  if (!subLesson || !group) {
    return <div className="p-6 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Lesson not found.</div>
  }

  function handlePracticed() {
    updatePythonProgress(subLessonId, { practiced: true })
    onProgressChange()
  }
  function handleComplete() {
    updatePythonProgress(subLessonId, { completed: true })
    onProgressChange()
    onNext()
  }
  function handleSkip() {
    updatePythonProgress(subLessonId, { skipped: true })
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
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 lg:max-w-[55%]" style={{ background: '#f7f9fc' }}>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgba(15,23,42,0.92)' }}>
            {subLesson.title}
          </h1>
          <p className="text-xs mb-6 uppercase tracking-widest" style={{ color: 'rgba(15,23,42,0.38)' }}>
            {group.title}
          </p>

          <div className="flex flex-col gap-4 mb-6">
            {subLesson.explanation.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed" style={{ color: 'rgba(15,23,42,0.72)' }}>
                {para}
              </p>
            ))}
          </div>

          <div
            className="rounded-xl overflow-hidden mb-6"
            style={{
              background: '#0d0f18',
              border: '1px solid rgba(45,212,191,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {/* Window chrome */}
            <div
              className="flex items-center gap-3 px-4 border-b"
              style={{ background: '#12141f', borderColor: 'rgba(45,212,191,0.1)', height: 38 }}
            >
              <span className="flex gap-1.5 flex-shrink-0">
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(45,212,191,0.5)', letterSpacing: '0.12em' }}
              >
                Example
              </span>
            </div>
            <CodeBlock code={subLesson.example.code} />
            {subLesson.example.output && (
              <>
                <div
                  className="flex items-center gap-2 px-4 py-2 border-t"
                  style={{ background: '#0a0c15', borderColor: 'rgba(45,212,191,0.1)' }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2dd4bf', opacity: 0.7, flexShrink: 0, display: 'inline-block' }} />
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'rgba(45,212,191,0.45)', letterSpacing: '0.12em' }}
                  >
                    Output
                  </span>
                </div>
                <pre
                  className="px-4 py-3 text-[13px]"
                  style={{ background: '#080a12', color: '#34d399', fontFamily: 'monospace' }}
                >
                  {subLesson.example.output}
                </pre>
              </>
            )}
          </div>

          <TryItEditor starterCode={subLesson.example.code} mocks={subLesson.example.mocks} />

          <button
            onClick={() => setTldrOpen((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold mb-1"
            style={{ color: 'rgba(15,23,42,0.45)' }}
          >
            {tldrOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} TL;DR
          </button>
          {tldrOpen && (
            <p className="text-sm pl-5" style={{ color: 'rgba(15,23,42,0.62)' }}>
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
