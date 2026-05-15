import { useEffect, useRef, useState } from 'react'
import { Download, Upload, AlertCircle, Check, Database, ShieldAlert, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { downloadSnapshot, readSnapshotFile, validateSnapshot, summarizeSnapshot, importSnapshotReplace, SNAPSHOT_SCHEMA_VERSION } from '../../lib/snapshot.js'
import { pullSyncedState, subscribeSyncStatus, syncState } from '../../store/useStore.js'
import { useConfirm } from '../ui/ConfirmProvider.jsx'

export default function BackupPanel() {
  const fileInputRef = useRef(null)
  const [status, setStatus] = useState(null) // { kind: 'ok' | 'error', message: string }
  const [pulling, setPulling] = useState(false)
  const [sync, setSync] = useState(() => ({ ...syncState }))
  const confirm = useConfirm()

  useEffect(() => subscribeSyncStatus(() => setSync({ ...syncState })), [])

  function onExport() {
    try {
      const envelope = downloadSnapshot()
      const s = summarizeSnapshot(envelope)
      setStatus({ kind: 'ok', message: `Exported snapshot (${s.saves} saves, ${s.userTopics} user topics, ${s.manualContent} added URLs, ${s.memoryEntries} memory entries).` })
    } catch (err) {
      setStatus({ kind: 'error', message: err?.message || 'Export failed.' })
    }
  }

  function onPickFile() {
    fileInputRef.current?.click()
  }

  async function onFileChosen(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = await readSnapshotFile(file)
      const v = validateSnapshot(parsed)
      if (!v.ok) {
        setStatus({ kind: 'error', message: v.error })
        return
      }
      const s = summarizeSnapshot(parsed)
      const proceed = await confirm({
        title: `Replace local data with "${file.name}"?`,
        message:
          `Snapshot contains: ${s.saves} saved items, ${s.follows} followed topics, ` +
          `${s.userTopics} user-created topics, ${s.manualContent} added URLs, ` +
          `${s.memoryEntries} memory entries. Your current state will be overwritten and the page will reload. ` +
          `If you're not sure, export a backup first.`,
        confirmLabel: 'Replace and reload',
        danger: true,
      })
      if (!proceed) return
      importSnapshotReplace(parsed)
      setStatus({ kind: 'ok', message: `Imported ${file.name}. Reloading…` })
      setTimeout(() => window.location.reload(), 600)
    } catch (err) {
      setStatus({ kind: 'error', message: err?.message || 'Failed to read file.' })
    } finally {
      e.target.value = ''
    }
  }

  async function onRestoreFromDisk() {
    setPulling(true)
    setStatus(null)
    try {
      await pullSyncedState()
      const s = syncState
      if (s.status === 'synced') {
        setStatus({ kind: 'ok', message: 'Restored from disk — your data is now up to date.' })
      } else if (s.status === 'offline') {
        setStatus({ kind: 'error', message: `Disk sync unavailable: ${s.error || 'server not reachable'}. Is the Vite dev server running?` })
      }
    } catch (err) {
      setStatus({ kind: 'error', message: err?.message || 'Restore failed.' })
    } finally {
      setPulling(false)
    }
  }

  const syncOk    = sync.status === 'synced' || sync.status === 'pushing'
  const syncBusy  = sync.status === 'pulling' || sync.status === 'pushing'
  const syncLabel = sync.status === 'pulling' ? 'Pulling…' : sync.status === 'pushing' ? 'Saving…' : sync.status === 'synced' ? 'Synced' : sync.status === 'offline' ? 'Offline' : 'Idle'

  return (
    <div className="space-y-4 max-w-[760px]">

      {/* ── Disk sync / restore ─────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            {syncOk
              ? <Wifi size={18} className="text-emerald-400/80" />
              : <WifiOff size={18} className="text-amber-400/80" />}
            <h2 className="text-base font-semibold">Disk sync</h2>
          </div>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
            syncOk
              ? 'text-emerald-300/90 border-emerald-500/30 bg-emerald-500/8'
              : syncBusy
                ? 'text-sky-300/90 border-sky-500/30 bg-sky-500/8'
                : 'text-amber-300/90 border-amber-500/30 bg-amber-500/8'
          }`}>{syncLabel}</span>
        </div>
        <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
          While the Vite dev server is running, FlowMap continuously syncs to{' '}
          <code className="text-[11px] font-mono text-white/60 bg-white/5 px-1 py-0.5 rounded">~/.flowmap/state.json</code>.
          If your browser session shows missing data, click <strong>Restore from disk</strong> to re-pull that file immediately.
        </p>
        <div className="mt-4">
          <button
            onClick={onRestoreFromDisk}
            disabled={pulling}
            className="btn text-sm"
          >
            {pulling
              ? <><RefreshCw size={13} className="animate-spin" /> Restoring…</>
              : <><RefreshCw size={13} /> Restore from disk</>}
          </button>
          {sync.lastModified ? (
            <span className="ml-3 text-[11px] text-[color:var(--color-text-tertiary)]">
              Last synced {new Date(sync.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-3">
          <Database size={18} className="text-[color:var(--color-creator)]" />
          <h2 className="text-base font-semibold">Local data</h2>
        </div>
        <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
          FlowMap currently stores everything in your browser's localStorage. Until the SQLite layer ships, exports are your manual backup
          and disaster-recovery path. Cache and search results are excluded — they rebuild themselves.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={onExport} className="btn btn-primary text-sm">
            <Download size={13} /> Export snapshot
          </button>
          <button onClick={onPickFile} className="btn text-sm">
            <Upload size={13} /> Import snapshot
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFileChosen}
          />
          <span className="text-[11px] text-[color:var(--color-text-tertiary)] ml-1">
            schema v{SNAPSHOT_SCHEMA_VERSION}
          </span>
        </div>

        {status ? (
          <div
            className={`mt-4 inline-flex items-start gap-2 px-3 py-2 rounded-lg border text-[12px] ${
              status.kind === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200/90'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-200/90'
            }`}
          >
            {status.kind === 'ok' ? <Check size={13} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />}
            <span>{status.message}</span>
          </div>
        ) : null}
      </div>

      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={18} className="text-amber-300/80" />
          <h2 className="text-base font-semibold">Why this matters</h2>
        </div>
        <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
          localStorage lives inside this browser profile. If you clear site data, switch browsers, or the device fails, everything you've
          saved here is gone. Export a snapshot regularly until SQLite + scheduled backups land.
        </p>
      </div>

      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-3">
          <Database size={18} className="text-[color:var(--color-text-tertiary)]" />
          <h2 className="text-base font-semibold">Source preferences</h2>
        </div>
        <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
          Source weighting comes online when full live ingestion ships. Today the search mix is hard-coded:
          curated seed (high signal), tech news RSS (TechCrunch, The Verge, Ars Technica, Wired), Hacker News (high),
          web search, Reddit (varied), Wikipedia (background), and YouTube via Piped (videos).
        </p>
      </div>
    </div>
  )
}
