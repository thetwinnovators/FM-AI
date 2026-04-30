import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertCircle, Plus, Check, Image as ImageIcon } from 'lucide-react'
import { useSeed } from '../../store/useSeed.js'
import { useStore } from '../../store/useStore.js'

const MAX_BANNER_BYTES = 2 * 1024 * 1024  // 2MB — keeps localStorage from blowing up

// Common short words to drop when auto-suggesting tags from title/body. Keep
// this list lean — overzealous filtering kills useful tags ("ai", "mcp", etc).
const TAG_STOPWORDS = new Set([
  'the','a','an','and','or','but','with','for','from','into','onto','about','over','under','out','off','then','than','so','as','at','by','of','in','on','to','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','can','could','should','may','might','must','this','that','these','those','it','its','my','your','our','their','his','her','him','them','us','we','you','i','me','if','not','no','yes','what','when','where','why','how','who','which','also','just','very','more','most','some','any','all','each','every','any','some','one','two','three','only','other','same','such','here','there','now',
])

function suggestTagsFor({ title = '', body = '', topicName = '' }) {
  const out = []
  const seen = new Set()
  const push = (t) => {
    const v = String(t || '').toLowerCase().trim().replace(/^[^a-z0-9]+|[^a-z0-9-]+$/g, '')
    if (!v || v.length < 2 || seen.has(v)) return
    seen.add(v)
    out.push(v)
  }
  // Topic name as a slug-style tag — usually the most relevant signal.
  if (topicName) {
    const slug = topicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (slug) push(slug)
  }
  // Notable tokens from title (weighted heavier — show first), then body.
  const tokens = (s) => (String(s || '').toLowerCase().match(/[a-z][a-z0-9-]{1,}/g) || [])
  for (const t of tokens(title)) {
    if (TAG_STOPWORDS.has(t) || t.length < 3) continue
    push(t)
    if (out.length >= 5) break
  }
  if (out.length < 5) {
    for (const t of tokens(body)) {
      if (TAG_STOPWORDS.has(t) || t.length < 3) continue
      push(t)
      if (out.length >= 5) break
    }
  }
  return out
}

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

