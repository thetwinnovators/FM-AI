type Task<T> = () => Promise<T>

interface QueueEntry<T = unknown> {
  task: Task<T>
  resolve: (v: T) => void
  reject: (err: unknown) => void
}

export interface JobQueueOptions {
  concurrency: number
}

export class JobQueue {
  private active = 0
  private waiting: QueueEntry[] = []

  constructor(private opts: JobQueueOptions) {}

  submit<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({ task: task as Task<unknown>, resolve: resolve as any, reject })
      this.tick()
    })
  }

  private tick(): void {
    while (this.active < this.opts.concurrency && this.waiting.length > 0) {
      const entry = this.waiting.shift()!
      this.active++
      entry.task()
        .then((v) => entry.resolve(v))
        .catch((err) => entry.reject(err))
        .finally(() => { this.active--; this.tick() })
    }
  }

  get activeCount(): number { return this.active }
  get pendingCount(): number { return this.waiting.length }
}
