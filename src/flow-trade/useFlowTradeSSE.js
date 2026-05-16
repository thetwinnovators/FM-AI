import { useEffect, useRef } from 'react'

export function useFlowTradeSSE(onEvent) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    const ctrl = new AbortController()

    async function connect() {
      // Always fetch fresh port + token from the Vite proxy so a daemon
      // restart doesn't leave us stuck with a stale token or wrong port.
      let info = null
      try {
        const r = await fetch('/api/daemon/info')
        if (r.ok) info = await r.json()
      } catch { /* daemon not running yet */ }

      if (!info) {
        if (!ctrl.signal.aborted) setTimeout(connect, 3_000)
        return
      }

      try {
        // Route through Vite proxy to avoid cross-origin issues
        const res = await fetch(`/api/daemon-proxy/flow-trade/events`, {
          headers: { authorization: `Bearer ${info.token}` },
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) {
          if (!ctrl.signal.aborted) setTimeout(connect, 3_000)
          return
        }
        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const chunks = buf.split('\n\n')
          buf = chunks.pop() ?? ''
          for (const chunk of chunks) {
            if (chunk.startsWith('data: ')) {
              try { onEventRef.current(JSON.parse(chunk.slice(6))) } catch { /* ignore */ }
            }
          }
        }
        if (!ctrl.signal.aborted) setTimeout(connect, 2_000)
      } catch {
        if (!ctrl.signal.aborted) setTimeout(connect, 3_000)
      }
    }

    connect()
    return () => ctrl.abort()
  }, [])
}
