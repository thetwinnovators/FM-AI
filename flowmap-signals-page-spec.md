# FlowMap Signals Page Spec

Create a new top-level **Signals** page in FlowMap focused on automated content signal mining and trend tracking. This page should use **YouTube Data API** as the primary structured source and **Google Alerts** as a lightweight monitoring source for web/news signals.

## Goal

Build a Signals experience that helps detect rising patterns, recurring hooks, repeated phrases, topic shifts, and notable changes over time. Signals should be anchored to FlowMap topics, then enriched by FlowMap memory and saved knowledge.

## Product framing

Use this mental model:

- **Topics** = what is being tracked
- **Signals** = what is changing around a topic
- **Memory** = context that explains why a signal matters

The Signals page is not a generic analytics dashboard. It should feel like a smart monitoring layer that notices what is emerging before the user manually investigates it.

## Primary data sources

### 1. YouTube Data API
Use YouTube Data API v3 as the main API-driven source for signal mining.

Use it for:
- searching videos by topic keyword
- reading video titles, descriptions, publish dates, channel names, thumbnails
- optionally reading comment threads if supported in the implementation scope
- tracking recent content around watched topics

Suggested env variable:

```bash
VITE_YOUTUBE_API_KEY=your_key_here
```

Frontend access example:

```js
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
```

Do not hardcode the API key in source files.

### 2. Google Alerts
Google Alerts is not a traditional API, so treat it as a lightweight monitoring input rather than a direct structured developer API.

Use it for:
- topic-level alerts
- web/news mention discovery
- external trend hints
- feeding alert items into the Signals page as another source stream

Implementation approach:
- create a Google Alerts management section in the UI
- allow users to store the alert query they are tracking
- allow manual ingestion or semi-structured ingestion of alerts into FlowMap
- represent Google Alerts as a source type in the Signals model

For v1, it is acceptable for Google Alerts to be a user-assisted source setup with FlowMap-side organization and interpretation.

## Navigation

Add **Signals** as a top-level navigation item.

Suggested nav structure:
- Home
- Search
- Research *(future)*
- Signals
- Chat
- Connections
- My Documents

## Routes

Add routes such as:

- `/signals`
- `/signals/topic/:topicId`
- `/signals/sources`
- `/signals/alerts`

## Page purpose

The Signals page should answer:
- What topics are rising?
- What phrases or hooks are repeating more often?
- Which sources are producing the strongest signal activity?
- What changed in the last 24 hours, 7 days, and 30 days?
- Which detected signals should be saved, pinned, muted, or added into memory?

## Refresh model

The Signals page should not behave like a real-time dashboard.

Recommended update model:
- load the latest saved signal data immediately on page open
- support scheduled background refresh
- always support manual refresh
- use quota-safe throttling and cooldown rules

### User-selectable update frequency
Allow the user to choose how often Signals updates.

Suggested options:
- Manual only
- Every 6 hours
- Every 12 hours
- Daily
- Weekly

Recommended defaults:
- **YouTube**: every 12 hours
- **Google Alerts**: daily or based on alert ingestion cadence

### Manual refresh
Include a manual action such as:
- `Run scan now`

Manual refresh should:
- show a loading state
- debounce repeated clicks
- respect source cooldowns / quota safeguards
- display `Last updated` and `Next scan` information

## Core UI sections

### 1. Header
Include:
- page title: `Signals`
- short subtitle explaining that FlowMap tracks emerging patterns across watched sources
- primary CTA: `Add source`
- secondary CTA: `Create alert`
- manual CTA: `Run scan now`
- optional filter controls for time range and topic

### 2. Overview strip
Include compact summary cards such as:
- Rising signals
- New this week
- Repeating hooks
- Source activity
- Alerts captured
- Last updated

### 3. Pinned signals
Pinned signals should appear in a dedicated section above the normal feed.

Pinning means:
- keep this specific signal card visible at the top of the Signals page
- preserve access to an important signal even as newer signals arrive

It does **not** mean ongoing monitoring.
That behavior belongs to a separate future watch/monitoring action if needed.

### 4. Latest signals feed
Signals should appear as dated cards in a chronological or relevance-ranked feed.

Each signal card may include:
- signal title
- primary topic
- related topics
- source type (`youtube`, `google-alert`)
- signal score
- change direction (`up`, `flat`, `down`)
- first detected date
- latest detected date
- supporting evidence snippets
- quick actions

### 5. Muted signals view
Muted signals should not dominate the main feed.

Provide:
- a muted filter/view
- ability to unmute later

### 6. Trend clusters
Cluster similar signals together.

