import { readFile, writeFile, appendFile, readdir, stat, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { isPathAllowed } from '../sandbox/pathPolicy.js'

const MAX_READ_BYTES = 10 * 1024 * 1024
const MAX_WRITE_BYTES = 100 * 1024 * 1024

export interface FileAdapterOptions {
  allowedRoots: string[]
}

function assertAllowed(path: string, roots: string[]): string {
  const r = isPathAllowed(path, roots)
  if (!r.ok) throw new Error(`sandbox_violation: ${r.reason}`)
  return r.resolvedPath ?? path
}

export function createFileAdapter(opts: FileAdapterOptions) {
  const { allowedRoots } = opts

  return {
    async read(params: { path: string }) {
      const resolved = assertAllowed(params.path, allowedRoots)
      const buf = await readFile(resolved)
      if (buf.length > MAX_READ_BYTES) {
        throw new Error(`adapter_failure: file exceeds ${MAX_READ_BYTES} bytes`)
      }
      return { content: buf.toString('utf8'), encoding: 'utf8' as const, sizeBytes: buf.length }
    },

    async list(params: { path: string; recursive?: boolean }) {
      const resolved = assertAllowed(params.path, allowedRoots)
      const names = await readdir(resolved)
      const entries = await Promise.all(names.map(async (name) => {
        const full = join(resolved, name)
        const s = await stat(full)
        return {
          name,
          type: s.isDirectory() ? 'dir' : 'file',
          sizeBytes: s.size,
          mtime: s.mtime.toISOString(),
        }
      }))
      return { entries }
    },

    async exists(params: { path: string }) {
      try {
        const resolved = assertAllowed(params.path, allowedRoots)
        if (!existsSync(resolved)) return { exists: false, type: null }
        const s = await stat(resolved)
        return { exists: true, type: s.isDirectory() ? 'dir' : 'file' as const }
      } catch {
        return { exists: false, type: null }
      }
    },

    async write(params: { path: string; content: string; mode?: 'overwrite' | 'append' }) {
      const resolved = assertAllowed(params.path, allowedRoots)
      const bytes = Buffer.byteLength(params.content, 'utf8')
      if (bytes > MAX_WRITE_BYTES) {
        throw new Error(`adapter_failure: content exceeds ${MAX_WRITE_BYTES} bytes`)
      }
      if (params.mode === 'append') {
        await appendFile(resolved, params.content, 'utf8')
      } else {
        await writeFile(resolved, params.content, 'utf8')
      }
      return { bytesWritten: bytes }
    },

    async delete(params: { path: string; recursive?: boolean }) {
      const resolved = assertAllowed(params.path, allowedRoots)
      await rm(resolved, { recursive: params.recursive ?? false, force: false })
      return { deletedCount: 1 }
    },
  }
}
