import { useState } from 'react'
import { Code2, Play, GitBranch, Loader, AlertCircle } from 'lucide-react'
import { localMCPStorage } from '../mcp/storage/localMCPStorage.js'
import { getProvider } from '../mcp/services/mcpToolRegistry.js'

export default function AICodingView() {
  const [repoPath, setRepoPath] = useState('')
  const [output, setOutput] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)

  async function handleRun() {
    if (!repoPath.trim() || running) return
    setRunning(true)
    setError(null)
    setOutput(null)

    try {
      const tools = localMCPStorage.listTools()
      const gitStatusTool = tools.find((t) => t.toolName === 'git.status')
      if (!gitStatusTool) {
        setError('git.status tool not available. Is the daemon running? Try refreshing the Connections page.')
        return
      }

      const integration = localMCPStorage.getIntegration(gitStatusTool.integrationId)
      if (!integration) {
        setError('Local integration not found.')
        return
      }

      const provider = getProvider(integration.type)
      if (!provider) {
        setError('No provider available for integration type: ' + integration.type)
        return
      }

      const result = await provider.executeTool({
        integration,
        tool: gitStatusTool,
        input: { repoPath: repoPath.trim() },
      })

      if (result.success) {
        setOutput(result.output)
      } else {
        setError(result.error ?? 'Unknown error')
      }
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Code2 size={18} className="text-indigo-300" />
        <h1 className="text-xl font-semibold tracking-tight">AI Coding</h1>
      </div>
      <p className="text-[13px] text-white/45 mb-6">
        Inspect a repository via the operator daemon. Phase 2 adds richer agent loops with Context7 docs and Sequential Thinking.
      </p>

      <div className="rounded-xl border border-white/8 p-4 mb-4 bg-white/3">
        <label className="block text-[11px] uppercase tracking-widest text-white/40 mb-2">Repository path</label>
        <div className="flex gap-2">
          <input
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            placeholder="C:\Users\JenoU\Desktop\FlowMap"
            className="glass-input flex-1 text-[13px] font-mono"
          />
          <button
            onClick={handleRun}
            disabled={running || !repoPath.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 text-[13px] hover:bg-indigo-500/30 disabled:opacity-40 transition-colors"
          >
            {running ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
            <span>Inspect</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-[13px] mb-4">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {output && (
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-white/3">
            <GitBranch size={13} className="text-white/55" />
            <span className="text-[12px] text-white/55">Git Status</span>
            {output.branch && (
              <span className="ml-auto text-[12px] text-white/40 font-mono">{output.branch}</span>
            )}
          </div>
          <pre className="p-4 text-[12px] text-white/80 font-mono overflow-auto max-h-96 whitespace-pre-wrap">
{JSON.stringify(output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
