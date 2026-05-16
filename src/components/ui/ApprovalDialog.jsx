import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import { setApprovalHandler } from '../../mcp/services/approvalBridge.js'

const ApprovalContext = createContext({ requestApproval: async () => false })

export function useApproval() { return useContext(ApprovalContext) }

export function ApprovalDialogProvider({ children }) {
  const [pending, setPending] = useState(null)

  const requestApproval = useCallback((req) => {
    return new Promise((resolve) => {
      setPending({
        ...req,
        resolve: (ok) => { setPending(null); resolve(ok) },
      })
    })
  }, [])

  // Register this provider's requestApproval with the singleton so non-React
  // callers (mcpExecutionService) can prompt the user without a hook.
  useEffect(() => {
    setApprovalHandler(requestApproval)
    return () => setApprovalHandler(null)
  }, [requestApproval])

  return (
    <ApprovalContext.Provider value={{ requestApproval }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >{/* Backdrop click intentionally does nothing — use Deny or Approve buttons */}
          <div className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[color:var(--color-bg-panel,#0d0e12)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/25">
                <AlertTriangle size={16} className="text-amber-300" />
              </div>
              <div>
                <h2 className="text-[15px] font-medium text-white/90">Approval required</h2>
                <p className="text-[12px] text-white/50">
                  {pending.riskLevel === 'publish' ? 'Destructive operation' : 'Write operation'}
                  {pending.integrationName ? ` on ${pending.integrationName}` : ''}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-white/8 bg-white/3 p-3 mb-5">
              <div className="text-[11px] uppercase tracking-widest text-white/35 mb-1">Tool</div>
              <div className="text-[13px] font-mono text-white/85 mb-3">{pending.toolName}</div>
              {pending.inputSummary && (
                <>
                  <div className="text-[11px] uppercase tracking-widest text-white/35 mb-1">Input</div>
                  <div className="text-[12px] font-mono text-white/70 whitespace-pre-wrap break-all max-h-40 overflow-auto">{pending.inputSummary}</div>
                </>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => pending.resolve(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-white/70 hover:bg-white/5 transition-colors"
              >
                <X size={14} /> Deny
              </button>
              <button
                onClick={() => pending.resolve(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-[13px] hover:bg-emerald-500/30 transition-colors"
              >
                <Check size={14} /> Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </ApprovalContext.Provider>
  )
}
