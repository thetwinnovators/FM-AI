import { useState } from 'react'
import { Link as LinkIcon, Trash2 } from 'lucide-react'
import { useSeed } from '../../store/useSeed.js'
import { useStore } from '../../store/useStore.js'
import VideoCard from '../content/VideoCard.jsx'
import ArticleCard from '../content/ArticleCard.jsx'
import SocialPostCard from '../content/SocialPostCard.jsx'
import VideoPlayerModal from '../content/VideoPlayerModal.jsx'
import ArticleReader from '../content/ArticleReader.jsx'
import { useConfirm } from '../ui/ConfirmProvider.jsx'

function relativeDate(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.floor((Date.now() - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function AddedUrlsGrid() {
  const { topicById } = useSeed()
  const { manualContent, removeManualContent, userTopics } = useStore()
  const confirm = useConfirm()
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  async function askRemove(entry) {
    const ok = await confirm({
      title: `Remove "${entry.item?.title || 'this URL'}"?`,
      message: 'This deletes the saved URL, your tags, and your relevance note. The original page is untouched.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (ok) removeManualContent(entry.id)
  }

  const entries = Object.values(manualContent || {}).sort((a, b) =>
    (b.savedAt || '').localeCompare(a.savedAt || '')
  )

  function topicNameFor(id) {
    return topicById(id)?.name || userTopics[id]?.name || null
  }

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-[color:var(--color-bg-glass-strong)] border border-[color:var(--color-border-default)] flex items-center justify-center mb-4">
          <LinkIcon size={20} className="text-[color:var(--color-text-tertiary)]" />
        </div>
        <h3 className="text-base font-semibold">No URLs added yet</h3>
        <p className="text-sm text-[color:var(--color-text-tertiary)] mt-2 max-w-md">
          Use the "Add URL" button above to ingest a YouTube video or article into a topic.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
        {entries.map((entry) => {
          const item = entry.item
          if (!item) return null
          const Card =
            item.type === 'video' ? VideoCard :
            item.type === 'article' ? ArticleCard :
            SocialPostCard
          const topicNames = (entry.topicIds || []).map(topicNameFor).filter(Boolean)
          return (
            <div key={entry.id} className="space-y-2">
              <Card item={item} onOpen={open} />
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {topicNames.map((name, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-medium text-[color:var(--color-topic)] px-1.5 py-0.5 rounded border border-[color:var(--color-topic)]/30 bg-[color:var(--color-topic)]/10"
                    >
                      {name}
                    </span>
                  ))}
                  <span className="text-[10px] text-[color:var(--color-text-tertiary)]">
                    {relativeDate(entry.savedAt)}
                  </span>
                </div>
                <button
                  onClick={() => askRemove(entry)}
                  className="text-[color:var(--color-text-tertiary)] hover:text-rose-300 transition-colors flex-shrink-0"
                  title="Remove"
                  aria-label="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {entry.tags?.length ? (
                <div className="flex flex-wrap gap-1 px-1">
                  {entry.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] text-[color:var(--color-text-secondary)] px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.02]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {entry.relevanceNote ? (
                <p className="text-[11px] italic text-[color:var(--color-text-tertiary)] px-1 line-clamp-2">
                  "{entry.relevanceNote}"
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </>
  )
}
