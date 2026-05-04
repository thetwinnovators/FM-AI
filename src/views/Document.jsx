import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Sparkles, Trash2, Save, Pencil, Plus, RefreshCw, Loader2, Copy, Check, Download } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import { useConfirm } from '../components/ui/ConfirmProvider.jsx'
import { OLLAMA_CONFIG } from '../lib/llm/ollamaConfig.js'
import FileTypeChip from '../components/document/FileTypeChip.jsx'

function formatDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso }
}

export default function Document() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { topics: seedTopics, topicById } = useSeed()
  const { documentById, documentContentById, updateDocument, removeDocument, userTopics, requestSummary } = useStore()
  const confirm = useConfirm()

  const meta = documentById(id)
  const content = documentContentById(id)

  const [copied, setCopied] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [tagsTouched, setTagsTouched] = useState(false)

  // Sync drafts when the underlying doc changes
  useEffect(() => {
    setTitleDraft(meta?.title || '')
    setTagsInput((meta?.tags || []).join(', '))
    setTagsTouched(false)
  }, [meta?.id, meta?.title]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist tags after a short idle (avoids a save per keystroke)
  const tagDebounceRef = useRef(null)
  useEffect(() => {
    if (!tagsTouched || !meta) return
    clearTimeout(tagDebounceRef.current)
    tagDebounceRef.current = setTimeout(() => {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
      updateDocument(meta.id, { tags })
    }, 600)
    return () => clearTimeout(tagDebounceRef.current)
  }, [tagsInput, tagsTouched, meta, updateDocument])

  const allTopics = useMemo(() => [
    ...seedTopics.map((t) => ({ id: t.id, name: t.name, isUser: false })),
    ...Object.values(userTopics).map((t) => ({ id: t.id, name: t.name, isUser: true })),
  ], [seedTopics, userTopics])

  if (!meta) {
    return (
      <div className="p-6">
        <Link to="/documents" className="text-sm text-[color:var(--color-text-tertiary)] hover:text-white inline-flex items-center gap-1">
          <ChevronLeft size={14} /> Back to documents
        </Link>
        <h1 className="text-2xl font-semibold mt-4">Document not found</h1>
      </div>
    )
  }

  function commitTitle() {
    const next = titleDraft.trim()
    if (!next) { setTitleDraft(meta.title); setEditingTitle(false); return }
    if (next !== meta.title) updateDocument(meta.id, { title: next })
    setEditingTitle(false)
  }

  function toggleTopic(topicId) {
    const has = (meta.topics || []).includes(topicId)
    const next = has
      ? (meta.topics || []).filter((t) => t !== topicId)
      : [...(meta.topics || []), topicId]
    updateDocument(meta.id, { topics: next })
  }

  async function askDelete() {
    const ok = await confirm({
      title: `Delete "${meta.title}"?`,
      message: 'This deletes the document and its content. Topic links and any future citations are removed.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) {
      removeDocument(meta.id)
      navigate('/documents')
    }
  }

  const linkedTopicIds = new Set(meta.topics || [])

  return (
    <div className="p-6">
      <Link to="/documents" className="text-sm text-[color:var(--color-text-tertiary)] hover:text-white inline-flex items-center gap-1 mb-4">
        <ChevronLeft size={14} /> Back to documents
      </Link>

      <header className="glass-panel p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <FileTypeChip sourceType={meta.sourceType} fileName={meta.fileName} />
          {meta.fileName ? (
            <span className="text-[11px] text-[color:var(--color-text-tertiary)] font-mono truncate" title={meta.fileName}>
              {meta.fileName}
            </span>
          ) : null}
          <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
            {meta.fileName ? '· ' : ''}{meta.wordCount || 0} words · created {formatDate(meta.createdAt)}
            {meta.updatedAt && meta.updatedAt !== meta.createdAt ? ` · updated ${formatDate(meta.updatedAt)}` : ''}
          </span>
          <button
            onClick={askDelete}
            aria-label="Delete document"
            title="Delete document"
            className="ml-auto inline-flex items-center justify-center p-1.5 rounded-md text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 border border-rose-500/30 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(meta.title); setEditingTitle(false) } }}
              className="flex-1 glass-input text-2xl font-semibold tracking-tight"
            />
            <button onClick={commitTitle} className="btn">
              <Save size={13} /> Save
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <h1 className="text-3xl font-semibold tracking-tight flex-1">{meta.title}</h1>
            <button
              onClick={() => setEditingTitle(true)}
              className="p-2 rounded-md border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-glass)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-glass-strong)]"
              aria-label="Edit title"
              title="Edit title"
            >
              <Pencil size={13} />
            </button>
          </div>
        )}

        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
            Topics
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTopics.map((t) => {
              const on = linkedTopicIds.has(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTopic(t.id)}
                  className={`text-[11px] uppercase tracking-wide font-medium px-2 py-0.5 rounded border transition-colors ${
                    on
                      ? 'text-[color:var(--color-topic)] border-[color:var(--color-topic)]/40 bg-[color:var(--color-topic)]/10'
                      : 'text-[color:var(--color-text-secondary)] border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] hover:bg-[color:var(--color-bg-glass-strong)]'
                  }`}
                >
                  {on ? null : <Plus size={10} className="inline mr-0.5" />}
                  {t.name}{t.isUser ? ' · saved' : ''}
                </button>
              )
            })}
            {allTopics.length === 0 ? (
              <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
                No topics yet. Save a search or follow a seed topic.
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="doc-tags" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
            Tags <span className="text-[color:var(--color-text-tertiary)] normal-case ml-1">(comma-separated)</span>
          </label>
          <input
            id="doc-tags"
            value={tagsInput}
            onChange={(e) => { setTagsInput(e.target.value); setTagsTouched(true) }}
            placeholder="research, notes, claude"
            className="w-full glass-input text-sm"
          />
        </div>
      </header>

      {/* Summary — generated via Ollama when enabled, falls back to excerpt otherwise */}
      <section className="glass-panel p-5 mb-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[color:var(--color-text-tertiary)]" />
            <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium">Summary</h2>
            {meta.summaryStatus === 'pending' ? (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[color:var(--color-text-tertiary)]">
                <Loader2 size={10} className="animate-spin" /> generating
              </span>
            ) : null}
          </div>
          {OLLAMA_CONFIG.enabled ? (
            <button
              onClick={() => requestSummary(meta.id)}
              disabled={meta.summaryStatus === 'pending'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-glass)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-glass-strong)] disabled:opacity-40 disabled:cursor-not-allowed"
              title={meta.summary ? 'Regenerate summary' : 'Generate summary'}
            >
              <RefreshCw size={12} className={meta.summaryStatus === 'pending' ? 'animate-spin' : ''} />
              {meta.summary ? 'Regenerate' : 'Generate'}
            </button>
          ) : null}
        </div>
        {meta.summary ? (
          <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">{meta.summary}</p>
        ) : meta.summaryStatus === 'failed' ? (
          <p className="text-sm text-amber-300">
            Couldn't generate a summary. Check that Ollama is running (<code className="text-[color:var(--color-text-tertiary)]">docker ps</code>) and the model is pulled.
            Excerpt fallback below.
          </p>
        ) : !OLLAMA_CONFIG.enabled ? (
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            Enable Ollama in the gear menu (top right) to auto-summarize new documents. Until then the excerpt is the first 240 characters of your paste.
          </p>
        ) : (
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            Click <strong>Generate</strong> above to summarize this document.
          </p>
        )}
        {!meta.summary && meta.excerpt ? (
          <p className="mt-3 text-[12px] italic text-[color:var(--color-text-tertiary)] line-clamp-3">"{meta.excerpt}"</p>
        ) : null}
      </section>

      {/* Content viewer */}
      <section className="rounded-lg border border-black/10 bg-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">Content</h2>
          {content?.plainText ? (
            <div className="flex items-center gap-1">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(content.plainText)
                  } catch {
                    try {
                      const el = document.createElement('textarea')
                      el.value = content.plainText
                      el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0'
                      document.body.appendChild(el)
                      el.focus()
                      el.select()
                      document.execCommand('copy')
                      document.body.removeChild(el)
                    } catch { /* truly blocked */ }
                  }
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-gray-500 hover:text-gray-800 hover:bg-slate-200 transition-colors"
                title="Copy content"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([content.plainText], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${content.title || 'document'}.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-gray-500 hover:text-gray-800 hover:bg-slate-200 transition-colors"
                title="Download as .txt"
              >
                <Download size={13} /> Download
              </button>
            </div>
          ) : null}
        </div>
        {content?.plainText ? (
          <pre className="whitespace-pre-wrap break-words text-base leading-relaxed text-gray-800 font-sans max-h-[70vh] overflow-auto">
            {content.plainText}
          </pre>
        ) : (
          <p className="text-sm text-gray-500">Content unavailable.</p>
        )}
      </section>
    </div>
  )
}
