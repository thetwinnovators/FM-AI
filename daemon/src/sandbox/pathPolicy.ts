import { realpathSync, existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'

export interface PathCheckResult {
  ok: boolean
  reason?: string
  resolvedPath?: string
}

const DENY_SEGMENTS = [
  /[\\/]\.ssh([\\/]|$)/i,
  /[\\/]\.aws([\\/]|$)/i,
  /[\\/]\.flowmap[\\/]daemon\.json$/i,
  /^\/etc([\\/]|$)/i,
  /^\/sys([\\/]|$)/i,
  /^\/proc([\\/]|$)/i,
]

function realResolve(p: string): string {
  const abs = resolve(p)
  if (existsSync(abs)) return realpathSync(abs)
  return abs
}

function withTrailingSep(p: string): string {
  return p.endsWith(sep) ? p : p + sep
}

export function isPathAllowed(candidate: string, allowedRoots: string[]): PathCheckResult {
  let resolved: string
  try {
    resolved = realResolve(candidate)
  } catch (err: any) {
    return { ok: false, reason: `cannot resolve path: ${err?.message ?? err}` }
  }

  for (const pat of DENY_SEGMENTS) {
    if (pat.test(resolved)) {
      return { ok: false, reason: `path matches denylist (${pat.source})`, resolvedPath: resolved }
    }
  }

  const resolvedWithSep = withTrailingSep(resolved)
  for (const root of allowedRoots) {
    const rootWithSep = withTrailingSep(realResolve(root))
    if (resolvedWithSep.startsWith(rootWithSep)) {
      return { ok: true, resolvedPath: resolved }
    }
  }

  return { ok: false, reason: 'resolved path is not within allowed roots', resolvedPath: resolved }
}
