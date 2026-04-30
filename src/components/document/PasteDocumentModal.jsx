import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, FileText, Plus, Check, Upload } from 'lucide-react'
import { useSeed } from '../../store/useSeed.js'
import { useStore } from '../../store/useStore.js'

const LIQUID_GLASS = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.07) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.15)',
  boxShadow:
    '0 30px 80px rgba(0,0,0,0.65),' +
    '0 8px 24px rgba(0,0,0,0.35),' +
    'inset 0 1px 0 rgba(255,255,255,0.20),' +
    'inset 0 -1px 0 rgba(255,255,255,0.05)',
}

// Heuristic: pull a sensible title out of the first non-empty line of the paste.
function suggestTitle(text) {
  if (!text) return ''
  let first = String(text).split('\n').map((l) => l.trim()).find(Boolean) || ''
  // If it looks like a chat dump ("User:", "You:", "Assistant:"), take the line after.
  if (/^(user|you|assistant|me|chatgpt|claude)\s*:/i.test(first)) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    first = lines[1] || first
  }
  // Strip leading markdown heading markers and surrounding markdown wrappers
  // so titles look clean (e.g. "# Flow Map" → "Flow Map").
  first = first.replace(/^#{1,6}\s+/, '').replace(/^[*_]+|[*_]+$/g, '').trim()
  return first.slice(0, 80)
}

export default function PasteDocumentModal({ open, onClose, defaultTopicId, autoOpenFilePicker = false }) {
  const navigate = useNavigate()
  const { topics: seedTopics } = useSeed()
  const { userTopics, addDocument, requestSummary } = useStore()

  const allTopics = useMemo(() => [
    ...seedTopics.map((t) => ({ id: t.id, name: t.name, isUser: false })),
    ...Object.values(userTopics).map((t) => ({ id: t.id, name: t.name, isUser: true })),
  ], [seedTopics, userTopics])

  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [topicId, setTopicId] = useState(defaultTopicId || '')
  const [tagsInput, setTagsInput] = useState('')
  const [sourceType, setSourceType] = useState('pasted')
  const [fileName, setFileName] = useState(null)
  const fileInputRef = useRef(null)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setText(''); setTitle(''); setTitleTouched(false)
    setTopicId(defaultTopicId || ''); setTagsInput('')
    setSourceType('pasted'); setFileName(null)
    if (autoOpenFilePicker) {
      // Wait one tick so the input is mounted, then open the OS file picker.
      setTimeout(() => fileInputRef.current?.click(), 50)
    }
  }, [open, defaultTopicId, autoOpenFilePicker])

  async function onPickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Phase 2 supports text-based files only — .txt and .md. PDFs and docx
    // need binary parsing which lands later (likely Tauri-side).
    const okExt = /\.(txt|md|markdown)$/i.test(file.name)
    if (!okExt) {
      alert('Only .txt and .md files are supported in this phase.')
      e.target.value = ''
      return
    }
    try {
      const content = await file.text()
      setText(content)
      setFileName(file.name)
      setSourceType('upload')
      // Auto-fill title from filename if user hasn't typed one yet.
      if (!titleTouched) {
        setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 80))
      }
    } catch {
      alert('Failed to read the file.')
    } finally {
      e.target.value = ''
    }
  }

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Auto-fill title from the paste until the user types one explicitly.
  useEffect(() => {
    if (titleTouched) return
    setTitle(suggestTitle(text))
  }, [text, titleTouched])

  if (!open) return null

  const trimmed = text.trim()
  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0
  const canSave = trimmed.length >= 1 && title.trim().length >= 1

  function handleSave() {
    if (!canSave) return
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    const meta = addDocument({
      title: title.trim(),
      plainText: trimmed,
      sourceType,
      fileName: fileName || null,
      topics: topicId ? [topicId] : [],
      tags,
    })
    onClose()
    if (meta?.id) {
      // Phase 2: kick off background summary via Ollama. No-op if disabled.
      requestSummary(meta.id)
      navigate(`/documents/${meta.id}`)
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[720px] max-h-[90vh] flex flex-col rounded-3xl overflow-hidden"
        style={LIQUID_GLASS}
      >
        <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />

        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText size={16} className="text-[color:var(--color-topic)]" />
            <h2 className="text-base font-semibold text-white">
              {sourceType === 'upload' ? 'New document from file' : 'New document from text'}
            </h2>
            {fileName ? (
              <span className="text-[11px] text-[color:var(--color-text-tertiary)] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.03]">
                <Upload size={10} /> {fileName}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn text-xs"
              title="Upload a .txt or .md file"
            >
              <Upload size={12} /> Upload file
            </button>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" className="hidden" onChange={onPickFile} />
            <button onClick={onClose} className="btn p-2" aria-label="Close"><X size={14} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          <div>
            <label htmlFor="paste-doc-title" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
              Title *
            </label>
            <input
              id="paste-doc-title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleTouched(true) }}
              placeholder="Auto-filled from your paste"
              className="glass-input w-full text-sm"
            />
          </div>

          <div>
            <label htmlFor="paste-doc-text" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
              Content *
              {wordCount > 0 ? (
                <span className="text-white/30 normal-case ml-2">({wordCount} word{wordCount === 1 ? '' : 's'})</span>
              ) : null}
            </label>
            <textarea
              id="paste-doc-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a chat transcript, a long note, an article, anything you want FlowMap to remember…"
              rows={14}
              className="glass-input w-full text-sm resize-none font-mono"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="paste-doc-topic" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
                Topic <span className="text-white/30 normal-case ml-1">(optional)</span>
              </label>
              <select
                id="paste-doc-topic"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="glass-input w-full text-sm"
              >
                <option value="">— No topic —</option>
                {allTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.isUser ? ' (saved)' : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="paste-doc-tags" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
                Tags <span className="text-white/30 normal-case ml-1">(comma-separated)</span>
              </label>
              <input
                id="paste-doc-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="research, notes, claude"
                className="glass-input w-full text-sm"
              />
            </div>
          </div>
        </div>

        <footer className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-2 flex-shrink-0">
          <p className="text-[11px] text-[color:var(--color-text-tertiary)]">
            AI summaries land in Phase 2 once Ollama is wired in.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn text-sm">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="btn btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check size={13} /> Save document
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}
