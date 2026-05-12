import { describe, it, expect } from 'vitest'
import { JobQueue } from '../../src/queue/jobQueue.js'

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

describe('JobQueue', () => {
  it('runs jobs in submission order at concurrency 1', async () => {
    const q = new JobQueue({ concurrency: 1 })
    const order: number[] = []
    const a = q.submit(async () => { order.push(1) })
    const b = q.submit(async () => { order.push(2) })
    const c = q.submit(async () => { order.push(3) })
    await Promise.all([a, b, c])
    expect(order).toEqual([1, 2, 3])
  })

  it('respects concurrency limit', async () => {
    const q = new JobQueue({ concurrency: 2 })
    let active = 0
    let maxActive = 0
    const d1 = deferred<void>(); const d2 = deferred<void>(); const d3 = deferred<void>()
    const make = (d: { promise: Promise<void> }) => async () => {
      active++; maxActive = Math.max(maxActive, active)
      await d.promise
      active--
    }
    q.submit(make(d1)); q.submit(make(d2)); q.submit(make(d3))
    await new Promise((r) => setTimeout(r, 10))
    expect(maxActive).toBe(2)
    d1.resolve(); d2.resolve(); d3.resolve()
    await new Promise((r) => setTimeout(r, 10))
  })

  it('propagates errors via the returned promise', async () => {
    const q = new JobQueue({ concurrency: 1 })
    await expect(q.submit(async () => { throw new Error('boom') })).rejects.toThrow('boom')
  })
})
