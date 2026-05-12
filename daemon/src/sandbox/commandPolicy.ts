export interface CommandCheckResult {
  ok: boolean
  reason?: string
  normalized?: string
}

const SHELL_META = /[;&|`$<>(){}*?[\]"'\\]/
const PATH_SEP = /[\\/]/

export function isCommandAllowed(command: string, allowlist: string[]): CommandCheckResult {
  if (!command || typeof command !== 'string') {
    return { ok: false, reason: 'command must be a non-empty string' }
  }
  if (PATH_SEP.test(command)) {
    return { ok: false, reason: 'command must not contain path separators' }
  }
  if (SHELL_META.test(command)) {
    return { ok: false, reason: 'command contains shell metacharacters' }
  }

  const normalized = command
    .toLowerCase()
    .replace(/\.(exe|cmd|bat|ps1)$/i, '')

  const allow = allowlist.map((c) => c.toLowerCase())
  if (!allow.includes(normalized)) {
    return { ok: false, reason: `'${normalized}' is not in the allowlist` }
  }
  return { ok: true, normalized }
}
