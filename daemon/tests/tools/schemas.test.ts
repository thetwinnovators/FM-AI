import { describe, it, expect } from 'vitest'
import { schemas } from '../../src/tools/schemas.js'

describe('tool schemas', () => {
  it('file.read requires a path string', () => {
    expect(schemas['file.read']!.safeParse({ path: '/tmp/a' }).success).toBe(true)
    expect(schemas['file.read']!.safeParse({}).success).toBe(false)
    expect(schemas['file.read']!.safeParse({ path: 123 }).success).toBe(false)
  })

  it('file.write accepts overwrite/append modes', () => {
    expect(schemas['file.write']!.safeParse({ path: '/tmp/a', content: 'x' }).success).toBe(true)
    expect(schemas['file.write']!.safeParse({ path: '/tmp/a', content: 'x', mode: 'overwrite' }).success).toBe(true)
    expect(schemas['file.write']!.safeParse({ path: '/tmp/a', content: 'x', mode: 'append' }).success).toBe(true)
    expect(schemas['file.write']!.safeParse({ path: '/tmp/a', content: 'x', mode: 'truncate' }).success).toBe(false)
  })

  it('system.exec requires command and args array', () => {
    expect(schemas['system.exec']!.safeParse({ command: 'python', args: ['-V'] }).success).toBe(true)
    expect(schemas['system.exec']!.safeParse({ command: 'python', args: 'not-an-array' }).success).toBe(false)
  })

  it('browser.navigate requires sessionId + url', () => {
    expect(schemas['browser.navigate']!.safeParse({ sessionId: 'abc', url: 'https://example.com' }).success).toBe(true)
    expect(schemas['browser.navigate']!.safeParse({ sessionId: 'abc' }).success).toBe(false)
  })

  it('all 15 primitives have schemas defined', () => {
    const expected = [
      'file.read', 'file.list', 'file.exists', 'file.write', 'file.delete',
      'system.exec', 'system.exec_inline',
      'browser.open', 'browser.navigate', 'browser.screenshot', 'browser.extract',
      'browser.evaluate', 'browser.click', 'browser.fill', 'browser.close',
    ]
    for (const id of expected) {
      expect(schemas[id], `${id} schema missing`).toBeDefined()
    }
  })
})
