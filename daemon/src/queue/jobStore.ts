import Database from 'better-sqlite3'
import type { Job, JobError, JobStatus } from '../types.js'

export interface ListOptions { limit?: number; offset?: number; status?: JobStatus }

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS jobs (
    id           TEXT PRIMARY KEY,
    toolId       TEXT NOT NULL,
    params       TEXT NOT NULL,
    status       TEXT NOT NULL,
    createdAt    TEXT NOT NULL,
    startedAt    TEXT,
    finishedAt   TEXT,
    result       TEXT,
    error        TEXT
  )
`

const CREATE_INDEX = `CREATE INDEX IF NOT EXISTS jobs_createdAt_idx ON jobs (createdAt DESC)`

export class JobStore {
  private db: Database.Database

  constructor(filename: string) {
    this.db = new Database(filename)
    this.db.pragma('journal_mode = WAL')
    this.db.prepare(CREATE_TABLE).run()
    this.db.prepare(CREATE_INDEX).run()
  }

  insert(job: Job): void {
    this.db.prepare(`
      INSERT INTO jobs (id, toolId, params, status, createdAt, startedAt, finishedAt, result, error)
      VALUES (@id, @toolId, @params, @status, @createdAt, @startedAt, @finishedAt, @result, @error)
    `).run({
      id: job.id, toolId: job.toolId, params: JSON.stringify(job.params),
      status: job.status, createdAt: job.createdAt,
      startedAt: job.startedAt ?? null, finishedAt: job.finishedAt ?? null,
      result: job.result === undefined ? null : JSON.stringify(job.result),
      error: job.error ? JSON.stringify(job.error) : null,
    })
  }

  updateStatus(id: string, status: JobStatus, patch: Partial<Job> = {}): void {
    this.db.prepare(`
      UPDATE jobs SET status = @status,
        startedAt = COALESCE(@startedAt, startedAt),
        finishedAt = COALESCE(@finishedAt, finishedAt)
      WHERE id = @id
    `).run({
      id, status,
      startedAt: patch.startedAt ?? null,
      finishedAt: patch.finishedAt ?? null,
    })
  }

  complete(id: string, result: unknown): void {
    this.db.prepare(`
      UPDATE jobs SET status = 'done', result = @result, finishedAt = @finishedAt WHERE id = @id
    `).run({ id, result: JSON.stringify(result), finishedAt: new Date().toISOString() })
  }

  fail(id: string, error: JobError): void {
    this.db.prepare(`
      UPDATE jobs SET status = 'failed', error = @error, finishedAt = @finishedAt WHERE id = @id
    `).run({ id, error: JSON.stringify(error), finishedAt: new Date().toISOString() })
  }

  cancel(id: string): void {
    this.db.prepare(`UPDATE jobs SET status = 'cancelled', finishedAt = @finishedAt WHERE id = @id`)
      .run({ id, finishedAt: new Date().toISOString() })
  }

  get(id: string): Job | null {
    const row = this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any
    if (!row) return null
    return this.rowToJob(row)
  }

  list(opts: ListOptions = {}): Job[] {
    const limit = opts.limit ?? 50
    const offset = opts.offset ?? 0
    const rows = opts.status
      ? this.db.prepare(`SELECT * FROM jobs WHERE status = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(opts.status, limit, offset)
      : this.db.prepare(`SELECT * FROM jobs ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(limit, offset)
    return (rows as any[]).map((r) => this.rowToJob(r))
  }

  private rowToJob(r: any): Job {
    return {
      id: r.id, toolId: r.toolId, params: JSON.parse(r.params),
      status: r.status, createdAt: r.createdAt,
      startedAt: r.startedAt ?? undefined, finishedAt: r.finishedAt ?? undefined,
      result: r.result ? JSON.parse(r.result) : undefined,
      error: r.error ? JSON.parse(r.error) : undefined,
    }
  }
}
