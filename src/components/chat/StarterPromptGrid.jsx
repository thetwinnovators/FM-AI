/**
 * Context-aware starter prompts shown on the Chat empty state.
 *
 * Derives up to 6 personalised prompts from the user's actual data:
 *   1. Most recently uploaded document  → deep-dive summary
 *   2. Most recently added user topic   → developments + connections
 *   3. Rising signals (if any)          → pattern analysis
 *   4. Most recent search query         → gap analysis
 *   5. Second user topic (if any)       → core concepts + open questions
 *   6. Knowledge-base overview          → themes + next focus
 */
import { useMemo } from 'react'
import { FileText, Compass, TrendingUp, Search, Sparkles, BookOpen } from 'lucide-react'

const ICONS = {
  document: FileText,
  topic:    Compass,
  signal:   TrendingUp,
  search:   Search,
  overview: Sparkles,
  reading:  BookOpen,
}

const LABELS = {
  document: 'Document',
  topic:    'Topic',
  signal:   'Signals',
  search:   'Recent search',
  overview: 'Overview',
  reading:  'Reading',
}


function trunc(str, n) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

function buildPrompts({ docs, userTopics, searches, signals }) {
  const prompts = []

  // ── 1. Most recently uploaded document ───────────────────────────────────
  const sortedDocs = [...docs].sort(
    (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
  )
  if (sortedDocs[0]) {
    const t = sortedDocs[0].title
    prompts.push({
      type:    'document',
      prompt:  `Summarize "${t}" and pull out the 3 most important takeaways. What should I remember about this?`,
      display: `What are the key takeaways from "${trunc(t, 38)}"?`,
    })
  }

  // ── 2. Most recently added user topic ─────────────────────────────────────
  const sortedTopics = [...userTopics].sort(
    (a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''),
  )
  if (sortedTopics[0]) {
    const n = sortedTopics[0].name
    prompts.push({
      type:    'topic',
      prompt:  `What are the most important recent developments in ${n}? How do they connect to other topics in my library, and what should I be paying attention to right now?`,
      display: `What's developing in ${trunc(n, 32)} and how does it connect to my other research?`,
    })
  }

  // ── 3. Rising signals ─────────────────────────────────────────────────────
  const rising = signals.filter((s) => s.direction === 'up' && !s.muted)
  if (rising.length > 0) {
    prompts.push({
      type:    'signal',
      prompt:  "Walk me through my top rising signals. What patterns are emerging across them, which ones seem most significant, and which deserve deeper investigation this week?",
      display: 'What patterns are emerging across my rising signals?',
    })
  }

  // ── 4. Most recent search query ───────────────────────────────────────────
  const recentSearch = searches.find((s) => s.query && s.query.length >= 4)
  if (recentSearch) {
    const q = recentSearch.query
    prompts.push({
      type:    'search',
      prompt:  `Based on my recent search for "${q}", what important context or nuances might my saved documents be missing? What would fill the gaps in my understanding of this topic?`,
      display: `What's missing in my research on "${trunc(q, 32)}"?`,
    })
  }

  // ── 5. Second topic ───────────────────────────────────────────────────────
  if (sortedTopics[1] && prompts.length < 5) {
    const n = sortedTopics[1].name
    prompts.push({
      type:    'topic',
      prompt:  `I'm exploring ${n}. What are the foundational concepts I need to understand first, and what are the most interesting open questions in this space right now?`,
      display: `Core concepts and open questions in ${trunc(n, 30)}`,
    })
  }

  // ── 5-alt. Second document ────────────────────────────────────────────────
  if (sortedDocs[1] && prompts.length < 5) {
    const t = sortedDocs[1].title
    prompts.push({
      type:    'document',
      prompt:  `What are the most actionable insights from "${t}"? What would I do differently after reading this?`,
      display: `Actionable insights from "${trunc(t, 34)}"`,
    })
  }

  // ── 6. Always-available knowledge-base overview ───────────────────────────
  if (prompts.length < 6) {
    prompts.push({
      type:    'overview',
      prompt:  "Give me a thoughtful overview of my research this week — what themes are emerging across my topics, what interesting connections are forming, and what should I dig into next?",
      display: 'What themes are emerging across my research this week?',
    })
  }

  return prompts.slice(0, 6)
}

export default function StarterPromptGrid({ docs, userTopics, searches, signals, onSend }) {
  const prompts = useMemo(
    () => buildPrompts({
      docs:       docs       || [],
      userTopics: userTopics || [],
      searches:   searches   || [],
      signals:    signals    || [],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docs.length, userTopics.length, searches.length, signals.length],
  )

  if (prompts.length === 0) return null

  return (
    <div className="mt-8 w-full max-w-[680px] mx-auto">
      <p className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] text-center mb-3 font-semibold">
        Start a conversation
      </p>
      <div className="grid grid-cols-3 gap-2">
        {prompts.map((p, i) => {
          const Icon = ICONS[p.type] || Sparkles
          const label = LABELS[p.type] || 'Prompt'
          return (
            <button
              key={i}
              onClick={() => onSend(p.prompt)}
              className="flex flex-col gap-1.5 px-3.5 py-3 rounded-xl border text-left
                transition-colors cursor-pointer
                border-white/[0.07] bg-[#0d0f1c] hover:bg-[#111326] hover:border-white/[0.14]"
            >
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold opacity-70 text-[color:var(--color-tool)]">
                <Icon size={10} aria-hidden="true" />
                {label}
              </span>
              <span className="text-[13px] text-stone-300/80 leading-snug">
                {p.display}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
