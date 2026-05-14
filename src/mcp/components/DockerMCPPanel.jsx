import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, Trash2, Circle, ChevronDown, ChevronRight, X, Download } from 'lucide-react'

async function getDaemonInfo() {
  try {
    const r = await fetch('/api/daemon/info')
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

async function daemonFetch(method, path, body) {
  const info = await getDaemonInfo()
  if (!info) throw new Error('Daemon offline — start FlowMap dev server')
  const res = await fetch(`http://127.0.0.1:${info.port}${path}`, {
    method,
    headers: { Authorization: `Bearer ${info.token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  return res.json()
}

function ServerRow({ server, onToggle, onRemove }) {
  const [expanded, setExpanded] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [removing, setRemoving] = useState(false)

  const { status, config, tools = [], error } = server

  const dotClass =
    status === 'connected' ? 'fill-emerald-400 text-emerald-400' :
    status === 'error'     ? 'fill-rose-400 text-rose-400' :
                             'fill-white/20 text-white/20'

  async function handleToggle() {
    setToggling(true)
    try { await onToggle(config.id, !config.enabled) }
    finally { setToggling(false) }
  }

  async function handleRemove() {
    setRemoving(true)
    try { await onRemove(config.id) }
    finally { setRemoving(false) }
  }

  return (
    <div
      className="rounded-xl border border-white/[0.07] overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Circle size={7} className={`flex-shrink-0 ${dotClass}`} />

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-white/85 leading-tight">{config.name}</div>
          <div className="text-[11px] text-white/30 font-mono truncate mt-0.5">{config.image}</div>
        </div>

        {tools.length > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60 transition-colors flex-shrink-0"
          >
            {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        )}

        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 flex-shrink-0 ${
            config.enabled
              ? 'border-emerald-500/30 text-emerald-400/70 hover:bg-emerald-500/10'
              : 'border-white/[0.08] text-white/30 hover:bg-white/5'
          }`}
        >
          {toggling ? '…' : config.enabled ? 'Enabled' : 'Disabled'}
        </button>

        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-white/20 hover:text-rose-400 transition-colors disabled:opacity-30 flex-shrink-0"
          title="Remove server"
        >
          {removing ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      </div>

      {status === 'error' && error && (
        <div className="px-4 pb-3 pt-0 text-[11px] text-rose-400/80 leading-relaxed">{error}</div>
      )}

      {expanded && tools.length > 0 && (
        <div className="border-t border-white/[0.05] px-4 py-2.5 flex flex-wrap gap-1.5">
          {tools.map((t) => (
            <span
              key={t.name}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/40"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function AddServerForm({ onAdd, onCancel }) {
  const [image, setImage] = useState('')
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!image.trim() || !name.trim()) return
    setAdding(true)
    setError(null)
    try {
      const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      await onAdd({ id, name: name.trim(), image: image.trim(), enabled: true })
    } catch (err) {
      setError(err.message)
      setAdding(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 p-4 rounded-xl border border-white/[0.07] space-y-3"
      style={{ background: 'rgba(255,255,255,0.03)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-white/50">Add Docker MCP server</p>
        <button type="button" onClick={onCancel} className="text-white/25 hover:text-white/60 transition-colors">
          <X size={13} />
        </button>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wide text-white/30 block mb-1">Docker image</label>
        <input
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="mcp/fetch:latest"
          className="glass-input w-full text-[12px] font-mono"
          required
          autoFocus
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wide text-white/30 block mb-1">Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fetch"
          className="glass-input w-full text-[12px]"
          required
        />
      </div>

      {error && (
        <p className="text-[11px] text-rose-300 bg-rose-500/10 rounded-lg px-3 py-2 border border-rose-500/20">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={adding || !image.trim() || !name.trim()}
          className="btn btn-primary text-[12px] disabled:opacity-40"
        >
          {adding ? 'Adding…' : 'Add & Connect'}
        </button>
        <button type="button" onClick={onCancel} className="btn text-[12px]">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function DockerMCPPanel() {
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null) // { added, updated } | null
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await daemonFetch('GET', '/docker-mcp/servers')
      setServers(data.servers ?? [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncing(true)
    try {
      const data = await daemonFetch('POST', '/docker-mcp/sync')
      setServers(data.servers ?? [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleImportFromDesktop() {
    setImporting(true)
    setImportResult(null)
    setError(null)
    try {
      const data = await daemonFetch('POST', '/docker-mcp/import-from-desktop', { profileId: 'flowmap' })
      setServers(data.servers ?? [])
      setImportResult({ added: data.added ?? 0, updated: data.updated ?? 0 })
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  async function handleToggle(id, enabled) {
    const data = await daemonFetch('PATCH', `/docker-mcp/servers/${id}`, { enabled })
    setServers(data.servers ?? [])
  }

  async function handleRemove(id) {
    const data = await daemonFetch('DELETE', `/docker-mcp/servers/${id}`)
    setServers(data.servers ?? [])
  }

  async function handleAdd(cfg) {
    const data = await daemonFetch('POST', '/docker-mcp/servers', cfg)
    setServers(data.servers ?? [])
    setShowAdd(false)
  }

  const connected = servers.filter((s) => s.status === 'connected').length
  const sorted = [...servers].sort((a, b) => {
    const order = { connected: 0, disconnected: 1, error: 2 }
    return (order[a.status] ?? 1) - (order[b.status] ?? 1)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[11px] uppercase tracking-wide text-white/40">Docker MCP Servers</h2>
          {!loading && (
            <p className="text-[11px] text-white/25 mt-0.5">
              {connected} of {servers.length} connected
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportFromDesktop}
            disabled={importing || syncing}
            title="Import all servers from your Docker Desktop MCP Toolkit 'flowmap' profile"
            className="flex items-center gap-1.5 text-[11px] text-teal-400/70 hover:text-teal-300 transition-colors disabled:opacity-40"
          >
            <Download size={11} className={importing ? 'animate-bounce' : ''} />
            {importing ? 'Importing…' : 'Import from Docker Desktop'}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/70 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="btn flex items-center gap-1.5 text-[12px]"
          >
            <Plus size={12} /> Add Server
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
          {error}
        </div>
      )}

      {importResult && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-300 flex items-center justify-between">
          <span>
            Imported from Docker Desktop — {importResult.added} added, {importResult.updated} updated
          </span>
          <button onClick={() => setImportResult(null)} className="text-teal-400/50 hover:text-teal-300 ml-3">
            <X size={11} />
          </button>
        </div>
      )}

      {showAdd && (
        <AddServerForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
      )}

      {loading ? (
        <div className="text-[12px] text-white/25 py-4">Loading servers…</div>
      ) : sorted.length === 0 ? (
        <div className="text-[12px] text-white/25 py-4">
          No servers configured. Add one above or edit{' '}
          <code className="font-mono text-[11px] text-white/35">~/.flowmap/docker-mcp-servers.json</code>.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((s) => (
            <ServerRow
              key={s.config.id}
              server={s}
              onToggle={handleToggle}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}
