import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Download, Upload, Database, Globe, Sparkles, Check, AlertCircle, Sun, Moon, RefreshCw, Volume2, ShieldCheck, TrendingUp } from 'lucide-react'
import { downloadSnapshot, readSnapshotFile, validateSnapshot, summarizeSnapshot, importSnapshotReplace } from '../../lib/snapshot.js'
import { SEARCH_CONFIG, setSearxngEnabled } from '../../lib/search/searchConfig.js'
import { OLLAMA_CONFIG, setOllamaEnabled, setOllamaModel } from '../../lib/llm/ollamaConfig.js'
import { VOICE_CONFIG, setVoiceEnabled } from '../../lib/voice/voiceConfig.js'
import { VT_CONFIG, setVtApiKey } from '../../lib/virustotal.js'
import { flowTradeApi } from '../../flow-trade/api.js'
import { stopVoice } from '../../lib/voice/player.js'
import { getTheme, setTheme } from '../../lib/theme.js'
import { syncState, subscribeSyncStatus, pullSyncedState } from '../../store/useStore.js'
import { useConfirm } from '../ui/ConfirmProvider.jsx'
import LocalOperatorPanel from '../settings/LocalOperatorPanel.jsx'

const LIQUID_GLASS = {
  background: 'linear-gradient(160deg, rgba(15,17,28,0.96) 0%, rgba(8,10,18,0.98) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow:
    '0 24px 48px rgba(0,0,0,0.55),' +
    '0 8px 16px rgba(0,0,0,0.40),' +
    'inset 0 1px 0 rgba(255,255,255,0.10)',
}

