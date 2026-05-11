import { Highlight, themes } from 'prism-react-renderer'

const DARK_THEME = {
  ...themes.oneDark,
  plain: { ...themes.oneDark.plain, backgroundColor: 'transparent' },
}
const LIGHT_THEME = {
  ...themes.oneLight,
  plain: { ...themes.oneLight.plain, backgroundColor: 'transparent' },
}

export default function CodeBlock({ code, light }) {
  const theme = light ? LIGHT_THEME : DARK_THEME
  return (
    <Highlight theme={theme} code={String(code || '').trimEnd()} language="python">
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre
          className="p-4 text-[13px] leading-relaxed overflow-x-auto m-0"
          style={{
            background: light ? 'rgba(0,0,0,0.04)' : '#0d0f18',
            fontFamily: 'monospace',
          }}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })} style={{ display: 'flex' }}>
              <span
                style={{
                  userSelect:  'none',
                  width:       '1.6em',
                  textAlign:   'right',
                  marginRight: '1.2em',
                  flexShrink:  0,
                  color:       light ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.2)',
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
  )
}
