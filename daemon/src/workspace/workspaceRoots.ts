import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface WorkspaceRootsOptions {
  filePath: string
  defaults: string[]
}

export class WorkspaceRoots {
  private roots: string[]
  private readonly filePath: string
  private listeners: Array<(roots: string[]) => void> = []

  constructor(opts: WorkspaceRootsOptions) {
    this.filePath = opts.filePath
    this.roots = WorkspaceRoots.load(opts.filePath, opts.defaults)
  }

  private static load(filePath: string, defaults: string[]): string[] {
    if (filePath && existsSync(filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
        if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) {
          return parsed
        }
      } catch { /* fall through */ }
    }
    return [...defaults]
  }

  list(): string[] {
    return [...this.roots]
  }

  async add(path: string): Promise<void> {
    const trimmed = path?.trim() ?? ''
    if (!trimmed) return
    if (this.roots.includes(trimmed)) return
    this.roots.push(trimmed)
    await this.save()
    this.notify()
  }

  async remove(path: string): Promise<void> {
    const before = this.roots.length
    this.roots = this.roots.filter((p) => p !== path)
    if (this.roots.length !== before) {
      await this.save()
      this.notify()
    }
  }

  onChange(listener: (roots: string[]) => void): () => void {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter((l) => l !== listener) }
  }

  private async save(): Promise<void> {
    if (!this.filePath) return
    mkdirSync(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(this.roots, null, 2), 'utf8')
  }

  private notify(): void {
    const snapshot = this.list()
    for (const l of this.listeners) l(snapshot)
  }
}
