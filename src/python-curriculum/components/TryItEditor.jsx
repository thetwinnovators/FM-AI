import { useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { simulateOutput, extractVars } from '../validator'

export default function TryItEditor({ starterCode }) {
  const [code, setCode] = useState('')
  const [output, setOutput] = useState(null)
  const [vars, setVars] = useState({})
  const [hasRun, setHasRun] = useState(false)
  const [unsupported, setUnsupported] = useState(false)

  function run() {
    const result = simulateOutput(code)
    const varMap = extractVars(code)
    setVars(varMap)
    if (result !== null) {
      setOutput(result)
      setUnsupported(false)
    } else {
      setOutput(null)
      setUnsupported(true)
    }
    setHasRun(true)
  }

  function reset() {
    setCode('')
    setOutput(null)
    setVars({})
    setHasRun(false)
    setUnsupported(false)
  }

  const lineCount = Math.max(code.split('\n').length, 4)
  const varEntries = Object.entries(vars)

  return (
    <div
      className="rounded-xl overflow-hidden mb-6"
      style={{
        background: '#0d0f18',
        border: '1px solid rgba(45,212,191,0.2)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 border-b"
        style={{ background: '#12141f', borderColor: 'rgba(45,212,191,0.1)', height: 38 }}
      >
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5">
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'rgba(45,212,191,0.5)', letterSpacing: '0.12em' }}
          >
            Try it yourself
          </span>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-[11px]"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          <RotateCcw size={10} />
          <span className="ml-1">Reset</span>
        </button>
      </div>

      {/* Textarea */}
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={Math.min(lineCount + 1, 20)}
        className="w-full resize-none outline-none p-4 text-[13px] leading-relaxed block"
        style={{
          background: '#0d0f18',
          color: '#abb2bf',
          fontFamily: 'monospace',
          border: 'none',
        }}
      />

      {/* Run bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-t"
        style={{ background: '#12141f', borderColor: 'rgba(45,212,191,0.1)' }}
      >
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
          Edit and run your code
        </span>
        <button
          onClick={run}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-semibold transition-colors"
          style={{
            background: 'rgba(13,148,136,0.2)',
            color: '#2dd4bf',
            border: '1px solid rgba(45,212,191,0.3)',
          }}
        >
          <Play size={10} fill="#2dd4bf" /> Run
        </button>
      </div>

      {/* Output + Variable inspector */}
      {hasRun && (
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
            style={{
              background: '#080a12',
              color: unsupported ? 'rgba(251,191,36,0.65)' : '#34d399',
              fontFamily: 'monospace',
            }}
          >
            {unsupported
              ? '⚠ This sandbox simulates basic print() statements.\nTry: print("text") or print(1 + 2)'
              : (output || '(no output)')}
          </pre>

          {varEntries.length > 0 && (
            <>
              <div
                className="flex items-center gap-2 px-4 py-2 border-t"
                style={{ background: '#0a0c15', borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(97,175,239,0.7)', flexShrink: 0, display: 'inline-block' }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(97,175,239,0.5)', letterSpacing: '0.12em' }}
                >
                  Variables
                </span>
              </div>
              <div
                className="px-4 py-3"
                style={{ background: '#080a12', fontFamily: 'monospace', fontSize: 12 }}
              >
                {varEntries.map(([k, v]) => (
                  <div key={k} style={{ lineHeight: 1.9 }}>
                    <span style={{ color: '#61afef' }}>{k}</span>
                    <span style={{ color: 'rgba(255,255,255,0.25)' }}> = </span>
                    <span style={{ color: v.startsWith('"') ? '#98c379' : '#d19a66' }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
