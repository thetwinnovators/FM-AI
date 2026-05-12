import { describe, it, expect, beforeEach } from 'vitest'
import { JobStore } from '../../src/queue/jobStore.js'
import type { Job } from '../../src/types.js'

describe('JobStore (in-memory SQLite)', () => {
  let store: JobStore

  beforeEach(() => { store = new JobStore(':memory:') })

  const sample: Job = {
    id: 'j1', toolId: 'file.read', params: { path: '/x' },
    status: 'queued', createdAt: new Date().toISOString(),
  }

  it('inserts and retrieves a job', () => {
    store.insert(sample)
    expect(store.get('j1')?.id).toBe('j1')
    expect(store.get('j1')?.status).toBe('queued')
  })

  it('updates status and timestamps', () => {
    store.insert(sample)
    store.updateStatus('j1', 'running', { startedAt: '2026-01-01T00:00:00Z' })
    expect(store.get('j1')?.status).toBe('running')
    expect(store.get('j1')?.startedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('attaches a result on completion', () => {
    store.insert(sample)
    store.complete('j1', { content: 'hi' })
    const j = store.get('j1')!
    expect(j.status).toBe('done')
    expect(j.result).toEqual({ content: 'hi' })
  })

  it('attaches an error on failure', () => {
    store.insert(sample)
    store.fail('j1', { code: 'adapter_failure', message: 'boom' })
    const j = store.get('j1')!
    expect(j.status).toBe('failed')
    expect(j.error?.code).toBe('adapter_failure')
  })

  it('lists jobs newest first', () => {
    store.insert({ ...sample, id: 'a', createdAt: '2026-01-01T00:00:00Z' })
    store.insert({ ...sample, id: 'b', createdAt: '2026-01-02T00:00:00Z' })
    const all = store.list({ limit: 10 })
    expect(all[0]!.id).toBe('b')
    expect(all[1]!.id).toBe('a')
  })
})
