// Tiny theme manager. Persists to localStorage as 'flowmap.theme'. Apply by
// setting `data-theme="light"|"dark"` on <html>. The pre-paint snippet in
// index.html reads the saved value before React mounts so users don't see a
// flash of the wrong theme on load.

const STORAGE_KEY = 'flowmap.theme'
const VALID = new Set(['light', 'dark'])

export function getTheme() {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved && VALID.has(saved)) return saved
  } catch { /* fall through */ }
  return 'dark' // default
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const next = VALID.has(theme) ? theme : 'dark'
  document.documentElement.setAttribute('data-theme', next)
}

export function setTheme(theme) {
  const next = VALID.has(theme) ? theme : 'dark'
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next)
  } catch { /* ignore */ }
  applyTheme(next)
}
