import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Bookmark, BookmarkX, Database, Sparkles } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import MemoryEntryCard from '../components/memory/MemoryEntryCard.jsx'
import MemoryAddForm from '../components/memory/MemoryAddForm.jsx'
import SavedItemsGrid from '../components/memory/SavedItemsGrid.jsx'

const TABS = [
  { id: 'saved',    label: 'Saved items'      },
  { id: 'followed', label: 'Followed topics'  },
  { id: 'memory',   label: 'Memory entries'   },
  { id: 'sources',  label: 'Source preferences' },
]

const CATEGORY_FILTERS = [
  { id: 'all',            label: 'All'            },
  { id: 'topic_rule',     label: 'Topic Rules'    },
  { id: 'source_pref',    label: 'Source Prefs'   },
  { id: 'research_focus', label: 'Research Focus' },
  { id: 'personal_stack', label: 'Personal Stack' },
]

export default function Memory() {
  const { topics, seedMemory } = useSeed()
  const {
    saves, follows, toggleFollow, memoryEntries, addMemory, deleteMemory, isMemoryDismissed,
    userTopics, removeUserTopic,
  } = useStore()

  const [tab, setTab] = useState('saved')
  const [showAdd, setShowAdd] = useState(false)
  const [catFilter, setCatFilter] = useState('all')

  const followedSeed = topics.filter((t) => follows[t.id])
  const userTopicList = Object.values(userTopics)
  const visibleSeedMemory = (seedMemory || []).filter((m) => !isMemoryDismissed(m.id))
  const allMemory = [...visibleSeedMemory, ...Object.values(memoryEntries)]
  const filteredMemory = catFilter === 'all' ? allMemory : allMemory.filter((m) => m.category === catFilter)

  function onAddSubmit(data) {
    addMemory(data)
    setShowAdd(false)
  }

  const savedCount = Object.keys(saves).length
  const followedTotal = followedSeed.length + userTopicList.length

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
          What you've saved, followed, and the rules shaping your map.
        </p>
      </header>

      <div className="flex gap-1 mb-6 border-b border-[color:var(--color-border-subtle)] flex-wrap">
        {TABS.map((t) => {
          const count =
            t.id === 'saved'    ? savedCount :
            t.id === 'followed' ? followedTotal :
            t.id === 'memory'   ? allMemory.length :
            null
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[color:var(--color-topic)] text-white'
                  : 'border-transparent text-[color:var(--color-text-tertiary)] hover:text-white'
              }`}
            >
              {t.label}
              {count !== null ? <span className="ml-1.5 text-[11px] text-[color:var(--color-text-tertiary)]">{count}</span> : null}
            </button>
          )
        })}
      </div>

      {tab === 'saved' && <SavedItemsGrid />}

      {tab === 'followed' && (
        followedTotal === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[color:var(--color-bg-glass-strong)] border border-[color:var(--color-border-default)] flex items-center justify-center mb-4">
              <Bookmark size={20} className="text-[color:var(--color-text-tertiary)]" />
            </div>
            <h3 className="text-base font-semibold">Not following any topics yet</h3>
            <p className="text-sm text-[color:var(--color-text-tertiary)] mt-2">
              Find one in <Link to="/topics" className="underline text-white">/topics</Link>.
            </p>
          </div>
        ) : (
          <ul className="space-y-2 max-w-[760px]">
            {followedSeed.map((t) => (
              <li key={t.id} className="glass-panel p-4 flex items-center justify-between">
                <Link to={`/topic/${t.slug}`} className="flex items-center gap-3 hover:underline flex-1 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[color:var(--color-topic)] flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-[11px] text-[color:var(--color-text-tertiary)] truncate">{t.summary}</div>
                  </div>
                </Link>
                <button
                  onClick={() => toggleFollow(t.id)}
                  className="btn text-xs flex-shrink-0"
                  aria-label="Unfollow"
                >
                  <BookmarkX size={13} /> Unfollow
                </button>
              </li>
            ))}
            {userTopicList.map((t) => (
              <li key={t.id} className="glass-panel p-4 flex items-center justify-between">
                <Link to={`/topic/${t.slug}`} className="flex items-center gap-3 hover:underline flex-1 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[color:var(--color-topic)] flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate inline-flex items-center gap-2">
                      {t.name}
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-medium text-[color:var(--color-creator)] px-1.5 py-0.5 rounded border border-[color:var(--color-creator)]/30 bg-[color:var(--color-creator)]/10">
                        <Sparkles size={9} /> saved
                      </span>
                    </div>
                    <div className="text-[11px] text-[color:var(--color-text-tertiary)] truncate">{t.summary}</div>
                  </div>
                </Link>
                <button
                  onClick={() => removeUserTopic(t.id)}
                  className="btn text-xs flex-shrink-0 text-rose-300 hover:text-rose-200 hover:border-rose-400/40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'memory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {CATEGORY_FILTERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCatFilter(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    catFilter === c.id
                      ? 'bg-[color:var(--color-topic)]/15 border-[color:var(--color-topic)]/40 text-[color:var(--color-topic)]'
                      : 'border-[color:var(--color-border-subtle)] text-[color:var(--color-text-secondary)] hover:bg-white/5'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAdd((v) => !v)} className="btn btn-primary text-sm">
              <Plus size={13} /> Add memory
            </button>
          </div>

          {showAdd ? <MemoryAddForm onSubmit={onAddSubmit} onCancel={() => setShowAdd(false)} /> : null}

          {filteredMemory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[color:var(--color-bg-glass-strong)] border border-[color:var(--color-border-default)] flex items-center justify-center mb-3">
                <Database size={20} className="text-[color:var(--color-text-tertiary)]" />
              </div>
              <p className="text-sm text-[color:var(--color-text-tertiary)] max-w-md">
                No memory entries in this category. Add a rule, source preference, research focus, or stack note above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMemory.map((entry) => (
                <MemoryEntryCard key={entry.id} entry={entry} onDelete={deleteMemory} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'sources' && (
        <div className="glass-panel p-6 max-w-[640px]">
          <Database size={18} className="text-[color:var(--color-creator)] mb-3" />
          <h2 className="text-base font-semibold">Source preferences</h2>
          <p className="text-sm text-[color:var(--color-text-secondary)] mt-2 leading-relaxed">
            Source weighting comes online when full live ingestion ships. For now, the mix is hard-coded:
            curated seed (high signal), Hacker News (high), Reddit (varied), Dailymotion (educational videos).
          </p>
        </div>
      )}
    </div>
  )
}
