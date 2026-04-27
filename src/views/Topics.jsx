import { Link } from 'react-router-dom'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import { Bookmark, BookmarkCheck, Sparkles, Trash2 } from 'lucide-react'

export default function Topics() {
  const { topics, contentByTopic } = useSeed()
  const { isFollowing, toggleFollow, userTopics, removeUserTopic } = useStore()

  const userTopicList = Object.values(userTopics)
  const merged = [
    ...topics.map((t) => ({ ...t, isUserAdded: false })),
    ...userTopicList.map((t) => ({ ...t, isUserAdded: true })),
  ]

  const sorted = [...merged].sort((a, b) => {
    const aFollowed = a.isUserAdded ? a.followed : isFollowing(a.id)
    const bFollowed = b.isUserAdded ? b.followed : isFollowing(b.id)
    return (aFollowed ? 0 : 1) - (bFollowed ? 0 : 1)
  })

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Topics</h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
          {sorted.length} {sorted.length === 1 ? 'topic' : 'topics'} in your map
          {userTopicList.length > 0 ? <> · <span className="text-white">{userTopicList.length} saved from search</span></> : null}.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((t) => {
          const followed = t.isUserAdded ? t.followed : isFollowing(t.id)
          const count = t.isUserAdded ? null : contentByTopic(t.id).length
          return (
            <article key={t.id} className="glass-panel p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[color:var(--color-topic)]" />
                  <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-topic)] font-medium">
                    topic
                  </span>
                </div>
                {t.isUserAdded ? (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-medium text-[color:var(--color-creator)] px-1.5 py-0.5 rounded border border-[color:var(--color-creator)]/30 bg-[color:var(--color-creator)]/10">
                    <Sparkles size={10} /> saved
                  </span>
                ) : null}
              </div>

              <Link to={`/topic/${t.slug}`} className="block">
                <h2 className="text-lg font-semibold leading-tight hover:underline">{t.name}</h2>
                <p className="mt-2 text-sm text-[color:var(--color-text-secondary)] line-clamp-3">
                  {t.summary}
                </p>
              </Link>

              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
                  {count !== null ? `${count} ${count === 1 ? 'item' : 'items'}` : 'live · fetched on visit'}
                </span>
                {t.isUserAdded ? (
                  <button
                    onClick={() => removeUserTopic(t.id)}
                    className="btn text-xs text-rose-300 hover:text-rose-200 hover:border-rose-400/40"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                ) : (
                  <button
                    onClick={() => toggleFollow(t.id)}
                    className={`btn ${followed ? 'btn-primary' : ''} text-xs`}
                  >
                    {followed ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                    {followed ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
