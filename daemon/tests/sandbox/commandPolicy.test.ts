import { describe, it, expect } from 'vitest'
import { isCommandAllowed } from '../../src/sandbox/commandPolicy.js'

const ALLOW = ['python', 'python3', 'node', 'npm', 'git', 'curl']

describe('commandPolicy.isCommandAllowed', () => {
  it('accepts an exact-match logical command', () => {
    expect(isCommandAllowed('python', ALLOW).ok).toBe(true)
    expect(isCommandAllowed('node', ALLOW).ok).toBe(true)
  })

  it('strips .exe / .cmd on Windows-style names', () => {
    expect(isCommandAllowed('python.exe', ALLOW).ok).toBe(true)
    expect(isCommandAllowed('npm.cmd', ALLOW).ok).toBe(true)
    expect(isCommandAllowed('Python.EXE', ALLOW).ok).toBe(true)
  })

  it('rejects path traversal / absolute paths in command', () => {
    expect(isCommandAllowed('/usr/bin/python', ALLOW).ok).toBe(false)
    expect(isCommandAllowed('C:\\Windows\\python.exe', ALLOW).ok).toBe(false)
    expect(isCommandAllowed('../python', ALLOW).ok).toBe(false)
  })

  it('rejects shell metacharacters', () => {
    expect(isCommandAllowed('python && rm -rf /', ALLOW).ok).toBe(false)
    expect(isCommandAllowed('python | cat', ALLOW).ok).toBe(false)
    expect(isCommandAllowed('python;ls', ALLOW).ok).toBe(false)
  })

  it('rejects non-allowlisted commands', () => {
    expect(isCommandAllowed('rm', ALLOW).ok).toBe(false)
    expect(isCommandAllowed('ls', ALLOW).ok).toBe(false)
  })
})
