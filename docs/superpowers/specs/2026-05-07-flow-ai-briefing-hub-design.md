# Flow AI Briefing Hub — Design Spec

## Overview

The Briefing Hub adds a persistent **Briefs** button to the FlowMap header. Clicking it opens a dropdown listing unread and recent briefs. Clicking any brief opens a full modal report. Two brief types exist: **Topic Briefs** (synthesised from items the user has saved to a topic) and the **AI News Digest** (a built-in daily feed from fixed AI news sources). Briefs are generated automatically when trigger conditions are met, without any user-initiated action.

This is Phase 1 of the Flow AI assistance roadmap — the synthesis layer. It does not include cross-source compare, proactive resurface, or full agent execution.

---

## Brief Types

### Topic Brief

Generated for any topic the user has configured in FlowMap when **3 or more new items** have been saved to that topic since the last brief was generated.

Sections:

| Section | Purpose |
|---|---|
| Overview | Plain-language summary of the topic's current state |
| What Changed | Bulleted change items since the last brief (teal dot = rising trend, purple = shift, blue = new development) |
| Strongest Signals | Top 2–3 signal cards with source attribution and strength label (Strong / Medium) |
| Open Questions | 2–4 numbered unresolved questions worth watching |
| Risks & Counterpoints | Amber-tinted box for the strongest contrarian view or evidence gap |

### AI News Digest

A built-in, daily brief with no user configuration required. FlowMap silently watches a fixed set of AI news sources and generates one digest per day when new content is available.

Built-in sources (read-only, not user-configurable in Phase 1):

- Hacker News — AI-tagged stories (score threshold: 50+)
- r/MachineLearning (top 24h posts)
- r/artificial (top 24h posts)

Sections differ from Topic Briefs:

| Section | Purpose |
|---|---|
| Today's Highlights | 4–6 bullet developments, each one sentence |
| Emerging Themes | 2–3 cross-story patterns or trends spotted in the day's coverage |
| Strongest Signal | Single highest-confidence development to pay attention to |
| Risks & Noise | What looks hyped, premature, or contradicted by other sources |

---

## Data Model

```
Brief {
  id:            string          // uuid
  type:          'topic' | 'news_digest'
  title:         string          // e.g. "Agentic AI" or "Today in AI — 6 developments"
  topicId:       string | null   // null for news_digest
  generatedAt:   timestamp
  readAt:        timestamp | null
  newItemCount:  number          // items since last brief (topic) or stories (news)
  sourceCount:   number
  sections:      BriefSection[]
}

BriefSection {
  type:    'overview' | 'what_changed' | 'strongest_signals' | 'open_questions'
           | 'risks' | 'highlights' | 'themes' | 'top_signal'
  content: string   // LLM-generated markdown
}
```

Briefs are stored in the same persistence layer as other FlowMap data. In Phase 1 (localStorage-first), briefs live under `flowmap:briefs` as a JSON array. When SQL persistence lands they move to a `briefs` table with a `brief_sections` child table.

---

## Generation Pipeline

### Topic Brief

1. **Trigger check** — on any `itemSaved` event, count items saved to that topic since `lastBriefGeneratedAt`. If count ≥ 3, enqueue a brief job.
2. **Collect input** — fetch all items saved to the topic since the last brief. Cap at 30 most recent to stay within LLM context.
3. **LLM call** — single call with structured prompt requesting the 5-section output as JSON. Prompt instructs the model to: summarise the topic's current state, identify what changed, surface the strongest signals with source attribution, surface open questions, and flag the best contrarian point.
4. **Parse and store** — validate response shape; store as a `Brief` record with `type: 'topic'`.
5. **Update badge** — increment unread count.

### AI News Digest

1. **Schedule** — runs once daily (early morning). If no new content found, skips silently (no empty brief generated).
2. **Fetch** — pull top posts from HN (AI-tagged, score ≥ 50), r/MachineLearning, r/artificial for the past 24 hours.
3. **Deduplicate** — cluster by URL and story similarity to avoid counting the same story three times.
4. **LLM call** — single call requesting the 4-section digest output as JSON.
5. **Store and badge** — same as Topic Brief.

---

## Header Button

The **Briefs** button lives in the app header alongside the search and settings icons.

```
[ ⬡ FlowMap ]                    [ 🔍 ] [ ⚙️ ] [ 📡 Briefs ³ ]
```

