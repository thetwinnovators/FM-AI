import { useState } from 'react'
import { CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { validate } from '../validator'

export default function ChallengePanel({ challenge, onPracticed, onComplete, onSkip }) {
  const [code, setCode]             = useState(challenge.starterCode ?? '')
  const [selectedOption, setSelectedOption] = useState(null)
  const [fillValue, setFillValue]   = useState('')
  const [result, setResult]         = useState(null)
  const [attempts, setAttempts]     = useState(0)
  const [hintsShown, setHintsShown] = useState(0)
  const [showSolution, setShowSolution] = useState(false)

  const MAX_HINTS = challenge.hints?.length ?? 0

  function getUserInput() {
    if (challenge.type === 'multiple_choice') return selectedOption
    if (challenge.type === 'fill_blank')     return fillValue
    return undefined
  }

  function handleRun() {
    if (attempts === 0) onPracticed()
    const r           = validate(code, challenge, getUserInput())
    const newAttempts = attempts + 1
    setResult(r)
    setAttempts(newAttempts)
    if (newAttempts >= 3 && !r.passed) setShowSolution(true)
  }

  if (challenge.type === 'read_only') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{challenge.prompt}</p>
        <button onClick={onComplete} className="py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#0d9488', color: '#fff' }}>
          Continue →
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#2dd4bf' }}>Challenge</div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {challenge.prompt}
        </p>
      </div>

      {challenge.type === 'code_run' && (
        <textarea
          value={code}
          onChange={(e) => { setCode(e.target.value); setResult(null) }}
          spellCheck={false}
          rows={6}
          className="w-full rounded-xl p-3 text-[13px] resize-y outline-none"
          style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.09)', color: '#a5d6ff' }}
        />
      )}

      {challenge.type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {challenge.options?.map((opt, i) => (
            <button
              key={i}
              onClick={() => { setSelectedOption(i); setResult(null) }}
              className="text-left px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: selectedOption === i ? 'rgba(13,148,136,0.2)'          : 'rgba(255,255,255,0.03)',
                border:     selectedOption === i ? '1px solid rgba(45,212,191,0.4)' : '1px solid rgba(255,255,255,0.07)',
                color:      selectedOption === i ? '#e2f8f5'                        : 'rgba(255,255,255,0.7)',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {challenge.type === 'fill_blank' && (
        <input
          type="text"
          value={fillValue}
          onChange={(e) => { setFillValue(e.target.value); setResult(null) }}
          placeholder="Type your answer…"
          className="px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.85)' }}
        />
      )}

      {result && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
          style={{
            background: result.passed ? 'rgba(13,148,136,0.12)'           : 'rgba(239,68,68,0.1)',
            border:     result.passed ? '1px solid rgba(45,212,191,0.25)' : '1px solid rgba(239,68,68,0.25)',
          }}
        >
          {result.passed
            ? <CheckCircle2 size={16} style={{ color: '#2dd4bf', flexShrink: 0, marginTop: 1 }} />
            : <XCircle      size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />}
          <div>
            {result.passed ? (
              <span style={{ color: '#6ee7b7' }}>Correct!</span>
            ) : (
              <>
                <span style={{ color: '#fca5a5' }}>Not quite.</span>
                {challenge.expectedOutput != null && result.userOutput != null && (
                  <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Expected: <code style={{ color: '#6ee7b7' }}>{challenge.expectedOutput}</code>
                    {' · '}Got: <code style={{ color: '#f87171' }}>{result.userOutput}</code>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!result?.passed && (
        <button
          onClick={handleRun}
          disabled={challenge.type === 'multiple_choice' && selectedOption == null}
          className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: '#0d9488', color: '#fff' }}
        >
          {challenge.type === 'code_run' ? 'Run' : 'Check'}
        </button>
      )}

      {result?.passed && (
        <button onClick={onComplete} className="py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#0d9488', color: '#fff' }}>
          Continue →
        </button>
      )}

      {MAX_HINTS > 0 && !result?.passed && (
        <div>
          {hintsShown < MAX_HINTS && (
            <button
              onClick={() => setHintsShown((n) => n + 1)}
              className="flex items-center gap-1 text-xs"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              <ChevronDown size={12} /> Show hint ({hintsShown + 1} of {MAX_HINTS})
            </button>
          )}
          {challenge.hints.slice(0, hintsShown).map((hint, i) => (
            <p key={i} className="text-xs mt-1 pl-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
              💡 {hint}
            </p>
          ))}
        </div>
      )}

      {showSolution && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Solution</p>
          <pre className="text-[13px] whitespace-pre-wrap" style={{ color: '#a5d6ff', fontFamily: 'monospace' }}>
            {challenge.solution}
          </pre>
        </div>
      )}

      <button onClick={onSkip} className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Skip lesson
      </button>
    </div>
  )
}
