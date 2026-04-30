import { useState } from 'react'
import { NotebookPen, Plus, X } from 'lucide-react'
import { useStore } from '../../store/useStore.js'

function relTime(iso) {
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

// Sticky-note style notes for an article/video. Multiple notes per item, each
// with its own delete button. Add via the textarea + button at the bottom
// (Enter submits, Shift+Enter inserts a newline).
export default function NotesEditor({ itemId }) {
  const { notesFor, addNote, removeNote } = useStore()
  const notes = notesFor(itemId)
  const [draft, setDraft] = useState('')

  function submit() {
    const text = draft.trim()
    if (!text) return
    addNote(itemId, text)
    setDraft('')
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <section className="mt-6">
      <h3 className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/50 font-semibold mb-3">
        <NotebookPen size={11} className="text-amber-300/80" /> My notes
        {notes.length > 0 ? (
          <span className="text-[10px] text-white/35 normal-case ml-1">· {notes.length}</span>
        ) : null}
      </h3>

      {notes.length > 0 ? (
        <ul className="space-y-2 mb-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="group relative pl-3 pr-8 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] transition-colors"
              style={{ boxShadow: 'inset 2px 0 0 var(--color-creator)' }}
            >
              <p className="text-[13px] leading-relaxed text-white/90 whitespace-pre-wrap break-words">
                {n.content}
              </p>
              <span className="block mt-1 text-[10px] text-[color:var(--color-text-tertiary)]">{relTime(n.addedAt)}</span>
              <button
                onClick={() => removeNote(itemId, n.id)}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-rose-300/70 hover:text-rose-200 hover:bg-rose-500/10"
                aria-label="Remove note"
                title="Remove note"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={notes.length > 0 ? 'Add another note…' : 'Add a note… (Enter to post, Shift+Enter for new line)'}
          rows={2}
          className="flex-1 text-[13px] leading-relaxed text-white/90 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-white/25 focus:bg-white/[0.07] placeholder:text-white/30 resize-y"
        />
        <button
          onClick={submit}
          disabled={!draft.trim()}
          className="btn self-end px-3 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Post note"
          title="Post note (Enter)"
        >
          <Plus size={13} /> Post
        </button>
      </div>
    </section>
  )
}
