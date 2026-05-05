import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Copy, Check, Sparkles, Zap, MessageSquarePlus, Download } from 'lucide-react'
import { useStore } from '../../store/useStore.js'

const LIQUID_GLASS = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.06) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow:
    '0 30px 80px rgba(0,0,0,0.65),' +
    '0 8px 24px rgba(0,0,0,0.35),' +
    'inset 0 1px 0 rgba(255,255,255,0.12),' +
    'inset 0 -1px 0 rgba(255,255,255,0.04)',
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
        copied
          ? 'bg-teal-400/10 border-teal-400/30 text-teal-400'
          : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

function DownloadButton({ filename, content, label = 'Download' }) {
  function handleDownload() {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
    >
      <Download className="w-3 h-3" />
      {label}
    </button>
  )
}

function Section({ title, content, copyable = false }) {
  if (!content) return null
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide">{title}</h3>
        {copyable && <CopyButton text={content} />}
      </div>
      <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{content}</div>
    </div>
  )
}

export default function ConceptView({ concept, onClose }) {
  const navigate = useNavigate()
  const { createConversation } = useStore()

  useEffect(() => {
    if (!concept) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [concept, onClose])

  if (!concept) return null

  const isOllama        = concept.generatedBy === 'ollama'
  const evidenceSummary = concept.evidenceSummary ?? {}
  const sourceBreakdown = evidenceSummary.sourceBreakdown ?? {}
  const topQuotes       = evidenceSummary.topQuotes ?? []
  const painPoints      = concept.painPoints ?? []

  function handleEnhance() {
    const parts = [
      `Evaluate this app concept. Your response MUST contain exactly these three sections in this order — no exceptions, even if the concept is weak:\n\n## Is this worth building?\n2–3 sentences with your verdict.\n\n## Questions to consider\n- At least 3 bullet points the builder should think through.\n\n## How to enhance it\n- At least 3 concrete improvement ideas as bullet points.\n\nDo not skip any section. Do not add extra sections.\n\n# ${concept.title}`,
    ]
    if (concept.tagline)            parts.push(concept.tagline)
    if (concept.opportunitySummary) parts.push(`**Opportunity Summary:**\n${concept.opportunitySummary}`)
    if (concept.problemStatement)   parts.push(`**Problem:**\n${concept.problemStatement}`)
    if (concept.targetUser)         parts.push(`**Target User:**\n${concept.targetUser}`)
    if (concept.proposedSolution)   parts.push(`**Proposed Solution:**\n${concept.proposedSolution}`)
    if (concept.valueProp)          parts.push(`**Value Proposition:**\n${concept.valueProp}`)
    if (concept.mvpScope)           parts.push(`**MVP Scope:**\n${concept.mvpScope}`)
    if (concept.risks)              parts.push(`**Risks:**\n${concept.risks}`)
    const conv = createConversation()
    onClose()
    navigate(`/chat/${conv.id}`, { state: { autoSend: parts.join('\n\n') } })
  }

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={LIQUID_GLASS}
      >
        {/* Top shimmer line */}
        <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />

        {/* Header — fixed inside modal */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.08] flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                isOllama
                  ? 'bg-purple-400/10 text-purple-400'
                  : 'bg-teal-400/10 text-teal-400'
              }`}>
                {isOllama
                  ? <><Sparkles className="w-2.5 h-2.5" /> AI-enhanced</>
                  : <><Zap className="w-2.5 h-2.5" /> Generated from signals</>
                }
              </span>
              <span className="text-[11px] text-white/30">
                Confidence: {concept.confidenceScore}%
              </span>
            </div>
            <h2 className="text-base font-semibold">{concept.title}</h2>
            <p className="text-sm text-white/50 mt-0.5">{concept.tagline}</p>
          </div>
          <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Evidence summary */}
          <div className="mb-5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs">
            <div className="text-white/30 mb-2 uppercase tracking-wide text-[11px]">Evidence</div>
            <div className="flex flex-wrap gap-3 mb-2 text-white/60">
              <span>{evidenceSummary.signalCount ?? 0} signals</span>
              {Object.entries(sourceBreakdown).map(([src, n]) => (
                <span key={src}>{src}: {n}</span>
              ))}
            </div>
            {topQuotes.slice(0, 3).map((q, i) => (
              <blockquote key={q.url ?? `${q.source}-${i}`} className="text-white/40 italic border-l-2 border-white/10 pl-2 mb-1.5 text-xs">
                "{q.text.slice(0, 150)}"
                {q.url && (
                  <a href={q.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-teal-400/70 not-italic">
                    [{q.source}]
                  </a>
                )}
              </blockquote>
            ))}
          </div>

          {/* Pain points */}
          {painPoints.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-1.5">
                Recurring Pain Points
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {painPoints.map(({ point, frequency }) => (
                  <li key={point} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-white/60 border border-white/8">
                    {point} <span className="text-white/30">×{frequency}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Section title="Opportunity Summary"  content={concept.opportunitySummary} />
          <Section title="Problem Statement"    content={concept.problemStatement} />
          <Section title="Target User"          content={concept.targetUser} />
          <Section title="Proposed Solution"    content={concept.proposedSolution} />
          <Section title="Value Proposition"    content={concept.valueProp} />
          <Section title="MVP Scope"            content={concept.mvpScope} />
          <Section title="Risks"               content={concept.risks} />
          <Section title="AI IDE Prompt"  content={concept.claudeCodePrompt} copyable />
          <Section title="Implementation Plan" content={concept.implementationPlan} copyable />
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-white/[0.08] flex-shrink-0">
          <CopyButton text={concept.claudeCodePrompt} label="AI IDE Prompt" />
          <DownloadButton
            filename={`${concept.title.toLowerCase().replace(/\s+/g, '-')}.md`}
            content={`# ${concept.title}\n\n${concept.tagline}\n\n---\n\n${concept.claudeCodePrompt}\n\n---\n\n${concept.implementationPlan}`}
            label="Download as Markdown (.md)"
          />
          <button
            onClick={handleEnhance}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-purple-400/20 text-purple-400 hover:text-purple-300 hover:border-purple-400/40 transition-colors"
          >
            <MessageSquarePlus className="w-3 h-3" />
            Enhance with FlowAI
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
