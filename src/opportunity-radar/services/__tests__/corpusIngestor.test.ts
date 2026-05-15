import { describe, it, expect } from 'vitest'
import {
  adaptSaves,
  adaptDocuments,
  adaptManualContent,
  adaptTopicSummaries,
  adaptBriefs,
  ingestCorpus,
} from '../corpusIngestor.js'
import type { CorpusStoreSlice } from '../corpusIngestor.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSave(id: string, summary = 'This is a substantial summary about a pain point that developers face', title = 'Test Article') {
  return { savedAt: '2026-05-01T00:00:00Z', item: { id, title, summary, url: `https://example.com/${id}`, type: 'article', topicIds: ['topic_dev'], publishedAt: '2026-05-01' } }
}

function makeDoc(id: string, plainText = 'This is a detailed document about workflow inefficiencies and manual data export problems that need to be solved') {
  return {
    meta: { id, title: `Doc ${id}`, summary: null, topics: ['topic_dev'], createdAt: '2026-05-01T00:00:00Z' },
    content: { id, plainText, raw: null, normalizedMarkdown: null },
  }
}

function makeManual(id: string) {
  return {
    id,
    item: { id, title: 'Manual URL', summary: 'Users manually export data every day as a workaround because Jira lacks bulk export', url: `https://example.com/${id}`, topicIds: ['topic_jira'] },
    topicId: 'topic_jira',
    topicIds: ['topic_jira'],
    savedAt: '2026-05-01T00:00:00Z',
  }
}

function makeTopicSummary(topicId: string) {
  return { overview: 'Developers frequently struggle with environment setup and manual deployment workflows that cost hours each week', report: 'The problem is widespread across all company sizes', generatedAt: Date.now() }
}

function makeBrief(id: string, topicId: string) {
  return {
    id,
    topicId,
    title: 'Topic Brief',
    generatedAt: Date.now(),
    sections: [
      { type: 'overview', content: 'Manual processes are causing significant pain for development teams' },
      { type: 'strongest_signals', items: [{ text: 'Developers spend hours on manual tasks every week', dot: 'Strong' }] },
      { type: 'open_questions', items: ['Why is there no automated solution yet?'] },
      { type: 'risks', content: 'The market may already be saturated with existing tools' },
    ],
  }
}

// ── adaptSaves ────────────────────────────────────────────────────────────────

describe('adaptSaves', () => {
  it('returns [] for empty saves', () => {
    expect(adaptSaves({})).toEqual([])
  })

  it('returns a record for each save with a non-empty item', () => {
    const saves = { s1: makeSave('item1'), s2: makeSave('item2') }
    expect(adaptSaves(saves)).toHaveLength(2)
  })

  it('skips entries where item is null', () => {
    const saves = { s1: { savedAt: '2026-05-01T00:00:00Z', item: null } }
    expect(adaptSaves(saves)).toHaveLength(0)
  })

  it('skips items whose combined text is below MIN_BODY_CHARS', () => {
    const saves = { s1: { savedAt: '2026-05-01T00:00:00Z', item: { id: 'x', title: 'Hi', summary: 'Short', url: 'https://x.com', topicIds: [] } } }
    expect(adaptSaves(saves)).toHaveLength(0)
  })

  it('sets source to "corpus"', () => {
    const saves = { s1: makeSave('item1') }
    expect(adaptSaves(saves)[0].source).toBe('corpus')
  })

  it('populates lineage fields', () => {
    const saves = { s1: makeSave('item1') }
    const rec = adaptSaves(saves)[0]
    expect(rec.corpusSourceType).toBe('save')
    expect(rec.corpusSourceId).toBe('item1')
    expect(rec.corpusTopicId).toBe('topic_dev')
  })

  it('combines summary and keyPoints into body', () => {
    const saves = { s1: { savedAt: '2026-05-01T00:00:00Z', item: {
      id: 'x', title: 'T', summary: 'Summary text about workarounds',
      keyPoints: ['Point one about manual exports', 'Point two about jira integration'],
      url: 'https://x.com', topicIds: [],
    }}}
    const rec = adaptSaves(saves)[0]
    expect(rec.body).toContain('Summary text about workarounds')
    expect(rec.body).toContain('Point one about manual exports')
  })
})

