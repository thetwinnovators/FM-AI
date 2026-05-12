import { useEffect, useState } from 'react'
import { Folder, Plus, X, RefreshCw, AlertCircle } from 'lucide-react'
import { daemonApi } from '../../mcp/services/daemonApi.js'

export default function WorkspaceRootsPanel() {
  const [roots, setRoots] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function refresh() {
    setError(null)
    try {
      setRoots(await daemonApi.listWorkspaceRoots())
    } catch (err) { setError(err?.message ?? String(err)) }
  }

  useEffect(() => { refresh() }, [])

  async function handleAdd() {
    if (!draft.trim() || busy) return
    setBusy(true); setError(null)
    try {
      setRoots(await daemonApi.addWorkspaceRoot(draft.trim()))
      setDraft('')
    } catch (err) { setError(err?.message ?? String(err)) }
    finally { setBusy(false) }
  }

  async function handleRemove(path) {
    if (busy) return
    setBusy(true); setError(null)
    try {
      setRoots(await daemonApi.removeWorkspaceRoot(path))
    } catch (err) { setError(err?.message ?? String(err)) }
    finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-white/8 p-5 bg-white/3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[14px] font-medium text-white/90">Workspace Roots</h2>
          <p className="text-[12px] text-white/45 mt-0.5">
            Directories the operator daemon is allowed to read, write, and run commands in.
          </p>
        </div>
        <button
          onClick={refresh}
          className="p-1.5 rounded-md text-white/45 hover:text-white/80 hover:bg-white/5"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-[12px] mb-3">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5 mb-3">
        {roots.length === 0 && (
          <div className="text-[12px] text-white/30 italic">No workspace roots configured.</div>
        )}
        {roots.map((path) => (
          <div key={path} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/4 border border-white/6">
            <Folder size={13} className="text-white/40 flex-shrink-0" />
            <span className="flex-1 text-[12px] font-mono text-white/80 truncate" title={path}>{path}</span>
            <button
              onClick={() => handleRemove(path)}
              disabled={busy}
              className="p-1 rounded text-white/40 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40"
              title="Remove"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="C:\Users\JenoU\Desktop\Clari"
          className="glass-input flex-1 text-[12px] font-mono"
          disabled={busy}
        />
        <button
          onClick={handleAdd}
          disabled={busy || !draft.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 text-[12px] hover:bg-indigo-500/30 disabled:opacity-40 transition-colors"
        >
          <Plus size={12} /> Add root
        </button>
      </div>
    </div>
  )
}
