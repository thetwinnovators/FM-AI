import { createContext, useCallback, useContext, useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog.jsx'

const ConfirmContext = createContext(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm() must be used inside <ConfirmProvider>')
  return ctx
}

export default function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, props: {} })
  const resolverRef = useRef(null)

  const confirm = useCallback((props = {}) => {
    return new Promise((resolve) => {
      // If a previous confirm is still resolving (rare), reject it as cancel
      // before opening the new one to avoid leaks.
      if (resolverRef.current) resolverRef.current(false)
      resolverRef.current = resolve
      setState({ open: true, props })
    })
  }, [])

  const close = useCallback((value) => {
    setState((s) => ({ ...s, open: false }))
    const r = resolverRef.current
    resolverRef.current = null
    if (r) r(value)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        {...state.props}
        open={state.open}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  )
}
