// src/components/opportunity/WinningAppsPanel.jsx
import { useState } from 'react'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import radarStorage from '../../opportunity-radar/storage/radarStorage.js'

const CATEGORIES = [
  'games', 'productivity', 'finance', 'entertainment',
  'shopping', 'social', 'health-fitness', 'utilities',
]
const CATEGORY_LABELS = {
  'games': 'Games', 'productivity': 'Productivity', 'finance': 'Finance',
  'entertainment': 'Entertainment', 'shopping': 'Shopping', 'social': 'Social',
  'health-fitness': 'Health & Fitness', 'utilities': 'Utilities',
}
const PRICING_LABELS = {
  free: 'Free', subscription: 'Subscription', iap: 'In-App Purchase',
  mixed: 'Mixed', one_time: 'One-time',
}
const PRICING_COLORS = {
  free:         { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.25)' },
  subscription: { bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc', border: 'rgba(99,102,241,0.25)' },
  iap:          { bg: 'rgba(245,158,11,0.15)',   color: '#fcd34d', border: 'rgba(245,158,11,0.25)' },
  mixed:        { bg: 'rgba(20,184,166,0.15)',   color: '#5eead4', border: 'rgba(20,184,166,0.25)' },
  one_time:     { bg: 'rgba(34,197,94,0.15)',    color: '#86efac', border: 'rgba(34,197,94,0.25)' },
}

const EMPTY_FORM = { name: '', category: 'productivity', pricingModel: 'free', notes: '' }

function AppForm({ initial = EMPTY_FORM, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const canSave = form.name.trim().length > 0

  return (
    <div className="glass-panel p-3.5 mb-3">
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
            App Name
          </label>
          <input
            className="glass-input w-full text-xs"
            placeholder="e.g. Notion"
            value={form.name}
            onChange={set('name')}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Category
          </label>
          <select className="glass-input w-full text-xs" value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Pricing Model
          </label>
          <select className="glass-input w-full text-xs" value={form.pricingModel} onChange={set('pricingModel')}>
            {Object.entries(PRICING_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-2.5">
        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
          Notes (complaints, strengths, context)
        </label>
        <textarea
          className="glass-input w-full text-xs"
          style={{ minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="What do users complain about? What does it do well?"
          value={form.notes}
          onChange={set('notes')}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn text-xs py-1.5 px-3 flex items-center gap-1">
          <X size={11} /> Cancel
        </button>
        <button
          onClick={() => canSave && onSave(form)}
          className="btn btn-teal text-xs py-1.5 px-3 flex items-center gap-1"
          style={{ opacity: canSave ? 1 : 0.4 }}
        >
          <Check size={11} /> Save
        </button>
      </div>
    </div>
  )
}

/**
 * Right panel of the Market tab: manually curated winning apps.
 * Props:
 *   onWinningAppsUpdated(apps) — called after any add/edit/delete
 */
export default function WinningAppsPanel({ onWinningAppsUpdated }) {
  const [apps, setApps]           = useState(() => radarStorage.loadWinningApps())
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState(null)

  function persist(updated) {
    radarStorage.saveWinningApps(updated)
    setApps(updated)
    onWinningAppsUpdated?.(updated)
  }

  function handleAdd(form) {
    const now = new Date().toISOString()
    persist([...apps, { ...form, id: crypto.randomUUID(), addedAt: now, updatedAt: now }])
    setShowForm(false)
  }

  function handleEdit(id, form) {
    persist(apps.map((a) => a.id === id ? { ...a, ...form, updatedAt: new Date().toISOString() } : a))
    setEditingId(null)
  }

  function handleDelete(id) {
    persist(apps.filter((a) => a.id !== id))
  }

  const pricingBadge = (model) => {
    const c = PRICING_COLORS[model] ?? PRICING_COLORS.free
    return (
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        padding: '2px 6px', borderRadius: 4, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
        {PRICING_LABELS[model] ?? model}
      </span>
    )
  }

  const categoryBadge = (cat) => (
    <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
      padding: '2px 6px', borderRadius: 4,
      background: 'var(--color-bg-glass)', color: 'var(--color-text-tertiary)',
      border: '1px solid var(--color-border-subtle)' }}>
      {CATEGORY_LABELS[cat] ?? cat}
    </span>
  )

  return (
    <div>
      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setEditingId(null) }}
          className="btn btn-teal text-xs flex items-center gap-1.5 mb-3"
        >
          <Plus size={12} /> Add app
        </button>
      )}

      {/* Add form */}
      {showForm && <AppForm onSave={handleAdd} onCancel={() => setShowForm(false)} />}

      {/* App list / empty state */}
      {apps.length === 0 && !showForm ? (
        <p className="text-xs text-center pt-5" style={{ color: 'var(--color-text-tertiary)' }}>
          Add apps you&apos;ve researched to enrich opportunity scoring.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {apps.map((app) =>
            editingId === app.id ? (
              <AppForm
                key={app.id}
                initial={{ name: app.name, category: app.category, pricingModel: app.pricingModel, notes: app.notes }}
                onSave={(form) => handleEdit(app.id, form)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={app.id} className="glass-panel p-3 group">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-[13px] font-semibold m-0" style={{ color: 'var(--color-text-secondary)' }}>
                    {app.name}
                  </p>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditingId(app.id); setShowForm(false) }}
                      title="Edit"
                      className="p-0.5 rounded"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={() => handleDelete(app.id)}
                      title="Delete"
                      className="p-0.5 rounded"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.50)' }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5 mb-1.5">
                  {categoryBadge(app.category)}
                  {pricingBadge(app.pricingModel)}
                </div>
                {app.notes && (
                  <p className="text-[11px] m-0 leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                    {app.notes}
                  </p>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
