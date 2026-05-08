import { useRef, useLayoutEffect } from 'react'
import { Highlight, themes } from 'prism-react-renderer'

/**
 * Code editor with live syntax highlighting.
 *
 * Technique: a syntax-highlighted <pre> sits absolutely behind a transparent
 * <textarea>. Both share identical font metrics so characters align perfectly.
 * The textarea handles all input; the pre is purely decorative (aria-hidden).
 */

const HIGHLIGHT_THEME = {
  ...themes.oneDark,
  plain: { ...themes.oneDark.plain, backgroundColor: 'transparent' },
}

// These values MUST be identical on both <pre> and <textarea>
const FONT   = '"Fira Code", "Cascadia Code", Consolas, "Courier New", monospace'
const FSIZE  = '13.5px'
const LH     = '1.7'
const PAD_V  = '18px'
const PAD_H  = '22px'

function getPrismLang(language) {
  if (language === 'html') return 'markup'
  return language || 'python'
}

export default function CodeEditorPanel({ code, language, onChange, onRun, disabled }) {
  const taRef  = useRef(null)
  const preRef = useRef(null)
  const curRef = useRef(null) // pending cursor position after Tab key

  // Restore cursor after Tab insertion — React resets selectionStart on re-render
  useLayoutEffect(() => {
    if (curRef.current !== null && taRef.current) {
      taRef.current.selectionStart = curRef.current
      taRef.current.selectionEnd   = curRef.current
      curRef.current = null
    }
  })

  // Keep the highlight layer scrolled in sync with the textarea
  function syncScroll() {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop  = taRef.current.scrollTop
      preRef.current.scrollLeft = taRef.current.scrollLeft
    }
  }

  function handleKeyDown(e) {
    // Tab → insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = taRef.current
      if (!ta) return
      const s = ta.selectionStart
      curRef.current = s + 2
      onChange(code.slice(0, s) + '  ' + code.slice(ta.selectionEnd))
    }
    // Ctrl/Cmd+Enter → run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!disabled && onRun) onRun()
    }
  }

  const sharedStyle = {
    fontFamily:    FONT,
    fontSize:      FSIZE,
    lineHeight:    LH,
    paddingTop:    PAD_V,
    paddingBottom: PAD_V,
    paddingLeft:   PAD_H,
    paddingRight:  PAD_H,
    margin:        0,
    whiteSpace:    'pre-wrap',
    wordBreak:     'break-all',
    tabSize:       2,
    letterSpacing: 'normal',
    wordSpacing:   'normal',
  }

  return (
    <div
      style={{
        position:   'relative',
        height:     '100%',
        background: '#1a1d2e',
        overflow:   'hidden',
      }}
    >
      {/* ── Syntax-highlighted mirror (background, pointer-events: none) ── */}
      <Highlight
        theme={HIGHLIGHT_THEME}
        code={code || ''}
        language={getPrismLang(language)}
      >
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre
            ref={preRef}
            aria-hidden="true"
            style={{
              ...sharedStyle,
              position:      'absolute',
              inset:         0,
              overflow:      'hidden',
              pointerEvents: 'none',
              background:    'transparent',
              display:       'block',
            }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, k) => (
                  <span key={k} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>

      {/* ── Editable textarea (transparent text, visible caret) ── */}
      <textarea
        ref={taRef}
        value={code}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          ...sharedStyle,
          position:   'absolute',
          inset:      0,
          zIndex:     1,
          background: 'transparent',
          color:      'transparent',
          caretColor: '#a6e3a1',
          border:     'none',
          outline:    'none',
          resize:     'none',
          overflow:   'auto',
          width:      '100%',
          height:     '100%',
          display:    'block',
        }}
      />
    </div>
  )
}
