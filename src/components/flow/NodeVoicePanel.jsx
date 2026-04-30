import { useEffect, useRef, useState } from 'react'
import { Volume2, X, Loader2, Play, Square } from 'lucide-react'
import { playTtsWithCaptions, stopVoice } from '../../lib/voice/player.js'
import { VOICE_CONFIG } from '../../lib/voice/voiceConfig.js'
import { getTypeMeta } from '../../lib/graph/nodeTaxonomy.js'

// Captions overlay anchored to the right edge of the network canvas. When a
// node is selected, this fetches a TTS read of the node's summary along with
// character-level timing from ElevenLabs, then highlights tokens
// progressively as the audio plays. Falls back to a plain "summary text"
// view when ElevenLabs is unavailable or the user hasn't opted in.
export default function NodeVoicePanel({ node, autoplay = false, onClose }) {
  const [tokens, setTokens] = useState(null)         // [{ text, start, end, isSpace }]
  const [currentTime, setCurrentTime] = useState(0)
  const [phase, setPhase] = useState('idle')         // idle | loading | speaking | error | done
  const audioRef = useRef(null)

  // Reset whenever the selected node changes.
  useEffect(() => {
    audioRef.current = null
    setTokens(null)
    setCurrentTime(0)
    setPhase('idle')
    return () => stopVoice()
  }, [node?.id])

  // Auto-speak when allowed by settings AND a node is provided. Each node
  // change triggers a fresh fetch; the player itself cancels prior playback.
  useEffect(() => {
    if (!node || !autoplay || !VOICE_CONFIG.enabled) return
    speak()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, autoplay])

  // Drive the highlight off audio.currentTime via rAF — `timeupdate` fires
  // ~4x/sec on most browsers which is too laggy for word-level captions.
  useEffect(() => {
    if (phase !== 'speaking' || !audioRef.current) return
    let raf = 0
    const tick = () => {
      const a = audioRef.current
      if (a) setCurrentTime(a.currentTime)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  async function speak() {
    if (!node) return
    const text = buildNodeText(node)
    if (!text) return
    setPhase('loading')
    try {
      const handle = await playTtsWithCaptions(text)
      if (!handle) { setPhase('error'); return }
      audioRef.current = handle.audio
      setTokens(handle.tokens)
      setPhase('speaking')
      handle.audio.addEventListener('ended', () => setPhase('done'))
    } catch {
      setPhase('error')
    }
  }

  function stop() {
    stopVoice()
    setPhase('done')
  }

  if (!node) return null

  const typeMeta = getTypeMeta(node.type) || { color: 'rgba(255,255,255,0.6)', label: node.type }
  const fallbackText = buildNodeText(node)

  return (
    <aside
      className="absolute top-12 right-0 bottom-0 w-[320px] flex flex-col z-20 pointer-events-auto"
      style={{
        background: 'linear-gradient(180deg, rgba(11,13,24,0.92) 0%, rgba(5,7,15,0.96) 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      }}
    >
      <header className="flex items-start justify-between gap-2 px-4 py-3 border-b border-white/[0.06]">
        <div className="min-w-0">
          <span
            className="inline-flex items-center text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded"
            style={{ color: typeMeta.color, backgroundColor: `color-mix(in srgb, ${typeMeta.color} 15%, transparent)` }}
          >
            {typeMeta.label}
          </span>
          <h3 className="mt-1.5 text-sm font-semibold text-white leading-snug">{node.label}</h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {phase === 'speaking' ? (
            <button
              onClick={stop}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.08]"
              title="Stop"
              aria-label="Stop"
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              onClick={speak}
              disabled={phase === 'loading'}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.08] disabled:opacity-40"
              title={phase === 'done' ? 'Replay' : 'Speak'}
              aria-label="Speak"
            >
              {phase === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            </button>
          )}
          {onClose ? (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08]"
              aria-label="Close"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-3 text-[14px] leading-relaxed">
        {phase === 'error' ? (
          <p className="text-amber-300/80 text-[12px]">
            Couldn't reach ElevenLabs. Showing the summary without captions.
          </p>
        ) : null}

        {tokens && tokens.length > 0 ? (
          <p className="text-white/85">
            {tokens.map((tok, i) => {
              const spoken = currentTime >= tok.end - 0.02
              const speaking = !spoken && currentTime >= tok.start - 0.02
              return (
                <span
                  key={i}
                  className="transition-colors duration-150"
                  style={{
                    color: spoken ? 'rgba(255,255,255,0.95)' : speaking
                      ? 'rgba(20,184,166,1)' // teal — currently speaking
                      : 'rgba(255,255,255,0.35)',
                    textShadow: speaking ? '0 0 8px rgba(20,184,166,0.55)' : 'none',
                  }}
                >
                  {tok.text}
                </span>
              )
            })}
          </p>
        ) : (
          <p className="text-white/65 whitespace-pre-line">{fallbackText}</p>
        )}
      </div>

      <footer className="px-4 py-2.5 border-t border-white/[0.06] text-[11px] text-white/40 inline-flex items-center gap-1.5">
        <Volume2 size={11} />
        {phase === 'speaking' ? 'Speaking…' : phase === 'loading' ? 'Generating audio…' : phase === 'done' ? 'Done' : VOICE_CONFIG.enabled ? 'Click ▶ to hear' : 'Voice off in settings'}
      </footer>
    </aside>
  )
}

// Build the read-aloud text for a node. Uses summary if present, falls back to
// the label so the panel never shows empty content. Intentionally short so
// TTS latency stays low — for long-form nodes the user can still navigate to
// the topic / document page for the full text.
function buildNodeText(node) {
  if (!node) return ''
  const summary = String(node.summary || '').trim()
  const label = String(node.label || '').trim()
  if (summary) return `${label}. ${summary}`
  return label
}
