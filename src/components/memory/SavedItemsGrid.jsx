import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import { useSeed } from '../../store/useSeed.js'
import { useStore } from '../../store/useStore.js'
import VideoCard from '../content/VideoCard.jsx'
import ArticleCard from '../content/ArticleCard.jsx'
import SocialPostCard from '../content/SocialPostCard.jsx'
import VideoPlayerModal from '../content/VideoPlayerModal.jsx'
import ArticleReader from '../content/ArticleReader.jsx'

export default function SavedItemsGrid() {
  const { contentById } = useSeed()
  const { saves } = useStore()
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  // Resolve each saved id to either the stored snapshot (live items) or the seed lookup (curated items).
  const items = Object.entries(saves)
    .map(([id, save]) => save.item || contentById(id) || null)
    .filter(Boolean)
    .sort((a, b) => {
      const aSave = saves[a.id]?.savedAt || ''
      const bSave = saves[b.id]?.savedAt || ''
      return bSave.localeCompare(aSave)
    })

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-[color:var(--color-bg-glass-strong)] border border-[color:var(--color-border-default)] flex items-center justify-center mb-4">
          <Bookmark size={20} className="text-[color:var(--color-text-tertiary)]" />
        </div>
        <h3 className="text-base font-semibold">No saved items yet</h3>
        <p className="text-sm text-[color:var(--color-text-tertiary)] mt-2 max-w-md">
          Hit the bookmark icon on any video, article, or post to save it here.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((it) =>
          it.type === 'video' ? <VideoCard key={it.id} item={it} onOpen={open} /> :
          it.type === 'article' ? <ArticleCard key={it.id} item={it} onOpen={open} /> :
          <SocialPostCard key={it.id} item={it} onOpen={open} />
        )}
      </div>
      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </>
  )
}
