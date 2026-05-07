const ACTION_LABELS = {
  'save-as-note':           'Save as note',
  'generate-summary':       'Generate summary',
  'generate-content-ideas': 'Content ideas',
}

export default function SuggestedPrompts({ questions, actions, onSend, onAction }) {
  if (!questions || questions.length === 0) return null

  return (
    <div className="flex flex-col gap-2 mt-3 mb-[80px] ml-1 max-w-[75%]">
      {/* Follow-up question chips */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q) => (
          <button
            key={q}
            onClick={() => onSend(q)}
            className="text-[12px] px-3 py-1.5 rounded-full border border-teal-700/30 bg-white text-teal-700
              hover:bg-teal-50 hover:border-teal-600/50 hover:text-teal-800 transition-colors cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Action chips — visually distinct from question chips */}
      {actions && actions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {actions.map((a) => {
            const label = ACTION_LABELS[a]
            if (!label) return null
            return (
              <button
                key={a}
                onClick={() => onAction(a)}
                className="text-[11px] px-3 py-1 rounded-full border border-slate-300
                  bg-white text-slate-600
                  hover:bg-slate-100 hover:border-slate-400 hover:text-slate-800
                  transition-colors cursor-pointer font-medium uppercase tracking-wide"
              >
                {label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
