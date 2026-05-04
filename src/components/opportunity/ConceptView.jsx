import { useState } from 'react'
import { X, Copy, Check, Sparkles, Zap } from 'lucide-react'

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
      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : label}
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
  if (!concept) return null

  const isOllama = concept.generatedBy === 'ollama'

  return (
    <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.025] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
              isOllama
                ? 'bg-purple-400/10 text-purple-400'
                : 'bg-teal-400/10 text-teal-400'
            }`}>
              {isOllama
                ? <><Sparkles className="w-2.5 h-2.5" /> AI-enhanced</>
                : <><Zap className="w-2.5 h-2.5" /> Generated from signals</>
              }
            </span>
            <span className="text-[10px] text-white/30">
              Confidence: {concept.confidenceScore}%
            </span>
          </div>
          <h2 className="text-base font-semibold">{concept.title}</h2>
          <p className="text-sm text-white/50 mt-0.5">{concept.tagline}</p>
        </div>
        <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Hero CTA */}
      <div className="p-4 border-b border-white/5">
        <CopyButton text={concept.claudeCodePrompt} label="Copy Claude Code Prompt" />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Evidence summary */}
        <div className="mb-5 p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
          <div className="text-white/30 mb-2 uppercase tracking-wide text-[10px]">Evidence</div>
          <div className="flex flex-wrap gap-3 mb-2 text-white/60">
            <span>{concept.evidenceSummary.signalCount} signals</span>
            {Object.entries(concept.evidenceSummary.sourceBreakdown).map(([src, n]) => (
              <span key={src}>{src}: {n}</span>
            ))}
          </div>
          {concept.evidenceSummary.topQuotes.slice(0, 3).map((q, i) => (
            <blockquote key={i} className="text-white/40 italic border-l-2 border-white/10 pl-2 mb-1.5 text-[11px]">
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
        {concept.painPoints.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-1.5">
              Recurring Pain Points
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {concept.painPoints.map(({ point, frequency }) => (
                <li key={point} className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/60 border border-white/8">
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
        <Section title="Claude Code Prompt"  content={concept.claudeCodePrompt} copyable />
        <Section title="Implementation Plan" content={concept.implementationPlan} copyable />
      </div>

      {/* Footer actions */}
      <div className="flex gap-2 p-4 border-t border-white/5 flex-wrap">
        <button
          onClick={() => {
            const md = `# ${concept.title}\n\n${concept.tagline}\n\n---\n\n${concept.claudeCodePrompt}\n\n---\n\n${concept.implementationPlan}`
            navigator.clipboard.writeText(md)
          }}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] text-white/50 border border-white/8 hover:bg-white/8 transition-colors"
        >
          Export as Markdown
        </button>
      </div>
    </div>
  )
}
