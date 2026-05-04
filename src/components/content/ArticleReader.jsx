import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink, Bookmark, BookmarkCheck, FileText, Loader2, BookOpen, FilePlus, Check } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { getMeta } from '../../lib/search/ogImage.js'
import { fetchCleanArticle, clearCachedArticle, getCachedArticle } from '../../lib/search/articleReader.js'
import NotesEditor from './NotesEditor.jsx'
import MarkdownView from './MarkdownView.jsx'

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

export default function ArticleReader({ item, onClose }) {
  const { isSaved, toggleSave, recordView, addDocument } = useStore()
  const [meta, setMeta] = useState(null)
  const [metaStatus, setMetaStatus] = useState('idle')
  const [imageFailed, setImageFailed] = useState(false)
  // Reader-mode body fetched on demand via Jina (`fetchCleanArticle`). Kept
  // separate from the curator summary so the user can toggle back if Jina
  // returns garbage on a particular site.
  const [reader, setReader] = useState(null)
  const [readerStatus, setReaderStatus] = useState('idle') // idle | loading | done | error
  const [savedToDoc, setSavedToDoc] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (item) recordView(item.id)
  }, [item, recordView])

  // Reset state whenever the article being shown changes — fixes stale meta
  // sticking around. Also rehydrate the reader-mode body from cache so the
  // user sees the previously-loaded article immediately instead of having
  // to click "Load site content" every time they re-open an item.
  useEffect(() => {
    if (!item) return
    setMeta(null)
    setMetaStatus('idle')
    setImageFailed(false)
    const cached = item.url ? getCachedArticle(item.url) : null
    if (cached?.content) {
      setReader(cached)
      setReaderStatus('done')
      // Adopt the cached header image too if we don't have meta yet — the
      // banner won't appear before getMeta resolves otherwise.
      if (cached.image) setMeta((m) => ({ ...(m || {}), image: cached.image }))
    } else {
      setReader(null)
      setReaderStatus('idle')
    }
    setSavedToDoc(false)
  }, [item?.id])

  async function loadSiteContent() {
    if (!item?.url || readerStatus === 'loading') return
    setReaderStatus('loading')
    const data = await fetchCleanArticle(item.url)
    if (data && data.content) {
      setReader(data)
      setReaderStatus('done')
      // If Jina found a header image and we don't have one yet, adopt it.
      if (!meta?.image && data.image) {
        setMeta((m) => ({ ...(m || {}), image: data.image }))
        setImageFailed(false)
      }
    } else {
      setReaderStatus('error')
    }
  }

  // Drop the loaded body and evict the cache so the user can either let it
  // sit empty or hit Load again to pull fresh (useful when reader mode chose
  // a useless fragment — e.g. an X.com login wall — and we want to retry).
  function discardSiteContent() {
    if (item?.url) clearCachedArticle(item.url)
    setReader(null)
    setReaderStatus('idle')
  }

  function saveToDocument() {
    if (!reader?.content || savedToDoc) return
    addDocument({
      title:      item.title || '',
      plainText:  reader.content,
      sourceType: 'web',
      url:        item.url || null,
      fileName:   null,
    })
    setSavedToDoc(true)
  }

  // Lazy-fetch full article metadata (description + image) for richer modal content.
  useEffect(() => {
    if (!item || !item.url) return
    let cancelled = false
    setMetaStatus('loading')
    getMeta(item.url).then((m) => {
      if (cancelled) return
      setMeta(m)
      setMetaStatus('done')
    })
    return () => { cancelled = true }
  }, [item?.id])

  if (!item) return null
  const saved = isSaved(item.id)
  const imageUrl = meta?.image || item.thumbnail || null
  const description = meta?.description || item.summary
  const author = meta?.author || null
  const publisher = meta?.publisher || null
  const showImage = imageUrl && !imageFailed

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[760px] max-h-[90vh] flex flex-col rounded-3xl overflow-hidden"
        style={LIQUID_GLASS}
      >
        <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />

        {showImage ? (
          <div className="aspect-[1.91/1] bg-black/40 overflow-hidden flex-shrink-0">
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        ) : null}

        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10 flex-shrink-0">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-medium text-[color:var(--color-article)]">
              <FileText size={11} /> Article · {item.source}
            </span>
            <h2 className="text-[19px] font-semibold leading-snug mt-1.5 text-white">{item.title}</h2>
            {item.publishedAt ? (
              <div className="text-[11px] text-[color:var(--color-text-tertiary)] mt-2">{item.publishedAt}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => toggleSave(item.id, item)}
              className="btn p-2"
              aria-label={saved ? 'Unsave' : 'Save'}
            >
              {saved
                ? <BookmarkCheck size={14} className="text-[color:var(--color-topic)]" />
                : <Bookmark size={14} />}
            </button>
            <button onClick={onClose} className="btn p-2" aria-label="Close"><X size={14} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-6 py-5 text-[15px] leading-relaxed">
          {metaStatus === 'loading' && !description ? (
            <div className="flex items-center gap-2 text-[12px] text-[color:var(--color-text-tertiary)]">
              <Loader2 size={12} className="animate-spin" /> Fetching article metadata…
            </div>
          ) : (
            <>
              {description ? (
                <p className="text-[color:var(--color-text-secondary)] whitespace-pre-line">{description}</p>
              ) : (
                <p className="text-[color:var(--color-text-tertiary)] italic">
                  No preview text available for this link. Open the original to read the full article.
                </p>
              )}

              {(author || publisher) ? (
                <div className="mt-4 text-[12px] text-[color:var(--color-text-tertiary)]">
                  {author ? <span>By {author}</span> : null}
                  {author && publisher ? <span> · </span> : null}
                  {publisher ? <span>{publisher}</span> : null}
                </div>
              ) : null}

              {item.keyPoints?.length ? (
                <>
                  <h3 className="mt-6 mb-3 text-[11px] uppercase tracking-wide text-white/50 font-semibold">
                    Key points
                  </h3>
                  <ul className="space-y-2.5">
                    {item.keyPoints.map((p, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="w-1 h-1 rounded-full bg-[color:var(--color-article)] mt-2.5 flex-shrink-0" />
                        <span className="text-white/85">{p}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {/* Reader-mode body — fetched on demand via Jina Reader, then
                  rendered as styled markdown. Sits between key points and the
                  notes editor so the user can read the full piece, then jot
                  thoughts without leaving the modal. */}
              {readerStatus === 'done' && reader?.content ? (
                <section className="mt-6">
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <h3 className="text-[11px] uppercase tracking-wide text-white/50 font-semibold">
                      Full article
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/30">via reader mode</span>
                      <button
                        onClick={discardSiteContent}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-white/60 hover:text-rose-200 hover:bg-rose-500/10 transition-colors"
                        title="Discard this fetched content (you can reload after)"
                      >
                        <X size={11} /> Discard
                      </button>
                    </div>
                  </div>
                  <MarkdownView markdown={reader.content} />
                </section>
              ) : null}
              {readerStatus === 'error' ? (
                <p className="mt-6 text-[12px] text-amber-300/80">
                  Couldn't fetch the article body. Open the original to read it on the source.
                </p>
              ) : null}

              <NotesEditor itemId={item.id} accentColor="var(--color-article)" />
            </>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-3 flex-shrink-0">
          <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
            Reader view · summary by curator
          </span>
          <div className="flex items-center gap-2">
            {readerStatus === 'done' ? (
              <button
                onClick={saveToDocument}
                disabled={savedToDoc}
                className="btn text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={savedToDoc ? 'Already saved to Documents' : 'Save full article to My Documents'}
              >
                {savedToDoc
                  ? <><Check size={13} className="text-emerald-400" /> Saved</>
                  : <><FilePlus size={13} /> Save to Docs</>}
              </button>
            ) : (
              <button
                onClick={loadSiteContent}
                disabled={readerStatus === 'loading'}
                className="btn text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Pull the cleaned article body from the source"
              >
                {readerStatus === 'loading'
                  ? <><Loader2 size={13} className="animate-spin" /> Loading…</>
                  : <><BookOpen size={13} /> Load site content</>}
              </button>
            )}
            <a href={item.url} target="_blank" rel="noreferrer" className="btn btn-primary">
              Open original <ExternalLink size={13} />
            </a>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}
