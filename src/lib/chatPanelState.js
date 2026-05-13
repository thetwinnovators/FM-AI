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
