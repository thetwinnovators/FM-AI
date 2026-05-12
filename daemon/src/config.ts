import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

export interface FlowMapConfig {
  port: number
  token: string
}

const DEFAULT_DIR = join(homedir(), '.flowmap')

function lockdown(path: string): void {
  if (platform() === 'win32') {
    try {
      const user = process.env.USERNAME ?? ''
      if (user) {
        execFileSync('icacls', [path, '/inheritance:r', '/grant:r', `${user}:(R,W)`], { stdio: 'ignore' })
      }
    } catch { /* best-effort */ }
  } else {
    try { chmodSync(path, 0o600) } catch { /* best-effort */ }
  }
}

export function loadOrCreateConfig(dir: string = DEFAULT_DIR): FlowMapConfig {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const file = join(dir, 'daemon.json')
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, 'utf8')) as FlowMapConfig
  }
  const cfg: FlowMapConfig = {
    port: 0,
    token: randomBytes(32).toString('hex'),
  }
  writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8')
  lockdown(file)
  return cfg
}

export function saveActualPort(dir: string, port: number): void {
  const file = join(dir, 'daemon.json')
  const cfg = JSON.parse(readFileSync(file, 'utf8')) as FlowMapConfig
  cfg.port = port
  writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8')
  lockdown(file)
}

export const CONFIG_DIR = DEFAULT_DIR
