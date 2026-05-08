import { useRef, useLayoutEffect } from 'react'
import { Play, RotateCcw, Lightbulb, Loader2 } from 'lucide-react'

/**
 * Code editor panel with:
 * - Textarea with tab-key support and monospace styling
 * - Run, Reset, and Hint buttons
 * - Hint display area
 */
export default function CodeEditorPanel({
  code,
  language,
  onChange,
  onRun,
  onReset,
  onHint,
  isRunning,
  disabled,
  visibleHints,
  hasMoreHints,
}) {
  const textareaRef = useRef(null)
  const cursorRef = useRef(null)

  useLayoutEffect(() => {
    if (cursorRef.current !== null && textareaRef.current) {
      textareaRef.current.selectionStart = cursorRef.current
      textareaRef.current.selectionEnd   = cursorRef.current
      cursorRef.current = null
    }
  })

  // Handle Tab key — insert 2 spaces instead of losing focus
  function handleKeyDown(e) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end   = ta.selectionEnd
      cursorRef.current = start + 2
      onChange(code.slice(0, start) + '  ' + code.slice(end))
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!isRunning && !disabled) onRun()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Editor label */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Your code · {language.toUpperCase()}
        </span>
        <span className="text-[10px] text-slate-400">Ctrl+Enter to run</span>
      </div>

      {/* Textarea */}
      <div className="rounded-xl overflow-hidden border border-slate-300" style={{ background: '#1a1d2e' }}>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isRunning}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          rows={10}
          className="w-full px-5 py-4 font-mono text-sm leading-relaxed resize-none focus:outline-none disabled:opacity-60"
          style={{
            background: 'transparent',
            color: '#d4d4d4',
            caretColor: '#2dd4bf',
            minHeight: '220px',
          }}
          placeholder={`# Write your ${language.toUpperCase()} code here…`}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRun}
          disabled={isRunning || disabled || !code.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} className="fill-current" />}
          {isRunning ? 'Running…' : 'Run'}
        </button>

        <button
          onClick={onReset}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors"
        >
          <RotateCcw size={13} />
          Reset
        </button>

        {hasMoreHints && (
          <button
            onClick={onHint}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 transition-colors ml-auto"
          >
            <Lightbulb size={13} />
            Show hint
          </button>
        )}
      </div>

      {/* Hints */}
      {visibleHints && visibleHints.length > 0 && (
        <div className="space-y-2">
          {visibleHints.map((hint, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200"
            >
              <Lightbulb size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 leading-relaxed">{hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