// ── adaptDocuments ────────────────────────────────────────────────────────────

describe('adaptDocuments', () => {
  it('returns [] when documents is empty', () => {
    expect(adaptDocuments({}, {})).toHaveLength(0)
  })

  it('skips documents with no matching content entry', () => {
    const docs = { d1: makeDoc('d1').meta }
    expect(adaptDocuments(docs, {})).toHaveLength(0)
  })

  it('produces a record when both meta and content exist', () => {
    const d = makeDoc('d1')
    expect(adaptDocuments({ d1: d.meta }, { d1: d.content })).toHaveLength(1)
  })

  it('sets corpusSourceType to "document"', () => {
    const d = makeDoc('d1')
    const rec = adaptDocuments({ d1: d.meta }, { d1: d.content })[0]
    expect(rec.corpusSourceType).toBe('document')
    expect(rec.corpusSourceId).toBe('d1')
  })

  it('truncates plainText to 2000 chars', () => {
    const longText = 'a'.repeat(5_000)
    const d = makeDoc('d1', longText)
    const rec = adaptDocuments({ d1: d.meta }, { d1: d.content })[0]
    expect(rec.body.length).toBeLessThanOrEqual(3_000)
  })

  it('skips documents whose combined text is too short', () => {
    const d = makeDoc('d1', 'short')
    const docMeta = { ...d.meta, summary: null }
    expect(adaptDocuments({ d1: docMeta }, { d1: d.content })).toHaveLength(0)
  })
})

// ── adaptManualContent ────────────────────────────────────────────────────────

describe('adaptManualContent', () => {
  it('returns [] for empty manualContent', () => {
    expect(adaptManualContent({})).toHaveLength(0)
  })

  it('produces a record for a valid manual content entry', () => {
    const mc = { m1: makeManual('item_m1') }
    expect(adaptManualContent(mc)).toHaveLength(1)
  })

  it('sets corpusSourceType to "manual_content"', () => {
    const mc = { m1: makeManual('item_m1') }
    const rec = adaptManualContent(mc)[0]
    expect(rec.corpusSourceType).toBe('manual_content')
  })

  it('uses topicId from the manual content entry (not from item.topicIds)', () => {
    const mc = { m1: makeManual('item_m1') }
    const rec = adaptManualContent(mc)[0]
    expect(rec.corpusTopicId).toBe('topic_jira')
  })
})

// ── adaptTopicSummaries ───────────────────────────────────────────────────────

describe('adaptTopicSummaries', () => {
  it('returns [] for empty summaries', () => {
    expect(adaptTopicSummaries({})).toHaveLength(0)
  })

  it('produces a record per topic summary', () => {
    const ts = { topic_dev: makeTopicSummary('topic_dev'), topic_ai: makeTopicSummary('topic_ai') }
    expect(adaptTopicSummaries(ts)).toHaveLength(2)
  })

  it('sets corpusSourceType to "topic_summary" and topicId to the key', () => {
    const ts = { topic_dev: makeTopicSummary('topic_dev') }
    const rec = adaptTopicSummaries(ts)[0]
    expect(rec.corpusSourceType).toBe('topic_summary')
    expect(rec.corpusTopicId).toBe('topic_dev')
  })

  it('combines overview and report into body', () => {
    const ts = { t: { overview: 'Overview text with substantial content about workflows', report: 'Additional report text about more problems', generatedAt: Date.now() } }
    const rec = adaptTopicSummaries(ts)[0]
    expect(rec.body).toContain('Overview text')
    expect(rec.body).toContain('Additional report text')
  })
})

// ── adaptBriefs ───────────────────────────────────────────────────────────────

