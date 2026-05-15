import EvidenceChip from '../EvidenceChip.jsx'

export default function EvidenceTab({ signals, clusters, selectedClusterId }) {
  const relevantSignals = selectedClusterId
    ? (signals ?? []).filter((s) => {
        const cluster = (clusters ?? []).find((c) => c.id === selectedClusterId)
        return cluster?.signalIds?.includes(s.id)
      })
    : (signals ?? [])

  const corpus = relevantSignals.filter((s) => s.source === 'corpus')
  const other  = relevantSignals.filter((s) => s.source !== 'corpus')
  const sorted = [...corpus, ...other].slice(0, 80)

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-[color:var(--color-text-secondary)]">No evidence loaded.</p>
        <p className="text-xs text-[color:var(--color-text-tertiary)] mt-1">
          {selectedClusterId ? 'Select a different opportunity or run a scan.' : 'Run a scan first.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-w-4xl">
      <p className="text-[11px] text-[color:var(--color-text-tertiary)] pb-1">
        {sorted.length} evidence items{selectedClusterId ? ' for selected opportunity' : ''}
      </p>
      {sorted.map((s) => (
        <div key={s.id} className="glass-panel px-4 py-3">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <EvidenceChip
              sourceType={s.corpusSourceType ?? s.source}
              label={s.corpusSourceType ?? s.source}
            />
            <span className="text-[10px] text-[color:var(--color-text-tertiary)] shrink-0">
              {s.detectedAt?.slice(0, 10)}
            </span>
          </div>
          <p className="text-[12px] text-[color:var(--color-text-secondary)] leading-relaxed line-clamp-3">
            {s.painText}
          </p>
          {s.corpusTopicName && (
            <p className="text-[10px] text-[color:var(--color-text-tertiary)] mt-1.5">
              Topic: {s.corpusTopicName}
            </p>
          )}
          {s.sourceUrl && s.sourceUrl !== '' && (
            <a
              href={s.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-fuchsia-400/60 hover:text-fuchsia-400/90 mt-1 block truncate"
            >
              {s.sourceUrl}
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