Examples:
- recurring hook patterns
- recurring questions
- repeated phrases
- fast-rising entities
- content format shifts
- CTA trends

### 7. Source panel
Show tracked sources grouped by type.

For v1:
- YouTube tracked keywords / channels
- Google Alerts queries

### 8. Signal detail drawer or page
Opening a signal should show:
- why it was detected
- score breakdown
- evidence from YouTube titles/descriptions/comments or alert items
- associated primary topic
- related topics
- related FlowMap memory items
- save / action options

## Information architecture

### Main tabs or sub-sections
Suggested tabs inside Signals:
- Overview
- Topics
- Trends
- Sources
- Alerts
- Muted

## Topic model

Signals should be primarily based on FlowMap topics, not raw memory.

Use this model:
- Topics define what to watch
- Signals are detected from watched sources
- Memory enriches ranking and explanation

Each topic can include:
- title
- keywords
- aliases
- source preferences
- watch status
- optional excluded phrases

## Automated topic tagging

Topic tagging should be automated based on signal content.

FlowMap should analyze:
- signal title
- summary
- source text
- repeated keywords
- entities
- evidence snippets
- matching topic keywords and aliases

Then it should automatically assign:
- **one primary topic**
- **zero or more related topics**

Users may edit or confirm the topic associations if needed, but the default experience should feel automatic and intelligent.

## Detection model

Implement a lightweight algorithmic scoring system.

Each signal may be derived from:
- keyword repetition frequency
- recent growth compared to baseline
- recurrence across multiple items
- freshness / recency
- cross-source overlap
- relation to tracked topic terms

Example conceptual formula:

```text
signalScore = frequencyWeight + growthWeight + recencyWeight + crossSourceWeight + topicMatchWeight
```

This does not need to be overly complex in v1, but it should feel systematic and explainable.

## Example signal types

Support signal categories such as:
- `rising-keyword`
- `repeating-hook`
- `recurring-question`
- `entity-spike`
- `format-trend`
- `cta-pattern`
- `news-mention`

## Actions model

Signals must be actionable.

### Save actions
Use this save action set:
- **Save to Topic**
- **Save as Note**
- **Pin signal**
- **Mute signal**
- **Add to memory**

### Intelligence actions
- **Generate summary**
- **Generate content ideas**

### Future actions
- **Send to Telegram** *(soon)*
- **Start workflow** *(soon)*

## Action meanings

### Save to Topic
Associate the signal with one or more topics.
Because topic tagging is automated, this action should primarily confirm, refine, or strengthen topic relationships.

### Save as Note
Create a note object from the signal, preserving the signal title, summary, evidence, and topic associations.

### Pin signal
Pins the signal card itself.
The pinned signal card appears in the Pinned Signals section above the normal feed.

### Mute signal
Suppress the signal from the main feed and reduce similar noise.
Muted signals should remain recoverable through a muted view.

### Add to memory
Create a `.txt` memory artifact from the signal and place it into the **AI Memory** folder inside the **My Documents** page.

This action should:
- generate a text file from the signal
- include the signal title, summary, timestamps, source references, and topic associations
- save it into `My Documents > AI Memory`
- make it available to future AI retrieval and memory-based responses

### Generate summary
Create a short readable synthesis of why the signal matters.

### Generate content ideas
Turn the signal into content opportunities such as posts, captions, hooks, angles, or scripts.

## Data model

Use a structure like this:

```ts
interface SignalTopic {
  id: string;
  title: string;
  keywords: string[];
  aliases?: string[];
  excludedPhrases?: string[];
  sourcePreferences?: {
    youtube?: boolean;
    googleAlerts?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface SignalSource {
  id: string;
  type: 'youtube' | 'google-alert';
  label: string;
  query: string;
  topicIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SignalItem {
  id: string;
  primaryTopicId?: string;
  relatedTopicIds: string[];
  sourceId: string;
  sourceType: 'youtube' | 'google-alert';
  category:
    | 'rising-keyword'
    | 'repeating-hook'
    | 'recurring-question'
    | 'entity-spike'
    | 'format-trend'
    | 'cta-pattern'
    | 'news-mention';
  title: string;
  summary: string;
  score: number;
  direction: 'up' | 'flat' | 'down';
  firstDetectedAt: string;
  lastDetectedAt: string;
  evidence: Array<{
    label: string;
    snippet?: string;
    url?: string;
    publishedAt?: string;
  }>;
  pinned?: boolean;
  muted?: boolean;
  memoryFileId?: string | null;
  noteId?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## YouTube integration details

Create a YouTube service such as:

```text
src/signals/services/youtubeSignalsService.ts
```

Responsibilities:
- search by topic keyword
- fetch recent videos
- normalize response into internal source items
- optionally fetch comments when useful
- extract candidate hooks/phrases from titles/descriptions
- return normalized signal evidence

Suggested functions:

```ts
searchVideosByTopic(topic: SignalTopic): Promise<YouTubeVideoResult[]>
fetchRecentVideos(query: string): Promise<YouTubeVideoResult[]>
extractSignalCandidates(items: YouTubeVideoResult[]): Promise<SignalCandidate[]>
```

## Google Alerts integration details

Since Google Alerts is not a traditional open JSON API, create an abstraction like:

```text
src/signals/services/googleAlertsService.ts
```

Responsibilities:
- manage tracked alert queries
- normalize incoming alert items into source records
- allow manual or assisted ingestion in v1
- convert alert items into signal candidates

Suggested approach for v1:
- user enters alert query metadata into FlowMap
- FlowMap stores the query and lets the user paste/import alert items
- parsed alert items are normalized and scored like any other signal source

Suggested functions:

```ts
createAlertQuery(input): Promise<SignalSource>
listAlertQueries(): Promise<SignalSource[]>
ingestAlertItems(sourceId: string, items: AlertInput[]): Promise<void>
extractSignalCandidates(items: AlertInput[]): Promise<SignalCandidate[]>
```

## Storage

Use a dedicated isolated storage layer for Signals.

Suggested folders:

```text
src/signals/
  pages/
    SignalsPage.jsx
    TopicSignalsPage.jsx
    SignalsSourcesPage.jsx
    SignalsAlertsPage.jsx
  components/
    SignalsHeader.jsx
    SignalsOverviewStrip.jsx
    PinnedSignalsSection.jsx
    SignalCard.jsx
    SignalFeed.jsx
    TrendClusterSection.jsx
    SourcePanel.jsx
    SignalDetailDrawer.jsx
    EmptySignalsState.jsx
  services/
    youtubeSignalsService.ts
    googleAlertsService.ts
    signalDetectionService.ts
    signalScoringService.ts
    signalTopicTaggingService.ts
    signalMemoryService.ts
  storage/
    localSignalsStorage.ts
    signalsStorage.ts
  utils/
    signalText.ts
    scoring.ts
    grouping.ts
    dates.ts
    ids.ts
```

Use local storage for v1, but isolate storage so a backend can replace it later.

## UX details

The UI should fit FlowMap’s dark glassmorphic style.

Important UX expectations:
- premium, not generic dashboard-like
- strong empty state when no topics or sources are configured
- clear distinction between source data and detected signals
- explainable scoring, not black-box mystery labels
- clear difference between pinned, latest, and muted signals
- easy save and intelligence actions

## Empty states

### No topics
Show:
- title: `No tracked topics yet`
- body: explain that signals are generated around topics being watched
- CTA: `Create topic`

### No sources
Show:
- title: `No sources connected`
- body: explain that YouTube and Google Alerts can feed the Signals page
- CTA: `Add source`

### No signals yet
Show:
- title: `No signals detected yet`
- body: explain that FlowMap needs time or source data to identify patterns
- CTA: `Run scan`

## Suggested scans

Add lightweight actions such as:
- `Run scan now`
- `Refresh YouTube signals`
- `Import alert items`
- `Recompute topic matches`

## Connection to Memory

Memory should not be the primary source of signals.
It should be used to:
- explain why a signal matters
- link related past saves
- connect detected trends to past notes or chats
- improve ranking relevance
- store durable signal insights through the `Add to memory` action

## Engineering approach

Use the current FlowMap codebase style:
- existing app files can remain JavaScript / JSX
- new Signals services can be TypeScript where useful
- use thin boundaries so JSX pages can call typed services cleanly

Recommended architecture:
- service-first
- isolated storage layer
- topic-first detection model
- automated topic tagging
- human-friendly explainability

## Deliverables

Implement:
1. Signals page routes
2. Signals page shell and overview
3. local storage-backed topic/source/signal models
4. YouTube API service integration
5. Google Alerts tracking and ingestion UI
6. signal scoring + grouping logic
7. automated topic tagging
8. pinned / latest / muted signal sections
9. signal detail drawer
10. save actions including Add to memory
11. intelligence actions
12. empty states and polish

## Output expectations for implementation

Provide implementation code in labeled file sections.
Use production-quality React + JavaScript/TypeScript.
Do not hardcode secrets.
Use environment variables for YouTube API access.
Keep Google Alerts flexible and realistic for v1.
Do not make the Signals page depend on the Research page existing.
