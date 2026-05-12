import { Code2 } from 'lucide-react'
import AgentChatPanel from '../components/operator/AgentChatPanel.jsx'

export default function AICodingView() {
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

      <AgentChatPanel
        placeholder='"What does daemon/src/server.ts do?" or "show me the git diff of master"'
      />
    </div>
  )
}