export default function SettingsMenu({ anchorRef, open, onClose }) {
  const fileInputRef = useRef(null)
  const menuRef = useRef(null)
  const confirm = useConfirm()
  const [status, setStatus] = useState(null) // { kind: 'ok' | 'error', message: string }
  const [searxngEnabled, setSearxngEnabledState] = useState(SEARCH_CONFIG.searxngEnabled)
  const [ollamaEnabled, setOllamaEnabledState] = useState(OLLAMA_CONFIG.enabled)
  const [voiceEnabled, setVoiceEnabledState] = useState(VOICE_CONFIG.enabled)
  const [theme, setThemeState] = useState(getTheme())
  const [sync, setSync] = useState({ ...syncState })
  const [model, setModelState] = useState(OLLAMA_CONFIG.model)
  const [availableModels, setAvailableModels] = useState([])
  const [vtKey, setVtKeyState] = useState(VT_CONFIG.apiKey)
  const [alpacaKey,        setAlpacaKey]        = useState('')
  const [alpacaSecret,     setAlpacaSecret]     = useState('')
  const [alpacaHint,       setAlpacaHint]       = useState(null)
  const [alpacaSaving,     setAlpacaSaving]     = useState(false)
  const [alpacaSaveStatus, setAlpacaSaveStatus] = useState(null)

  // Subscribe to live sync status updates so the menu's pip reflects pushes/pulls.
  useEffect(() => {
    const unsub = subscribeSyncStatus(() => setSync({ ...syncState }))
    return unsub
  }, [])

  // Reset transient status when reopening
  useEffect(() => {
    if (!open) return
    setStatus(null)
    setSearxngEnabledState(SEARCH_CONFIG.searxngEnabled)
    setOllamaEnabledState(OLLAMA_CONFIG.enabled)
    setVoiceEnabledState(VOICE_CONFIG.enabled)
    setThemeState(getTheme())
    setVtKeyState(VT_CONFIG.apiKey)
    setAlpacaKey('')
    setAlpacaSecret('')
    setAlpacaSaveStatus(null)
  }, [open])

  // Load Alpaca key hint from daemon whenever menu opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    flowTradeApi.getCredentials()
      .then((c) => { if (!cancelled) setAlpacaHint(c?.keyHint ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open])

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    function onClick(e) {
      if (menuRef.current?.contains(e.target)) return
      if (anchorRef?.current?.contains(e.target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  const anchorRect = anchorRef?.current?.getBoundingClientRect()
  if (!anchorRect) return null

  // Anchor below the gear, right-aligned to the gear's right edge
  const top = anchorRect.bottom + 8
  const right = window.innerWidth - anchorRect.right

  function onExport() {
    try {
      const env = downloadSnapshot()
      const s = summarizeSnapshot(env)
      setStatus({ kind: 'ok', message: `Exported ${s.saves} saves, ${s.userTopics} topics, ${s.manualContent} URLs.` })
    } catch (err) {
      setStatus({ kind: 'error', message: err?.message || 'Export failed.' })
    }
  }

  async function onFileChosen(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = await readSnapshotFile(file)
      const v = validateSnapshot(parsed)
      if (!v.ok) { setStatus({ kind: 'error', message: v.error }); return }
      const s = summarizeSnapshot(parsed)
      const proceed = await confirm({
        title: `Replace local data with "${file.name}"?`,
        message:
          `Snapshot contains: ${s.saves} saved items, ${s.userTopics} user topics, ${s.manualContent} added URLs, ${s.memoryEntries} memory entries. ` +
          `Your current state will be overwritten and the page will reload.`,
        confirmLabel: 'Replace and reload',
        danger: true,
      })
      if (!proceed) return
      importSnapshotReplace(parsed)
      setStatus({ kind: 'ok', message: 'Imported. Reloading…' })
      setTimeout(() => window.location.reload(), 600)
    } catch (err) {
      setStatus({ kind: 'error', message: err?.message || 'Failed to read file.' })
    } finally {
      e.target.value = ''
    }
  }

  function onToggleSearxng() {
    const next = !searxngEnabled
    setSearxngEnabled(next)
    setSearxngEnabledState(next)
  }

  function onToggleOllama() {
    const next = !ollamaEnabled
    setOllamaEnabled(next)
    setOllamaEnabledState(next)
  }

  function onToggleVoice() {
    const next = !voiceEnabled
    setVoiceEnabled(next)
    setVoiceEnabledState(next)
    // Stop anything currently speaking when the user disables the feature.
    if (!next) stopVoice()
  }

  function onPickTheme(next) {
    setTheme(next)
    setThemeState(next)
  }

  async function handleSaveAlpaca() {
    const key    = alpacaKey.trim()
    const secret = alpacaSecret.trim()
    if (!key || !secret) return
    setAlpacaSaving(true)
    setAlpacaSaveStatus(null)
    try {
      const result = await flowTradeApi.saveCredentials(key, secret)
      setAlpacaHint(key.slice(0, 4) + '…')
      setAlpacaKey('')
      setAlpacaSecret('')
      setAlpacaSaveStatus({ ok: true, message: result?.connected ? 'Connected!' : 'Saved.' })
      setTimeout(() => setAlpacaSaveStatus(null), 3000)
    } catch (err) {
      setAlpacaSaveStatus({ ok: false, message: err?.message ?? 'Save failed' })
      setTimeout(() => setAlpacaSaveStatus(null), 4000)
    } finally {
      setAlpacaSaving(false)
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Settings"
      className="fixed z-[90] w-[280px] rounded-2xl overflow-hidden"
      style={{ top, right, ...LIQUID_GLASS }}
    >
      <div className="absolute top-0 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

      <div className="p-1.5">
        <button
          onClick={onExport}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/90 hover:bg-white/[0.06] transition-colors"
        >
          <Download size={14} className="text-[color:var(--color-text-tertiary)]" />
          Export snapshot
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/90 hover:bg-white/[0.06] transition-colors"
        >
          <Upload size={14} className="text-[color:var(--color-text-tertiary)]" />
          Import snapshot
        </button>
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={onFileChosen} />

        <div className="my-1.5 border-t border-white/[0.08]" />

        <button
          onClick={onToggleSearxng}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/90 hover:bg-white/[0.06] transition-colors"
        >
          <Globe size={14} className="text-[color:var(--color-text-tertiary)]" />
          <span className="flex-1 text-left">SearXNG broad-web</span>
          <span
            className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded border ${
              searxngEnabled
                ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
                : 'text-[color:var(--color-text-tertiary)] border-white/15 bg-white/[0.04]'
            }`}
          >
            {searxngEnabled ? 'on' : 'off'}
          </span>
        </button>

        <button
          onClick={onToggleOllama}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/90 hover:bg-white/[0.06] transition-colors"
        >
          <Sparkles size={14} className="text-[color:var(--color-text-tertiary)]" />
          <span className="flex-1 text-left">Ollama AI summaries</span>
          <span
            className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded border ${
              ollamaEnabled
                ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
                : 'text-[color:var(--color-text-tertiary)] border-white/15 bg-white/[0.04]'
            }`}
          >
            {ollamaEnabled ? 'on' : 'off'}
          </span>
        </button>

        <LocalOperatorPanel />

        <button
          onClick={onToggleVoice}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/90 hover:bg-white/[0.06] transition-colors"
          title="Speak assistant replies aloud via ElevenLabs TTS. Requires ELEVENLABS_API_KEY on the dev server."
        >
          <Volume2 size={14} className="text-[color:var(--color-text-tertiary)]" />
          <span className="flex-1 text-left">Voice responses</span>
          <span
            className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded border ${
              voiceEnabled
                ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
                : 'text-[color:var(--color-text-tertiary)] border-white/15 bg-white/[0.04]'
            }`}
          >
            {voiceEnabled ? 'on' : 'off'}
          </span>
        </button>

        <div className="my-1.5 border-t border-white/[0.08]" />

        {/* Alpaca Paper Trading credentials */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-[color:var(--color-text-tertiary)] flex-shrink-0" />
            <span className="text-sm text-white/90">Alpaca Paper Trading</span>
            {alpacaHint && (
              <span className="ml-auto text-[10px] font-mono text-emerald-400/70">{alpacaHint}</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              value={alpacaKey}
              onChange={(e) => setAlpacaKey(e.target.value)}
              placeholder="API Key (PK…)"
              className="w-full bg-white/[0.05] border border-white/[0.10] rounded px-2 py-1 text-[11px] font-mono text-white/80 placeholder:text-white/25 outline-none focus:border-white/25"
            />
            <input
              type="password"
              value={alpacaSecret}
              onChange={(e) => setAlpacaSecret(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAlpaca() }}
              placeholder="Secret…"
              className="w-full bg-white/[0.05] border border-white/[0.10] rounded px-2 py-1 text-[11px] text-white/80 placeholder:text-white/25 outline-none focus:border-white/25"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveAlpaca}
                disabled={alpacaSaving || !alpacaKey.trim() || !alpacaSecret.trim()}
                className="px-3 py-1 rounded text-[11px] font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300/90 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
              >
                {alpacaSaving ? 'Saving…' : 'Save & connect'}
              </button>
              {alpacaSaveStatus && (
                <span className={`text-[10px] ${alpacaSaveStatus.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {alpacaSaveStatus.message}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="my-1.5 border-t border-white/[0.08]" />

        {/* VirusTotal API key */}
        <div className="flex items-center gap-2.5 px-3 py-2">
          <ShieldCheck size={14} className="text-[color:var(--color-text-tertiary)] flex-shrink-0" />
          <span className="text-sm text-white/90 flex-shrink-0">VirusTotal</span>
          <input
            type="password"
            value={vtKey}
            onChange={(e) => setVtKeyState(e.target.value)}
            onBlur={() => setVtApiKey(vtKey.trim())}
            onKeyDown={(e) => { if (e.key === 'Enter') { setVtApiKey(vtKey.trim()); e.target.blur() } }}
            placeholder="API key…"
            className="flex-1 min-w-0 bg-white/[0.05] border border-white/[0.10] rounded px-2 py-0.5 text-[11px] text-white/80 placeholder:text-white/25 outline-none focus:border-white/25"
          />
        </div>

        <div className="my-1.5 border-t border-white/[0.08]" />

        {/* Cross-browser sync status — clicking forces a fresh pull from disk. */}
        <button
          onClick={() => pullSyncedState()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/90 hover:bg-white/[0.06] transition-colors"
          title={sync.error || 'Click to re-sync'}
        >
          <RefreshCw
            size={14}
            className={`text-[color:var(--color-text-tertiary)] ${sync.status === 'pulling' || sync.status === 'pushing' ? 'animate-spin' : ''}`}
          />
          <span className="flex-1 text-left">Local sync</span>
          <span
            className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded border ${
              sync.status === 'synced'
                ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
                : sync.status === 'offline'
                  ? 'text-amber-300 border-amber-400/40 bg-amber-500/10'
                  : 'text-[color:var(--color-text-tertiary)] border-white/15 bg-white/[0.04]'
            }`}
          >
            {sync.status === 'synced' ? 'synced' : sync.status === 'offline' ? 'offline' : sync.status}
          </span>
        </button>

        <Link
          to="/memory"
          onClick={onClose}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/90 hover:bg-white/[0.06] transition-colors"
        >
          <Database size={14} className="text-[color:var(--color-text-tertiary)]" />
          Manage memory & data
        </Link>

        {status ? (
          <div
            className={`mt-1.5 mx-1 px-2.5 py-1.5 rounded-md border text-[11px] inline-flex items-start gap-1.5 ${
              status.kind === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200/90'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-200/90'
            }`}
          >
            {status.kind === 'ok' ? <Check size={11} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />}
            <span>{status.message}</span>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  )
}
