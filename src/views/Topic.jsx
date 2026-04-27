import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { Bookmark, BookmarkCheck, ChevronLeft } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import VideoCard from '../components/content/VideoCard.jsx'
import ArticleCard from '../components/content/ArticleCard.jsx'
import SocialPostCard from '../components/content/SocialPostCard.jsx'
import VideoPlayerModal from '../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../components/content/ArticleReader.jsx'
import Chip from '../components/ui/Chip.jsx'

const TABS = [
  { id: 'all',      label: 'All'      },
  { id: 'video',    label: 'Videos'   },
  { id: 'article',  label: 'Articles' },
  { id: 'social_post', label: 'Posts' },
]

export default function Topic() {
  const { slug } = useParams()
  const { topicBySlug, contentByTopic, toolById, conceptById, topicById } = useSeed()
  const { isFollowing, toggleFollow } = useStore()

  const topic = topicBySlug(slug)
  const [tab, setTab] = useState('all')
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  if (!topic) {
    return (
      <div className="p-6">
        <Link to="/topics" className="text-sm text-[color:var(--color-text-tertiary)] hover:text-white inline-flex items-center gap-1">
          <ChevronLeft size={14} /> Back to topics
        </Link>
        <h1 className="text-2xl font-semibold mt-4">Topic not found</h1>
      </div>
    )
  }

  const all = contentByTopic(topic.id)
  const items = tab === 'all' ? all : all.filter((c) => c.type === tab)
  const followed = isFollowing(topic.id)

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  return (
    <div className="p-6">
      <Link to="/topics" className="text-sm text-[color:var(--color-text-tertiary)] hover:text-white inline-flex items-center gap-1 mb-4">
        <ChevronLeft size={14} /> Back to topics
      </Link>

      {/* Hero */}
      <header className="glass-panel p-6 mb-6 flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[color:var(--color-topic)]" />
            <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-topic)] font-medium">topic</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{topic.name}</h1>
          <p className="mt-3 text-sm text-[color:var(--color-text-secondary)] max-w-3xl leading-relaxed">{topic.summary}</p>
          {topic.whyItMatters ? (
            <p className="mt-3 text-sm italic text-[color:var(--color-text-tertiary)] max-w-3xl">{topic.whyItMatters}</p>
          ) : null}
        </div>
        <button
          onClick={() => toggleFollow(topic.id)}
          className={`btn ${followed ? 'btn-primary' : ''} flex-shrink-0`}
        >
          {followed ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          {followed ? 'Following' : 'Follow'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main content */}
        <section>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-[color:var(--color-border-subtle)]">
            {TABS.map((t) => {
              const count = t.id === 'all' ? all.length : all.filter((c) => c.type === t.id).length
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
                  {t.label} <span className="text-[11px] text-[color:var(--color-text-tertiary)]">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Grid */}
          {items.length === 0 ? (
            <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">No items in this tab.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((it) =>
                it.type === 'video' ? <VideoCard key={it.id} item={it} onOpen={open} /> :
                it.type === 'article' ? <ArticleCard key={it.id} item={it} onOpen={open} /> :
                <SocialPostCard key={it.id} item={it} onOpen={open} />
              )}
            </div>
          )}
        </section>

        {/* Side rail */}
        <aside className="space-y-4">
          {topic.relatedTopicIds?.length ? (
            <div className="glass-panel p-4">
              <h3 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">
                Related topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {topic.relatedTopicIds.map((id) => {
                  const t = topicById(id)
                  return t ? <Link key={id} to={`/topic/${t.slug}`}><Chip color="#d946ef">{t.name}</Chip></Link> : null
                })}
              </div>
            </div>
          ) : null}

          {topic.toolIds?.length ? (
            <div className="glass-panel p-4">
              <h3 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">Tools</h3>
              <ul className="space-y-2">
                {topic.toolIds.map((id) => {
                  const tool = toolById(id)
                  return tool ? (
                    <li key={id}>
                      <a href={tool.url} target="_blank" rel="noreferrer" className="text-sm hover:underline">
                        {tool.name}
                      </a>
                      <p className="text-[11px] text-[color:var(--color-text-tertiary)]">{tool.summary}</p>
                    </li>
                  ) : null
                })}
              </ul>
            </div>
          ) : null}

          {topic.conceptIds?.length ? (
            <div className="glass-panel p-4">
              <h3 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">Concepts</h3>
              <div className="flex flex-wrap gap-2">
                {topic.conceptIds.map((id) => {
                  const c = conceptById(id)
                  return c ? <Chip key={id} color="#94a3b8">{c.name}</Chip> : null
                })}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </div>
  )
}
