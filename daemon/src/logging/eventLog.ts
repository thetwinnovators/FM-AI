import pino from 'pino'
import type { JobEvent } from '../types.js'

export class EventLog {
  private subs = new Map<string, Set<(e: JobEvent) => void>>()
  private hist = new Map<string, JobEvent[]>()
  private logger: pino.Logger

  constructor(logFile?: string) {
    this.logger = logFile
      ? pino(pino.destination({ dest: logFile, sync: false, mkdir: true }))
      : pino({ level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' })
  }

  subscribe(jobId: string, listener: (e: JobEvent) => void): () => void {
    if (!this.subs.has(jobId)) this.subs.set(jobId, new Set())
    this.subs.get(jobId)!.add(listener)
    for (const e of this.hist.get(jobId) ?? []) listener(e)
    return () => this.subs.get(jobId)?.delete(listener)
  }

  emit(event: JobEvent): void {
    if (!this.hist.has(event.jobId)) this.hist.set(event.jobId, [])
    this.hist.get(event.jobId)!.push(event)
    this.logger.info(event, 'jobEvent')
    for (const fn of this.subs.get(event.jobId) ?? []) {
      try { fn(event) } catch (err) { this.logger.warn({ err }, 'subscriber threw') }
    }
  }

  history(jobId: string): JobEvent[] {
    return [...(this.hist.get(jobId) ?? [])]
  }

  clearHistory(jobId: string): void {
    this.hist.delete(jobId)
  }
}