// Single-form "Add content" modal. The user fills in title (required), an
// optional content body, an optional banner image (uploaded as a data URL,
// capped at 2MB so it doesn't bloat localStorage), an optional source URL
// they want to remember, picks the topic, and saves. No URL fetching or
// preview step — the user types whatever they want.
export default function UrlIngestModal({ open, onClose, defaultTopicId, defaultTopicSlug }) {
  const { topics: seedTopics } = useSeed()
  const { userTopics, addManualContent } = useStore()

  const allTopics = [
    ...seedTopics.map((t) => ({ id: t.id, slug: t.slug, name: t.name, isUser: false })),
    ...Object.values(userTopics).map((t) => ({ id: t.id, slug: t.slug, name: t.name, isUser: true })),
  ]
  const initialTopicId = defaultTopicId
    || (defaultTopicSlug && allTopics.find((t) => t.slug === defaultTopicSlug)?.id)
    || ''

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [banner, setBanner] = useState(null)         // data URL string
  const [bannerError, setBannerError] = useState(null)
  const [url, setUrl] = useState('')
  const [topicId, setTopicId] = useState(initialTopicId)
  const [tags, setTags] = useState([])
  // Once the user adds or removes a tag manually, we stop overwriting their
  // list with new suggestions on title/body change.
  const [tagsTouched, setTagsTouched] = useState(false)
  const [relevanceNote, setRelevanceNote] = useState('')
  const [savedTitle, setSavedTitle] = useState(null)
  const fileInputRef = useRef(null)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setTitle('')
    setBody('')
    setBanner(null)
    setBannerError(null)
    setUrl('')
    setTopicId(initialTopicId)
    setTags([])
    setTagsTouched(false)
    setRelevanceNote('')
    setSavedTitle(null)
  }, [open, initialTopicId])

  // Re-suggest tags whenever title/body/topic changes, until the user has
  // taken control by editing tags directly. Suggestions come from the topic
  // name + notable tokens in title/body — see suggestTagsFor.
  useEffect(() => {
    if (!open || tagsTouched) return
    const topicName = allTopics.find((t) => t.id === topicId)?.name || ''
    setTags(suggestTagsFor({ title, body, topicName }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, body, topicId, tagsTouched])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function handleBannerFile(file) {
    setBannerError(null)
    if (!file) { setBanner(null); return }
    if (!file.type.startsWith('image/')) {
      setBannerError('That doesn’t look like an image.')
      return
    }
    if (file.size > MAX_BANNER_BYTES) {
      setBannerError(`Banner must be under ${Math.floor(MAX_BANNER_BYTES / 1024 / 1024)}MB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setBanner(String(reader.result || ''))
    reader.onerror = () => setBannerError('Couldn’t read that file.')
    reader.readAsDataURL(file)
  }

  const trimmedTitle = title.trim()
  const trimmedUrl = url.trim()
  const canSave = trimmedTitle.length > 0 && Boolean(topicId)

  function removeTag(tag) {
    setTagsTouched(true)
    setTags((arr) => arr.filter((t) => t !== tag))
  }

  function addTagFromInput(rawValue) {
    const cleaned = String(rawValue || '').toLowerCase().trim().replace(/^[^a-z0-9]+|[^a-z0-9-]+$/g, '')
    if (!cleaned || cleaned.length < 2) return false
    setTagsTouched(true)
    let added = false
    setTags((arr) => {
      if (arr.includes(cleaned)) return arr
      added = true
      return [...arr, cleaned]
    })
    return added
  }

  function handleSave() {
    if (!canSave) return
    const trimmedBody = body.trim()
    const id = `manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const item = {
      id,
      title: trimmedTitle,
      summary: trimmedBody ? trimmedBody.slice(0, 240) : null,
      excerpt: trimmedBody || null,
      url: trimmedUrl || null,
      thumbnail: banner || null,
      type: 'article',
      source: 'You',
      sourceType: 'custom',
      published_at: new Date().toISOString(),
      topicIds: [topicId],
    }
    addManualContent({
      item,
      topicIds: [topicId],
      tags,
      relevanceNote: relevanceNote.trim() || null,
      ingestionMethod: 'manual_compose',
    })
    setSavedTitle(trimmedTitle)
    setTimeout(onClose, 700)
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
        className="relative w-full max-w-[640px] max-h-[90vh] flex flex-col rounded-3xl overflow-hidden"
        style={LIQUID_GLASS}
      >
        <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />

        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Plus size={16} className="text-[color:var(--color-topic)]" />
            <h2 className="text-base font-semibold text-white">Add content to topic</h2>
          </div>
          <button onClick={onClose} className="btn p-2" aria-label="Close"><X size={14} /></button>
        </header>

        <div className="flex-1 overflow-auto px-6 py-5 glass-scroll">
          {savedTitle ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-4">
                <Check size={20} className="text-emerald-300" />
              </div>
              <h3 className="text-base font-semibold text-white">Saved to topic</h3>
              <p className="text-sm text-[color:var(--color-text-tertiary)] mt-2">{savedTitle}</p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="space-y-4">
              <div>
                <label htmlFor="manual-title" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
                  Title <span className="text-rose-300/80 normal-case">*</span>
                </label>
                <input
                  id="manual-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give it a name…"
                  className="glass-input w-full text-sm"
                  autoFocus
                  maxLength={200}
                />
              </div>

              <div>
                <label htmlFor="manual-body" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
                  Content <span className="text-white/30 normal-case ml-1">(optional)</span>
                </label>
                <textarea
                  id="manual-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Paste or write the content. Supports plain text and markdown."
                  className="glass-input w-full text-sm resize-y"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
                  Banner image <span className="text-white/30 normal-case ml-1">(optional)</span>
                </label>
                {banner ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black/40">
                    <img src={banner} alt="Banner preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setBanner(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-white border border-white/15"
                      aria-label="Remove banner"
                      title="Remove banner"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video rounded-xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/25 transition-colors flex flex-col items-center justify-center gap-2 text-[color:var(--color-text-tertiary)] hover:text-white"
                  >
                    <ImageIcon size={20} />
                    <span className="text-[12px]">Click to upload an image</span>
                    <span className="text-[10px] text-white/35">PNG, JPG, GIF up to 2MB</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleBannerFile(e.target.files?.[0] || null)}
                />
                {bannerError ? (
                  <p className="mt-2 text-[11px] text-amber-300/90 inline-flex items-center gap-1.5">
                    <AlertCircle size={11} /> {bannerError}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="manual-url" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
                  URL <span className="text-white/30 normal-case ml-1">(optional)</span>
                </label>
                <input
                  id="manual-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://… (a source link, if you have one)"
                  className="glass-input w-full text-sm"
                />
              </div>

              <div>
                <label htmlFor="manual-topic" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
                  Save to topic <span className="text-rose-300/80 normal-case">*</span>
                </label>
                <select
                  id="manual-topic"
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="glass-input w-full text-sm"
                >
                  <option value="">— Choose a topic —</option>
                  {allTopics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.isUser ? ' (saved)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="manual-tags" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
                  Tags <span className="text-white/30 normal-case ml-1">(suggested from your title — remove or add as you like)</span>
                </label>
                <TagChipInput
                  id="manual-tags"
                  tags={tags}
                  onRemove={removeTag}
                  onAdd={addTagFromInput}
                />
              </div>

              <div>
                <label htmlFor="manual-note" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
                  Why this matters <span className="text-white/30 normal-case ml-1">(optional)</span>
                </label>
                <textarea
                  id="manual-note"
                  value={relevanceNote}
                  onChange={(e) => setRelevanceNote(e.target.value)}
                  rows={2}
                  placeholder="My own take or context for later…"
                  className="glass-input w-full text-sm resize-none"
                />
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={!canSave}
                  className="btn btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check size={13} /> Save to topic
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// Chip-based tag input. Shows the current tags as removable pills and lets
// the user type new ones at the end (Enter, comma, or Tab to commit). Backspace
// on an empty input pops the last tag for fast cleanup.
function TagChipInput({ id, tags, onRemove, onAdd }) {
  const [draft, setDraft] = useState('')

  function commitDraft() {
    if (!draft.trim()) return
    if (onAdd(draft)) setDraft('')
    else setDraft('')
  }

  function onKey(e) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (draft.trim()) {
        e.preventDefault()
        commitDraft()
      }
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      e.preventDefault()
      onRemove(tags[tags.length - 1])
    }
  }

  return (
    <div
      onClick={() => document.getElementById(id)?.focus()}
      className="glass-input w-full text-sm flex flex-wrap items-center gap-1.5 cursor-text min-h-[40px]"
    >
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[12px] bg-[color:var(--color-topic)]/15 text-[color:var(--color-topic)] border border-[color:var(--color-topic)]/30"
        >
          {t}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(t) }}
            className="p-0.5 rounded hover:bg-white/[0.1] text-[color:var(--color-topic)]/80 hover:text-white"
            aria-label={`Remove tag ${t}`}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commitDraft}
        placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : ''}
        className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm text-white placeholder:text-white/30 py-1"
      />
    </div>
  )
}
