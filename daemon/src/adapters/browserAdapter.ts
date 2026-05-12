import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface BrowserAdapter {
  open(p: { headless?: boolean; viewport?: { width: number; height: number } }): Promise<{ sessionId: string }>
  navigate(p: { sessionId: string; url: string; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<{ title: string; finalUrl: string; status: number | null }>
  screenshot(p: { sessionId: string; fullPage?: boolean; selector?: string; screenshotsDir: string; jobId: string }): Promise<{ path: string; sizeBytes: number }>
  extract(p: { sessionId: string; selector: string; attr?: 'text' | 'html' | 'href' | 'value' }): Promise<{ matches: string[] }>
  evaluate(p: { sessionId: string; script: string }): Promise<{ result: unknown }>
  click(p: { sessionId: string; selector: string; timeoutMs?: number }): Promise<{ clicked: true }>
  fill(p: { sessionId: string; selector: string; value: string }): Promise<{ filled: true }>
  close(p: { sessionId: string }): Promise<{ closed: true }>
  shutdown(): Promise<void>
}

interface Session {
  context: BrowserContext
  page: Page
  lastUsed: number
}

const SESSION_IDLE_MS = 30 * 60 * 1000

export function createBrowserAdapter(): BrowserAdapter {
  let browser: Browser | null = null
  const sessions = new Map<string, Session>()

  async function ensureBrowser(headless: boolean): Promise<Browser> {
    if (browser && browser.isConnected()) return browser
    browser = await chromium.launch({ headless })
    return browser
  }

  function getSession(id: string): Session {
    const s = sessions.get(id)
    if (!s) throw new Error(`adapter_failure: unknown session '${id}'`)
    s.lastUsed = Date.now()
    return s
  }

  const gcTimer = setInterval(() => {
    const now = Date.now()
    for (const [id, s] of sessions) {
      if (now - s.lastUsed > SESSION_IDLE_MS) {
        s.context.close().catch(() => {})
        sessions.delete(id)
      }
    }
  }, 60_000)
  gcTimer.unref?.()

  return {
    async open(p) {
      const b = await ensureBrowser(p.headless ?? true)
      const context = await b.newContext({ viewport: p.viewport ?? { width: 1280, height: 800 } })
      const page = await context.newPage()
      const sessionId = randomBytes(8).toString('hex')
      sessions.set(sessionId, { context, page, lastUsed: Date.now() })
      return { sessionId }
    },

    async navigate(p) {
      const s = getSession(p.sessionId)
      const resp = await s.page.goto(p.url, { waitUntil: p.waitUntil ?? 'load' })
      return {
        title: await s.page.title(),
        finalUrl: s.page.url(),
        status: resp?.status() ?? null,
      }
    },

    async screenshot(p) {
      const s = getSession(p.sessionId)
      await mkdir(p.screenshotsDir, { recursive: true })
      const path = join(p.screenshotsDir, `${p.jobId}.png`)
      if (p.selector) {
        const el = s.page.locator(p.selector).first()
        const buf = await el.screenshot({ path })
        return { path, sizeBytes: buf.length }
      }
      const buf = await s.page.screenshot({ path, fullPage: p.fullPage ?? false })
      return { path, sizeBytes: buf.length }
    },

    async extract(p) {
      const s = getSession(p.sessionId)
      const loc = s.page.locator(p.selector)
      const count = await loc.count()
      const attr = p.attr ?? 'text'
      const matches: string[] = []
      for (let i = 0; i < count; i++) {
        const el = loc.nth(i)
        if (attr === 'text') matches.push((await el.textContent()) ?? '')
        else if (attr === 'html') matches.push(await el.innerHTML())
        else if (attr === 'href') matches.push((await el.getAttribute('href')) ?? '')
        else if (attr === 'value') matches.push(await el.inputValue())
      }
      return { matches }
    },

    async evaluate(p) {
      const s = getSession(p.sessionId)
      const result = await s.page.evaluate(p.script)
      return { result }
    },

    async click(p) {
      const s = getSession(p.sessionId)
      await s.page.locator(p.selector).first().click({ timeout: p.timeoutMs ?? 5000 })
      return { clicked: true }
    },

    async fill(p) {
      const s = getSession(p.sessionId)
      await s.page.locator(p.selector).first().fill(p.value)
      return { filled: true }
    },

    async close(p) {
      const s = sessions.get(p.sessionId)
      if (s) {
        await s.context.close()
        sessions.delete(p.sessionId)
      }
      return { closed: true }
    },

    async shutdown() {
      clearInterval(gcTimer)
      for (const [, s] of sessions) await s.context.close().catch(() => {})
      sessions.clear()
      if (browser) await browser.close().catch(() => {})
      browser = null
    },
  }
}
