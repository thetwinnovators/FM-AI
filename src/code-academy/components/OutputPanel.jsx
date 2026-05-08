import { CheckCircle2, XCircle, Eye } from 'lucide-react'
import { buildIframeSrc } from '../validatorEngine.js'

/**
 * Shows the result of running code:
 * - For HTML/CSS: an iframe preview of the rendered page
 * - For all languages: pass/fail badge + reason text
 */
export default function OutputPanel({ language, userCode, validationResult, hasRun }) {
  const showPreview = hasRun && (language === 'html' || language === 'css') && userCode && userCode.trim()

  if (!hasRun && !showPreview) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center py-10">
        <p className="text-sm text-slate-400">Run your code to see output here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* HTML/CSS live preview */}
      {showPreview && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border-b border-slate-200">
            <Eye size={12} className="text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Preview</span>
          </div>
          <iframe
            srcDoc={buildIframeSrc(userCode, language)}
            sandbox="allow-scripts"
            className="w-full border-0"
            style={{ height: '200px', background: '#fff' }}
            title="Code preview"
          />
        </div>
      )}

      {/* Validation result */}
      {validationResult && (
        <div
          className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border ${
            validationResult.passed
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          {validationResult.passed
            ? <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            : <XCircle     size={16} className="text-red-500    flex-shrink-0 mt-0.5" />}
          <p className={`text-sm leading-relaxed ${validationResult.passed ? 'text-emerald-800' : 'text-red-800'}`}>
            {validationResult.reason}
          </p>
        </div>
      )}
    </div>
  )
}
