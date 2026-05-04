import { useEffect, useMemo, useState } from 'react'
import { Sparkles, RefreshCw, FileText, AlertCircle, Copy, Check } from 'lucide-react'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import { topicStats, itemSignature, generateTopicOverview } from '../../lib/chat/summarize.js'
import { useStore } from '../../store/useStore.js'

function relativeDate(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Math.floor((Date.now() - t) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatCounts(counts) {
  const labels = [
    ['article', 'article'],
    ['video', 'video'],
    ['social_post', 'post'],
    ['document', 'doc'],
  ]
  const parts = []
  for (const [key, label] of labels) {
    const n = counts[key] || 0
    if (n > 0) parts.push(`${n} ${label}${n === 1 ? '' : 's'}`)
  }
  if (counts.other) parts.push(`${counts.other} other`)
  return parts.join(' · ')
}

// Renders the per-topic "Your collection" card. Stats + top sources are
// derived live from items and always visible. The AI overview line is cached
// in the store and auto-generated on first visit when Ollama is on; the
// "Generate full summary" button hands off to the parent via onGenerate.
export default function SummaryCard({ topic, items, onGenerate }) {
  const { topicSummaries, setTopicSummary } = useStore()
  const cached = topicSummaries?.[topic?.id] || null

  const stats = useMemo(() => topicStats(items), [items])
  const sig = useMemo(() => itemSignature(items), [items])
  const isStale = cached?.itemSignature && cached.itemSignature !== sig

  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = cached?.overview
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      try {
        const el = document.createElement('textarea')
        el.value = text
        el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0'
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      } catch { /* truly blocked — still show feedback */ }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function refreshOverview() {
    if (!topic?.id || !OLLAMA_CONFIG.enabled || items.length === 0 || running) return
    setRunning(true)
    setError(null)
    try {
      const text = await generateTopicOverview(topic, items)
      if (text) {
        setTopicSummary(topic.id, {
          overview: text,
          generatedAt: new Date().toISOString(),
          itemSignature: sig,
        })
      } else {
        setError('No response — is Ollama running?')
      }
    } catch (e) {
      setError(e?.message || 'Generation failed')
    } finally {
      setRunning(false)
    }
  }

  // Auto-generate on first visit when there's no cached overview yet.
  useEffect(() => {
    if (!topic?.id || cached?.overview || items.length === 0 || !OLLAMA_CONFIG.enabled) return
    refreshOverview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id, items.length])

  if (items.length === 0) return null  // hide on empty topics

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium">
          Summary
        </h3>
        <div className="flex items-center gap-0.5">
          {cached?.overview ? (
            <button
              onClick={handleCopy}
              className={`rounded-md transition-all flex items-center gap-1
                ${copied
                  ? 'px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-400/25 text-emerald-400'
                  : 'p-1 text-[color:var(--color-text-tertiary)] hover:text-white hover:bg-white/[0.06]'
                }`}
              title={copied ? 'Copied!' : 'Copy summary'}
              aria-label="Copy summary"
            >
              {copied ? (
                <>
                  <Check size={20} style={{ animation: 'copiedPop 0.2s cubic-bezier(0.34,1.56,0.64,1) both' }} />
                  <span className="text-[10px] font-medium" style={{ animation: 'copiedFade 0.2s ease both' }}>Copied</span>
                </>
              ) : (
                <Copy size={20} />
              )}
            </button>
          ) : null}
          {OLLAMA_CONFIG.enabled ? (
            <button
              onClick={refreshOverview}
              disabled={running}
              className="p-1 rounded-md text-[color:var(--color-text-tertiary)] hover:text-white hover:bg-white/[0.06] disabled:opacity-40 transition-colors"
              title="Regenerate overview"
              aria-label="Regenerate overview"
            >
              <RefreshCw size={20} className={running ? 'animate-spin' : ''} />
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-[12px] text-white/85 leading-relaxed">
        {formatCounts(stats.counts) || `${stats.total} item${stats.total === 1 ? '' : 's'}`}
      </p>
      {stats.topHosts.length ? (
        <p className="text-[11px] text-[color:var(--color-text-tertiary)] mt-1 truncate" title={stats.topHosts.join(', ')}>
          Top: {stats.topHosts.join(', ')}
        </p>
      ) : null}
      {stats.lastAddedAt ? (
        <p className="text-[11px] text-[color:var(--color-text-tertiary)] mt-1">
          Last add: {relativeDate(stats.lastAddedAt)}
        </p>
      ) : null}

      {OLLAMA_CONFIG.enabled ? (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          {cached?.overview ? (
            <p
              className="text-white/85 leading-relaxed"
              style={{ fontFamily: '"Montserrat", system-ui, sans-serif', fontSize: '14px', fontWeight: 400, fontStyle: 'normal' }}
            >
              {cached.overview}
              {isStale ? (
                <span className="block mt-1.5 text-[10px] text-amber-300/80 inline-flex items-center gap-1" style={{ fontFamily: 'inherit' }}>
                  <AlertCircle size={10} /> Out of date — regenerate to refresh
                </span>
              ) : null}
            </p>
          ) : running ? (
            <p className="text-[11px] text-[color:var(--color-text-tertiary)] inline-flex items-center gap-1.5">
              <Sparkles size={11} className="animate-pulse" /> Generating overview…
            </p>
          ) : error ? (
            <p className="text-[11px] text-amber-300/80">{error}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 pt-3 border-t border-white/[0.06] text-[11px] text-[color:var(--color-text-tertiary)] inline-flex items-center gap-1.5">
          <Sparkles size={11} /> Turn on Ollama for an AI overview.
        </p>
      )}

      <button
        onClick={onGenerate}
        disabled={!OLLAMA_CONFIG.enabled || running}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-white bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <FileText size={12} /> Generate full summary
      </button>
    </div>
  )
}
