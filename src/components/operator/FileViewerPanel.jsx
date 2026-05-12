import { Highlight, themes } from 'prism-react-renderer'
import { FileCode, X } from 'lucide-react'

function detectLanguage(path) {
  const ext = path?.split('.').pop()?.toLowerCase() ?? ''
  return {
    js: 'jsx', jsx: 'jsx', ts: 'tsx', tsx: 'tsx',
    mjs: 'jsx', cjs: 'jsx',
    py: 'python', go: 'go', rs: 'rust', java: 'java',
    rb: 'ruby', php: 'php', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    cs: 'csharp', swift: 'swift', kt: 'kotlin',
    css: 'css', scss: 'scss', html: 'markup', xml: 'markup',
    json: 'json', toml: 'toml', yml: 'yaml', yaml: 'yaml',
    md: 'markdown', sh: 'bash', bash: 'bash', ps1: 'powershell',
    sql: 'sql', graphql: 'graphql', proto: 'protobuf',
  }[ext] ?? 'tsx'
}

export default function FileViewerPanel({ path, content, onClose }) {
  if (!path || content === undefined || content === null) return null
  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-white/3">
        <FileCode size={13} className="text-white/55" />
        <span className="flex-1 text-[12px] text-white/70 font-mono truncate" title={path}>{path}</span>
        <button
          onClick={onClose}
          className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/5"
          title="Close viewer"
        >
          <X size={13} />
        </button>
      </div>
      <Highlight code={content} language={detectLanguage(path)} theme={themes.vsDark}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={`${className} p-4 text-[11.5px] overflow-auto max-h-[480px]`} style={style}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                <span className="inline-block w-8 mr-3 text-right text-white/25 select-none">{i + 1}</span>
                {line.map((token, j) => <span key={j} {...getTokenProps({ token })} />)}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  )
}
