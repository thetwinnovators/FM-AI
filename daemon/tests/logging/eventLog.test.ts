import { describe, it, expect } from 'vitest'
import { EventLog } from '../../src/logging/eventLog.js'

describe('EventLog', () => {
  it('delivers events to subscribers of the matching jobId', () => {
    const log = new EventLog()
    const got: any[] = []
    log.subscribe('job-1', (e) => got.push(e))
    log.emit({ type: 'running', jobId: 'job-1' })
    log.emit({ type: 'running', jobId: 'job-2' })
    expect(got).toHaveLength(1)
    expect(got[0].jobId).toBe('job-1')
  })

  it('unsubscribe stops further events', () => {
    const log = new EventLog()
    const got: any[] = []
    const unsub = log.subscribe('j', (e) => got.push(e))
    log.emit({ type: 'running', jobId: 'j' })
    unsub()
    log.emit({ type: 'done', jobId: 'j', result: {} })
    expect(got).toHaveLength(1)
  })

  it('records all events to history accessible by jobId', () => {
    const log = new EventLog()
    log.emit({ type: 'queued', jobId: 'j' })
    log.emit({ type: 'running', jobId: 'j' })
    log.emit({ type: 'done', jobId: 'j', result: { x: 1 } })
    const hist = log.history('j')
    expect(hist).toHaveLength(3)
    expect(hist[2]!.type).toBe('done')
  })
})
