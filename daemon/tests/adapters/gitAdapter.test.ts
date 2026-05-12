import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { createGitAdapter } from '../../src/adapters/gitAdapter.js'

async function makeTestRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'git-adapter-test-'))
  execSync('git init --initial-branch=main', { cwd: dir })
  execSync('git config user.email test@test.com', { cwd: dir })
  execSync('git config user.name "Test"', { cwd: dir })
  await writeFile(join(dir, 'hello.txt'), 'hello')
  execSync('git add .', { cwd: dir })
  execSync('git commit -m "initial"', { cwd: dir })
  return dir
}

describe('gitAdapter', () => {
  let dir: string
  let adapter: ReturnType<typeof import('../../src/adapters/gitAdapter.js').createGitAdapter>

  beforeAll(async () => {
    dir = await makeTestRepo()
    const { createGitAdapter } = await import('../../src/adapters/gitAdapter.js')
    adapter = createGitAdapter({ allowedRoots: [dir] })
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('git.status returns clean on fresh-committed repo', async () => {
    const r = await adapter.status({ repoPath: dir })
    expect(r.isClean).toBe(true)
    expect(r.files).toHaveLength(0)
    expect(r.branch).toBe('main')
  })

  it('git.log returns at least one commit', async () => {
    const r = await adapter.log({ repoPath: dir, maxCount: 5 })
    expect(r.commits.length).toBeGreaterThanOrEqual(1)
    expect(r.commits[0]!.message).toContain('initial')
    expect(r.commits[0]!.hash).toHaveLength(8)
  })

  it('git.diff returns empty on clean repo', async () => {
    const r = await adapter.diff({ repoPath: dir })
    expect(r.diff).toBe('')
  })

  it('git.status detects modified file', async () => {
    await writeFile(join(dir, 'hello.txt'), 'modified content')
    const r = await adapter.status({ repoPath: dir })
    expect(r.isClean).toBe(false)
    expect(r.files.some((f: any) => f.path === 'hello.txt')).toBe(true)
  })

  it('git.add stages a file then git.commit creates a commit', async () => {
    await adapter.add({ repoPath: dir, files: ['hello.txt'] })
    const result = await adapter.commit({ repoPath: dir, message: 'update hello' })
    expect(result.hash).toBeDefined()
    expect(result.hash).toHaveLength(8)
    const log = await adapter.log({ repoPath: dir, maxCount: 5 })
    expect(log.commits[0]!.message).toContain('update hello')
  })

  it('rejects path outside allowedRoots with sandbox_violation', async () => {
    await expect(adapter.status({ repoPath: '/some/other/path' })).rejects.toThrow(/sandbox_violation/)
  })
})
