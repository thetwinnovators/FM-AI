import { useRef, useState } from 'react'
import { Download, Upload, AlertCircle, Check, Database, ShieldAlert } from 'lucide-react'
import { downloadSnapshot, readSnapshotFile, validateSnapshot, summarizeSnapshot, importSnapshotReplace, SNAPSHOT_SCHEMA_VERSION } from '../../lib/snapshot.js'
import { useConfirm } from '../ui/ConfirmProvider.jsx'

export default function BackupPanel() {
  const fileInputRef = useRef(null)
  const [status, setStatus] = useState(null) // { kind: 'ok' | 'error', message: string }
  const confirm = useConfirm()

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

  return (
    <div className="space-y-4 max-w-[760px]">
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
