import { useState } from 'react'
import { Database, Plus } from 'lucide-react'
import { useSeed } from '../../store/useSeed.js'
import { useStore } from '../../store/useStore.js'
import MemoryEntryCard from '../memory/MemoryEntryCard.jsx'
import MemoryAddForm from '../memory/MemoryAddForm.jsx'

const FILTERS = [
  { id: 'all',            label: 'All' },
  { id: 'topic_rule',     label: 'Topic Rules' },
  { id: 'source_pref',    label: 'Source Prefs' },
  { id: 'research_focus', label: 'Research Focus' },
  { id: 'personal_stack', label: 'Personal Stack' },
]

export default function InterestMemoryPanel() {
  const { seedMemory } = useSeed()
  const { memoryEntries, addMemory, deleteMemory, isMemoryDismissed } = useStore()
  const [filter, setFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)

  const visibleSeed = (seedMemory || []).filter((m) => !isMemoryDismissed(m.id))
  const all = [...visibleSeed, ...Object.values(memoryEntries)]
  const filtered = filter === 'all' ? all : all.filter((m) => m.category === filter)

  return (
    <div className="glass-panel overflow-hidden">
      <div className="px-5 py-3 border-b border-[color:var(--color-border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-[color:var(--color-memory)]" />
          <h2 className="text-[13px] font-semibold">Interest Memory</h2>
          <span className="text-[10px] text-[color:var(--color-text-tertiary)] ml-2">
            Baseline facts and rules that shape what surfaces here.
          </span>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="btn btn-primary text-xs">
          <Plus size={12} /> Add memory
        </button>
      </div>

      <div className="px-5 py-2 border-b border-[color:var(--color-border-subtle)] flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-[color:var(--color-memory)]/15 text-[color:var(--color-memory)] border border-[color:var(--color-memory)]/40'
                : 'text-[color:var(--color-text-secondary)] hover:bg-white/5 border border-transparent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {showAdd ? <MemoryAddForm onSubmit={(d) => { addMemory(d); setShowAdd(false) }} onCancel={() => setShowAdd(false)} /> : null}
        {filtered.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-tertiary)] py-8 text-center">No entries in this category.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
            {filtered.map((entry) => (
              <MemoryEntryCard
                key={entry.id}
                entry={entry}
                onDelete={deleteMemory}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
