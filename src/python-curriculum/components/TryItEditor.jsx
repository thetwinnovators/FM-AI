import { useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { runPython } from '../runtime/pyodideService'

export default function TryItEditor({ starterCode }) {
  const [code, setCode]       = useState(starterCode ?? '')
  const [output, setOutput]   = useState(null)
  const [isError, setIsError] = useState(false)
  const [hasRun, setHasRun]   = useState(false)
  const [loading, setLoading] = useState(false)

  async function run() {
    if (!code.trim() || loading) return
    setLoading(true)
    try {
      const { output: out, error } = await runPython(code)
      if (error) {
        setOutput(error)
        setIsError(true)
      } else {
        setOutput(out || '(no output)')
        setIsError(false)
      }
    } catch (e) {
      setOutput(String(e.message || e))
      setIsError(true)
    } finally {
      setLoading(false)
      setHasRun(true)
    }
  }

  function reset() {
    setCode(starterCode ?? '')
    setOutput(null)
    setIsError(false)
    setHasRun(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      run()
    }
  }

  const lineCount = Math.max(code.split('\n').length, 4)

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
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(45,212,191,0.5)', letterSpacing: '0.12em' }}>
            Try it yourself
          </span>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
          <RotateCcw size={10} />
          <span className="ml-1">Reset</span>
        </button>
      </div>

      {/* Code textarea */}
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        rows={Math.min(lineCount + 1, 20)}
        placeholder="# Write Python here…"
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
          {loading ? 'Running…' : 'Ctrl + Enter to run'}
        </span>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-semibold"
          style={{
            background: loading ? 'rgba(13,148,136,0.08)' : 'rgba(13,148,136,0.2)',
            color: loading ? 'rgba(45,212,191,0.35)' : '#2dd4bf',
            border: '1px solid rgba(45,212,191,0.3)',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? '…' : <><Play size={10} fill="#2dd4bf" /> Run</>}
        </button>
      </div>

      {/* Output */}
      {hasRun && (
        <>
          <div
            className="flex items-center gap-2 px-4 py-2 border-t"
            style={{ background: '#0a0c15', borderColor: 'rgba(45,212,191,0.1)' }}
          >
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: isError ? '#f87171' : '#2dd4bf',
              opacity: 0.8, flexShrink: 0, display: 'inline-block',
            }} />
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{
              color: isError ? 'rgba(248,113,113,0.55)' : 'rgba(45,212,191,0.45)',
              letterSpacing: '0.12em',
            }}>
              {isError ? 'Error' : 'Output'}
            </span>
          </div>
          <pre
            className="px-4 py-3 text-[13px]"
            style={{
              background: '#080a12',
              color: isError ? '#f87171' : '#34d399',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {output}
          </pre>
        </>
      )}
    </div>
  )
}
