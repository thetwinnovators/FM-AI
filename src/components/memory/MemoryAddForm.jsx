import { useState } from 'react'
import { Plus, X } from 'lucide-react'

const CATEGORIES = [
  { value: 'topic_rule',     label: 'Topic Rule' },
  { value: 'source_pref',    label: 'Source Pref' },
  { value: 'research_focus', label: 'Research Focus' },
  { value: 'personal_stack', label: 'Personal Stack' },
]

export default function MemoryAddForm({ onSubmit, onCancel }) {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('research_focus')

  function submit(e) {
    e.preventDefault()
    if (!content.trim()) return
    onSubmit({ content: content.trim(), category })
    setContent('')
  }

  return (
    <form onSubmit={submit} className="glass-panel p-4 space-y-3 border-[color:var(--color-topic)]/40">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Write a memory — a rule, preference, focus, or stack note that should shape future suggestions…"
        className="glass-input w-full text-sm resize-none"
        autoFocus
      />
      <div className="flex items-center justify-between gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="glass-input text-sm flex-1 max-w-[200px]"
        >
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="btn text-sm">
            <X size={13} /> Cancel
          </button>
          <button type="submit" className="btn btn-primary text-sm">
            <Plus size={13} /> Save
          </button>
        </div>
      </div>
    </form>
  )
}