- Teal background tint (`rgba(13,148,136,0.15)`) + teal border distinguishes it from icon-only buttons.
- Badge shows count of unread briefs. Hidden when count = 0.
- Badge gradient: teal → indigo (`#0d9488 → #6366f1`) on dark background.
- Clicking opens / closes the dropdown.

---

## Dropdown

Appears below the Briefs button, anchored to the right edge.

- **Header row:** "Flow AI Briefs" title + "Mark all read" link.
- **Items:** sorted unread first, then read (dimmed to 40% opacity). Within unread: AI News Digest always pinned first, then Topic Briefs by `generatedAt` descending.
- **Unread indicator:** 5px teal dot (`#0d9488`) positioned at left centre of the item row via `::before`.
- **Truncation:** brief preview truncated to 2 lines with `-webkit-line-clamp`.
- **Footer:** "View all briefs →" link (out of scope for Phase 1 — renders but navigates nowhere).
- Clicking any item opens the Brief Modal and marks the brief as read.

Brief item anatomy:

```
[ icon ] AI News Digest                        [Daily] 2h ago
         Today in AI — 6 developments
         OpenAI announced structured outputs…
```

```
[ icon ] Topic Brief                           [+5 new] 4h ago
         Agentic AI
         5 new items since last brief…
```

---

## Brief Modal

Full-screen overlay modal, max-width 640px, scrollable body.

**Header (fixed):**
- Icon + type label + title
- Close button (✕)
- Meta pills: new item count · updated time · source count

**Body (scrollable):** renders sections in order defined per brief type above.

**Change item dot colours:**
- Teal (`#2dd4bf`) — rising trend
- Purple (`#a78bfa`) — topic shift
- Blue (`#60a5fa`) — new development

**Signal card strength labels:**
- "Strong" — teal pill
- "Medium" — indigo/purple pill

**Footer (fixed, action rail):**

Topic Brief actions:
- 💾 Save to Topic *(primary, teal)*
- ⚡ Generate opportunity brief *(purple)*
- 🎓 Turn into learning path *(secondary)*
- 📋 Create watch rule *(secondary)*

AI News Digest actions:
- 💾 Save highlights to inbox *(primary, teal)*
- 📋 Create watch rule for a story *(secondary)*
- 🎓 Turn into learning path *(secondary)*

In Phase 1, all action buttons are wired to the existing FlowMap action system where handlers already exist (save to topic, create watch rule). "Generate opportunity brief" and "Turn into learning path" show a "coming soon" toast in Phase 1.

---

## Interaction Flows

**New brief generated (background):**
1. Brief stored → badge increments → no interruption to user.

**User opens dropdown:**
1. Dropdown renders sorted list.
2. Unread items shown at full opacity with teal dot.
3. Read items shown at 40% opacity, no dot.

**User clicks a brief:**
1. Brief modal opens.
2. Brief marked as read (`readAt = now`).
3. Badge count decrements.

**User clicks "Mark all read":**
1. All briefs get `readAt = now`.
2. Badge disappears.
3. All dropdown items render at 40% opacity.

**User clicks an action button:**
1. Existing handler fires (save, watch rule) or "coming soon" toast appears.
2. Modal stays open.

---

## Component Map

```
AppHeader
└── BriefsBadgeButton          // button + badge, opens/closes dropdown
    └── BriefsDropdown         // portal, click-outside to close
        └── BriefDropdownItem  // one row per brief

BriefModal                     // full-screen portal
├── BriefModalHeader
├── BriefModalBody
│   ├── BriefSection           // renders any section type
│   ├── ChangeList + ChangeItem
│   ├── SignalList + SignalCard
│   └── RisksBox
└── BriefActionRail

briefsStore                    // state: brief[], unreadCount, markRead, markAllRead
briefGenerationService         // trigger check, LLM call, parse, store
newsDigestService              // daily fetch, dedup, LLM call
```

---

## Out of Scope (Phase 1)

- Cross-source compare view (Phase 2)
- Proactive resurface from memory (Phase 2)
- "View all briefs" full page
- User-configurable AI News sources
- Push notifications for new briefs
- Brief editing or annotation
- Brief export

---

## Success Criteria

- A Topic Brief generates automatically when 3+ items are saved to a topic since the last brief, with no user action required.
- The AI News Digest appears once daily with real content from the built-in sources.
- The unread badge count accurately reflects unseen briefs.
- Every brief section renders correctly in the modal.
- At least Save to Topic and Create watch rule work from the action rail.
- The header button, dropdown, and modal all render correctly in FlowMap's dark theme.