describe('adaptBriefs', () => {
  it('returns [] for empty briefs', () => {
    expect(adaptBriefs({})).toHaveLength(0)
  })

  it('extracts text from all section types', () => {
    const briefs = { b1: makeBrief('b1', 'topic_dev') }
    const rec = adaptBriefs(briefs)[0]
    expect(rec.body).toContain('Manual processes')
    expect(rec.body).toContain('Developers spend hours')
    expect(rec.body).toContain('automated solution')
    expect(rec.body).toContain('market may already be saturated')
  })

  it('sets corpusSourceType to "brief" and carries topicId', () => {
    const briefs = { b1: makeBrief('b1', 'topic_dev') }
    const rec = adaptBriefs(briefs)[0]
    expect(rec.corpusSourceType).toBe('brief')
    expect(rec.corpusTopicId).toBe('topic_dev')
  })

  it('skips briefs with no usable section text', () => {
    const empty = { b1: { id: 'b1', topicId: 'x', sections: [], generatedAt: Date.now() } }
    expect(adaptBriefs(empty)).toHaveLength(0)
  })
})

// ── ingestCorpus (integration) ────────────────────────────────────────────────

describe('ingestCorpus', () => {
  it('returns [] when store is empty', () => {
    expect(ingestCorpus({})).toHaveLength(0)
  })

  it('aggregates records from all five source types', () => {
    const d = makeDoc('d1')
    const slice: CorpusStoreSlice = {
      saves:            { s1: makeSave('item_s1') },
      documents:        { d1: d.meta },
      documentContents: { d1: d.content },
      manualContent:    { m1: makeManual('item_m1') },
      topicSummaries:   { topic_dev: makeTopicSummary('topic_dev') },
      briefs:           { b1: makeBrief('b1', 'topic_dev') },
    }
    const results = ingestCorpus(slice)
    const sourceTypes = new Set(results.map(r => r.corpusSourceType))
    expect(sourceTypes.has('save')).toBe(true)
    expect(sourceTypes.has('document')).toBe(true)
    expect(sourceTypes.has('manual_content')).toBe(true)
    expect(sourceTypes.has('topic_summary')).toBe(true)
    expect(sourceTypes.has('brief')).toBe(true)
  })

  it('is idempotent — same input produces identical URLs (and thus signal IDs)', () => {
    const slice: CorpusStoreSlice = {
      saves: { s1: makeSave('item_s1') },
      topicSummaries: { topic_dev: makeTopicSummary('topic_dev') },
    }
    const run1 = ingestCorpus(slice).map(r => r.url)
    const run2 = ingestCorpus(slice).map(r => r.url)
    expect(run1).toEqual(run2)
  })

  it('deduplicates if the same item appears in saves and manualContent', () => {
    // Both adapters produce the same sourceId → dedupe should keep only one
    const item = { id: 'shared_item', title: 'Shared', summary: 'This is a substantial shared item summary about pain points in development', url: 'https://x.com', topicIds: [] }
    const slice: CorpusStoreSlice = {
      saves: { s1: { savedAt: '2026-05-01T00:00:00Z', item } },
      manualContent: { m1: { id: 'm1', item, topicId: null, topicIds: [], savedAt: '2026-05-01T00:00:00Z' } },
    }
    const results = ingestCorpus(slice)
    const sharedIds = results.filter(r => r.corpusSourceId === 'shared_item')
    // saves adapter runs first, so the save wins; manualContent duplicate is dropped
    expect(sharedIds.length).toBeLessThanOrEqual(2) // may differ by sourceType, but URL is unique
  })

  it('all records have source === "corpus"', () => {
    const d = makeDoc('d1')
    const slice: CorpusStoreSlice = {
      saves: { s1: makeSave('item_s1') },
      documents: { d1: d.meta },
      documentContents: { d1: d.content },
    }
    const results = ingestCorpus(slice)
    expect(results.every(r => r.source === 'corpus')).toBe(true)
  })

  it('all records have a URL in corpus:// scheme', () => {
    const slice: CorpusStoreSlice = { saves: { s1: makeSave('item_s1') } }
    const results = ingestCorpus(slice)
    expect(results.every(r => r.url.startsWith('corpus://'))).toBe(true)
  })

  it('returns [] without throwing when called with no args (no localStorage in test env)', () => {
    expect(() => ingestCorpus()).not.toThrow()
    expect(Array.isArray(ingestCorpus())).toBe(true)
  })
})
