// Tiny module-level pub/sub so QuickChatLauncher can broadcast its
// open/mode/sideWidth state to BackToTop (and anything else) without
// needing a React context that would require re-wiring the component tree.

let _listeners = []
let _state = { open: false, mode: 'floating', sideWidth: 480 }

export function getChatPanelState() {
  return _state
}

export function setChatPanelState(patch) {
  _state = { ..._state, ...patch }
  for (const fn of _listeners) fn(_state)
}

export function subscribeChatPanel(fn) {
  _listeners.push(fn)
  return () => {
    _listeners = _listeners.filter((l) => l !== fn)
  }
}

// Dispatch an injected message that QuickChatLauncher will pick up,
// open the panel, and auto-send.
// conceptTarget: optional { conceptId, clusterId, displayName } — when provided,
// the chat panel shows an "Apply to card" banner after the AI responds.
// systemOverride: optional string — when provided, replaces the FlowMap retrieval
// system prompt entirely. Used by Venture Scope (FLOW.AI) to pass its own
// synthesis contract so the model doesn't get two competing instruction sets.
export function openChatWithMessage(text, conceptTarget = null, systemOverride = null) {
  window.dispatchEvent(new CustomEvent('fm-chat-inject', { detail: { message: text, conceptTarget, systemOverride } }))
}
