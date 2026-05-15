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
  free: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.25)' },
  subscription: { bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: 'rgba(99,102,241,0.25)' },
  iap: { bg: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: 'rgba(245,158,11,0.25)' },
  mixed: { bg: 'rgba(20,184,166,0.15)', color: '#5eead4', border: 'rgba(20,184,166,0.25)' },
  one_time: { bg: 'rgba(34,197,94,0.15)', color: '#86efac', border: 'rgba(34,197,94,0.25)' },
}

const EMPTY_FORM = { name: '', category: 'productivity', pricingModel: 'free', notes: '' }

function AppForm({ initial = EMPTY_FORM, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const inputStyle = {
    width: '100%', padding: '6px 10px', borderRadius: 7, fontSize: 12,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.85)', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }

  return (
    <div style={{
      borderRadius: 10, background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.12)', padding: '14px 14px 12px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>App Name</label>
          <input style={inputStyle} placeholder="e.g. Notion" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label style={labelStyle}>Category</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Pricing Model</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.pricingModel} onChange={set('pricingModel')}>
            {Object.entries(PRICING_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Notes (complaints, strengths, context)</label>
        <textarea
          style={{ ...inputStyle, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="What do users complain about? What does it do well?"
          value={form.notes}
          onChange={set('notes')}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.50)',
        }}>
          <X size={11} /> Cancel
        </button>
        <button onClick={() => form.name.trim() && onSave(form)} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: 'rgba(13,148,136,0.20)', border: '1px solid rgba(13,148,136,0.35)', color: '#5eead4',
          opacity: form.name.trim() ? 1 : 0.4,
        }}>
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
    const newApp = { ...form, id: crypto.randomUUID(), addedAt: now, updatedAt: now }
    persist([...apps, newApp])
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
      <span style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        padding: '2px 6px', borderRadius: 4,
        background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      }}>
        {PRICING_LABELS[model] ?? model}
      </span>
    )
  }

  const categoryBadge = (cat) => (
    <span style={{
      fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
      padding: '2px 6px', borderRadius: 4,
      background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)',
      border: '1px solid rgba(255,255,255,0.10)',
    }}>
      {CATEGORY_LABELS[cat] ?? cat}
    </span>
  )

  return (
    <div>
      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setEditingId(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.25)', color: '#5eead4',
            marginBottom: 12,
          }}
        >
          <Plus size={12} /> Add app
        </button>
      )}

      {/* Add form */}
      {showForm && (
        <AppForm onSave={handleAdd} onCancel={() => setShowForm(false)} />
      )}

      {/* App cards */}
      {apps.length === 0 && !showForm ? (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingTop: 20 }}>
          Add apps you've researched to enrich opportunity scoring.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {apps.map((app) => (
            editingId === app.id ? (
              <AppForm
                key={app.id}
                initial={{ name: app.name, category: app.category, pricingModel: app.pricingModel, notes: app.notes }}
                onSave={(form) => handleEdit(app.id, form)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={app.id}
                style={{
                  borderRadius: 10, padding: '10px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)', margin: 0 }}>
                    {app.name}
                  </p>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => { setEditingId(app.id); setShowForm(false) }} title="Edit"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.30)', padding: 2 }}>
                      <Edit2 size={11} />
                    </button>
                    <button onClick={() => handleDelete(app.id)} title="Delete"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.50)', padding: 2 }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, marginBottom: app.notes ? 7 : 0 }}>
                  {categoryBadge(app.category)}
                  {pricingBadge(app.pricingModel)}
                </div>
                {app.notes && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', margin: 0, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {app.notes}
                  </p>
                )}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
