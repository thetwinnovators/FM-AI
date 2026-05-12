import simpleGit from 'simple-git'
import { isPathAllowed } from '../sandbox/pathPolicy.js'

export interface GitAdapterOptions {
  allowedRoots: string[]
}

function assertAllowed(path: string, roots: string[]): string {
  const r = isPathAllowed(path, roots)
  if (!r.ok) throw new Error(`sandbox_violation: ${r.reason}`)
  return r.resolvedPath ?? path
}

export function createGitAdapter(opts: GitAdapterOptions) {
  const { allowedRoots } = opts

  return {
    async status(params: { repoPath: string }) {
      const resolved = assertAllowed(params.repoPath, allowedRoots)
      const git = simpleGit(resolved)
      const s = await git.status()
      return {
        isClean: s.isClean(),
        branch: s.current,
        files: s.files.map((f) => ({ path: f.path, index: f.index, working_dir: f.working_dir })),
        ahead: s.ahead,
        behind: s.behind,
      }
    },

    async log(params: { repoPath: string; maxCount?: number }) {
      const resolved = assertAllowed(params.repoPath, allowedRoots)
      const git = simpleGit(resolved)
      const log = await git.log({ maxCount: params.maxCount ?? 10 })
      return {
        commits: log.all.map((c) => ({
          hash: c.hash.slice(0, 8),
          date: c.date,
          message: c.message,
          author: c.author_name,
        })),
      }
    },

    async diff(params: { repoPath: string; staged?: boolean }) {
      const resolved = assertAllowed(params.repoPath, allowedRoots)
      const git = simpleGit(resolved)
      const diff = params.staged
        ? await git.diff(['--staged'])
        : await git.diff()
      return { diff }
    },

    async add(params: { repoPath: string; files: string[] }) {
      const resolved = assertAllowed(params.repoPath, allowedRoots)
      const git = simpleGit(resolved)
      await git.add(params.files)
      return { staged: params.files }
    },

    async commit(params: { repoPath: string; message: string }) {
      const resolved = assertAllowed(params.repoPath, allowedRoots)
      const git = simpleGit(resolved)
      const result = await git.commit(params.message)
      return {
        hash: result.commit.slice(0, 8),
        summary: result.summary,
      }
    },
  }
}
