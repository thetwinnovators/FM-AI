import { Link } from 'react-router-dom'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import { Bookmark, BookmarkCheck } from 'lucide-react'

export default function Topics() {
  const { topics, contentByTopic } = useSeed()
  const { isFollowing, toggleFollow } = useStore()

  const sorted = [...topics].sort((a, b) => {
    const af = isFollowing(a.id) ? 0 : 1
    const bf = isFollowing(b.id) ? 0 : 1
    return af - bf
  })

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Topics</h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
          {topics.length} topics in your map. Followed first.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((t) => {
          const count = contentByTopic(t.id).length
          const followed = isFollowing(t.id)
          return (
            <article key={t.id} className="glass-panel p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[color:var(--color-topic)]" />
                <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-topic)] font-medium">
                  topic
                </span>
              </div>

              <Link to={`/topic/${t.slug}`} className="block">
                <h2 className="text-lg font-semibold leading-tight hover:underline">{t.name}</h2>
                <p className="mt-2 text-sm text-[color:var(--color-text-secondary)] line-clamp-3">
                  {t.summary}
                </p>
              </Link>

              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
                  {count} {count === 1 ? 'item' : 'items'}
                </span>
                <button
                  onClick={() => toggleFollow(t.id)}
                  className={`btn ${followed ? 'btn-primary' : ''} text-xs`}
                >
                  {followed ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                  {followed ? 'Following' : 'Follow'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
