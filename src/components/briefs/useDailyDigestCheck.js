import { useEffect } from 'react'
import { useStore } from '../../store/useStore.js'
import { fetchAiNews } from '../../lib/briefs/fetchAiNews.js'
import { generateNewsDigest } from '../../lib/briefs/generateNewsDigest.js'
import { shouldGenerateTopicBrief } from '../../lib/briefs/briefTrigger.js'
import { generateTopicBrief } from '../../lib/briefs/generateTopicBrief.js'
import { sendTelegramMessage, formatBriefForTelegram } from '../../lib/telegram.js'

/** Fire-and-forget Telegram send — never throws, never blocks the caller. */
async function tryTelegramBrief(brief) {
  try {
    const text = formatBriefForTelegram(brief)
    await sendTelegramMessage(text)
  } catch { /* no credentials or network error — silent */ }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Mount-time hook.
 *
 * 1. News digest — checks whether the most recent news_digest brief is older
 *    than 24 hours (or missing). If so, fetches AI news and generates one.
 *
 * 2. Topic briefs — scans every user topic to see if it has 3+ items saved
 *    since the last brief. Generates any that are due. This catches topics
 *    that already had enough items before the briefs feature was deployed.
 */
export function useDailyDigestCheck() {
  const { briefs, addBrief, manualContent, userTopics } = useStore()

  useEffect(() => {
    // ── 1. Daily news digest ──────────────────────────────────────────────
    const lastDigest = Object.values(briefs)
      .filter((b) => b.type === 'news_digest')
      .sort((a, b) => b.generatedAt - a.generatedAt)[0]

    const isStale = !lastDigest || Date.now() - lastDigest.generatedAt > ONE_DAY_MS
    if (isStale) {
      ;(async () => {
        const stories = await fetchAiNews().catch(() => [])
        if (!stories.length) return
        const digest = await generateNewsDigest(stories)
        if (digest) { addBrief(digest); tryTelegramBrief(digest) }
      })()
    }

    // ── 2. Retroactive topic brief scan ──────────────────────────────────
    const allItems = Object.values(manualContent || {})
    const topics = Object.values(userTopics || {})

    topics.forEach((topic) => {
      if (!topic?.id) return
      if (!shouldGenerateTopicBrief(topic.id, allItems, briefs)) return

      const topicTitle = topic.label ?? topic.name ?? topic.id
      const itemsForTopic = allItems.filter(
        (i) => i.topicId === topic.id || (i.topicIds ?? []).includes(topic.id),
      )

      ;(async () => {
        const brief = await generateTopicBrief(topicTitle, topic.id, itemsForTopic)
        if (brief) { addBrief(brief); tryTelegramBrief(brief) }
      })()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
