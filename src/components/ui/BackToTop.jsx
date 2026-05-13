import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { subscribeChatPanel, getChatPanelState } from '../../lib/chatPanelState.js'

export default function BackToTop({ scrollRef, threshold = 400 }) {
  const [visible, setVisible] = useState(false)
  const [chatState, setChatState] = useState(getChatPanelState)

  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return
    const onScroll = () => setVisible(el.scrollTop > threshold)
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, threshold])

  useEffect(() => {
    return subscribeChatPanel((s) => setChatState({ ...s }))
  }, [])

  const isFloatingOpen = chatState.open && chatState.mode === 'floating'
  const show = visible && !isFloatingOpen

  return (
    <button
      onClick={() => scrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className={`fixed bottom-6 left-1/2 z-40 w-11 h-11 rounded-full flex items-center justify-center text-white/85 border ${
        show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        // translateX(-50%) centres the button; translateY shifts for the show/hide animation.
        // All transforms on one property avoids Tailwind class conflicts.
        transform: `translateX(-50%) translateY(${show ? '0px' : '8px'})`,
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        background: 'linear-gradient(160deg, rgba(217,70,239,0.22) 0%, rgba(99,102,241,0.18) 100%)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderColor: 'rgba(255,255,255,0.18)',
        boxShadow:
          '0 12px 32px rgba(0,0,0,0.45),' +
          '0 4px 12px rgba(0,0,0,0.30),' +
          'inset 0 1px 0 rgba(255,255,255,0.20)',
      }}
    >
      <ArrowUp size={18} />
    </button>
  )
}
