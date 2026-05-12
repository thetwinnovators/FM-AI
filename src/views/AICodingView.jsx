import { useState } from 'react'
import { Code2 } from 'lucide-react'
import AgentChatPanel from '../components/operator/AgentChatPanel.jsx'
import FileViewerPanel from '../components/operator/FileViewerPanel.jsx'

export default function AICodingView() {
  const [viewer, setViewer] = useState(null)

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Code2 size={18} className="text-indigo-300" />
        <h1 className="text-xl font-semibold tracking-tight">AI Coding</h1>
      </div>
      <p className="text-[13px] text-white/45 mb-6">
        Chat-style coding agent. Add a project under{' '}
        <a href="/operator/settings" className="text-indigo-300 hover:underline">
          Operator Settings → Workspace Roots
        </a>{' '}
        before asking the agent to read files.
      </p>

      <div className="flex flex-col gap-4">
        <AgentChatPanel
          placeholder='"What does daemon/src/server.ts do?" or "show me the git diff of master"'
          onFileRead={(path, content) => setViewer({ path, content })}
        />
        {viewer && (
          <FileViewerPanel
            path={viewer.path}
            content={viewer.content}
            onClose={() => setViewer(null)}
          />
        )}
      </div>
    </div>
  )
}
