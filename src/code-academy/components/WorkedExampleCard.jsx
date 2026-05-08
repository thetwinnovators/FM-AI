import { Highlight, themes } from 'prism-react-renderer'

const THEME = {
  ...themes.oneDark,
  plain: { ...themes.oneDark.plain, backgroundColor: '#1a1d2e' },
}

function getPrismLang(language) {
  if (language === 'html') return 'markup'
  return language || 'python'
}

/**
 * Shows a worked code example with syntax highlighting, optional expected
 * output, and always-visible explanation steps. No toggle — just reads top
 * to bottom like a tutorial.
 */
export default function WorkedExampleCard({ example }) {
  if (!example) return null
  const lang = getPrismLang(example.language)

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08]">

      {/* Syntax-highlighted code */}
      <Highlight theme={THEME} code={String(example.code || '').trimEnd()} language={lang}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre
            className="m-0 overflow-x-auto"
            style={{
              background:  '#1a1d2e',
              fontFamily:  '"Fira Code", Consolas, monospace',
              fontSize:    '13px',
              lineHeight:  '1.7',
              padding:     '18px 22px',
            }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} style={{ display: 'flex' }}>
                <span
                  style={{
                    userSelect:  'none',
                    width:       '1.8em',
                    textAlign:   'right',
                    marginRight: '1.5em',
                    flexShrink:  0,
                    color:       'rgba(255,255,255,0.18)',
                    fontSize:    '11px',
                    lineHeight:  '1.7',
                  }}
                >
                  {i + 1}
                </span>
                <span>
                  {line.map((token, k) => (
                    <span key={k} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
          </pre>
        )}
      </Highlight>

      {/* Expected output */}
      {example.expectedOutput && (
        <div
          className="px-5 py-2.5"
          style={{ background: '#111520', borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span
            className="text-[10px] uppercase tracking-wider mr-2"
            style={{ color: 'rgba(255,255,255,0.22)' }}
          >
            Output:
          </span>
          <code
            style={{
              fontFamily: '"Fira Code", Consolas, monospace',
              fontSize:   '12px',
              color:      '#5eead4',
            }}
          >
            {example.expectedOutput}
          </code>
        </div>
      )}

      {/* Explanation steps — always visible */}
      {example.explanationSteps?.length > 0 && (
        <div
          className="px-5 py-4"
          style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'rgba(255,255,255,0.22)' }}
          >
            How it works
          </p>
          <ol className="space-y-3">
            {example.explanationSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                >
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
