export class Scheduler {
  private resetTimer: ReturnType<typeof setTimeout> | null = null
  private sweepTimer: ReturnType<typeof setTimeout> | null = null

  scheduleReset(delayMs: number, cb: () => void): void {
    if (this.resetTimer) clearTimeout(this.resetTimer)
    this.resetTimer = setTimeout(cb, delayMs)
  }

  scheduleSweep(delayMs: number, cb: () => void): void {
    if (this.sweepTimer) clearTimeout(this.sweepTimer)
    this.sweepTimer = setTimeout(cb, delayMs)
  }

  clear(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer)
    if (this.sweepTimer) clearTimeout(this.sweepTimer)
    this.resetTimer = null
    this.sweepTimer = null
  }
}
