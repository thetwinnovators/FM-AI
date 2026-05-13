import { useEffect, useRef } from 'react'

export function useFlowTradeSSE(onEvent) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    const ctrl = new AbortController()

    async function connect() {
      const token = localStorage.getItem('fm_operator_token') ?? ''
      try {
        const res = await fetch('http://localhost:59990/flow-trade/events', {
          headers: { authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) return
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
