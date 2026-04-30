import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

export default function BackToTop({ scrollRef, threshold = 400 }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return
    const onScroll = () => setVisible(el.scrollTop > threshold)
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, threshold])

  function scrollToTop() {
    scrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className={`fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full flex items-center justify-center text-white/85 border transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
      style={{
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
