import { useEffect } from 'react'
import { useStore } from '../../store/useStore.js'
import { fetchAiNews } from '../../lib/briefs/fetchAiNews.js'
import { generateNewsDigest } from '../../lib/briefs/generateNewsDigest.js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Mount-time hook.  Checks whether the most recent news_digest brief is
 * older than 24 hours (or missing).  If so, fetches AI news and generates
 * a new digest.  Fire-and-forget — does not block rendering.
 */
export function useDailyDigestCheck() {
  const { briefs, addBrief } = useStore()

  useEffect(() => {
    const lastDigest = Object.values(briefs)
      .filter((b) => b.type === 'news_digest')
      .sort((a, b) => b.generatedAt - a.generatedAt)[0]

    const isStale = !lastDigest || Date.now() - lastDigest.generatedAt > ONE_DAY_MS
    if (!isStale) return

    ;(async () => {
      const stories = await fetchAiNews().catch(() => [])
      if (!stories.length) return
      const digest = await generateNewsDigest(stories)
      if (digest) addBrief(digest)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
