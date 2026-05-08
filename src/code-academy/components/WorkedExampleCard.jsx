import { useState } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { ChevronRight, Eye } from 'lucide-react'

const CODE_THEME = {
  ...themes.vsDark,
  plain: { ...themes.vsDark.plain, backgroundColor: '#1a1d2e' },
}

/**
 * Shows a worked example with:
 * - Syntax-highlighted code block
 * - Step-by-step explanation cards (collapsible)
 * - Optional expected output
 */
export default function WorkedExampleCard({ example }) {
  const [expanded, setExpanded] = useState(false)
  const lang = example.language || 'html'

  return (
    <div className="rounded-xl border border-indigo-200 overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-indigo-500" />
          <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Worked Example</span>
        </div>
        <span className="text-[10px] font-mono text-indigo-400 uppercase">{lang}</span>
      </div>

      {/* Code block */}
      <div style={{ background: '#1a1d2e' }}>
        <Highlight theme={CODE_THEME} code={String(example.code || '').trimEnd()} language={lang}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="px-5 py-4 font-mono text-sm leading-relaxed overflow-x-auto m-0">
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="flex">
                  <span className="select-none w-7 text-right mr-4 text-white/20 text-[11px] flex-shrink-0 leading-6">
                    {i + 1}
                  </span>
                  <span>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>

      {/* Expected output */}
      {example.expectedOutput && (
        <div className="px-4 py-2.5 bg-slate-900 border-t border-white/[0.06]">
          <span className="text-[10px] text-white/30 uppercase tracking-wider mr-2">Output:</span>
          <code className="text-[12px] text-green-400 font-mono">{example.expectedOutput}</code>
        </div>
      )}

      {/* Step-by-step explanation toggle */}
      {example.explanationSteps && example.explanationSteps.length > 0 && (
        <div className="bg-white">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors border-t border-indigo-100"
          >
            <span>How does this code work?</span>
            <ChevronRight
              size={14}
              className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>

          {expanded && (
            <ol className="px-4 pb-4 space-y-2.5 border-t border-indigo-50">
              {example.explanationSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 pt-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
