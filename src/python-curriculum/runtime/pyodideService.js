const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

let _promise = null

function load() {
  if (_promise) return _promise
  _promise = new Promise((resolve, reject) => {
    function init() {
      window.loadPyodide({ indexURL: PYODIDE_CDN }).then(resolve).catch(reject)
    }
    if (window.loadPyodide) { init(); return }
    const s = document.createElement('script')
    s.src = PYODIDE_CDN + 'pyodide.js'
    s.onload  = init
    s.onerror = () => reject(new Error('Could not load Python runtime'))
    document.head.appendChild(s)
  })
  return _promise
}

const STDOUT_INIT = `
import sys
from io import StringIO
_fm_buf = StringIO()
sys.stdout = _fm_buf
sys.stderr = _fm_buf
`

export async function runPython(code) {
  const py = await load()
  py.runPython(STDOUT_INIT)
  try {
    py.runPython(code)
  } catch (e) {
    return { output: null, error: String(e.message || e) }
  }
  const output = py.runPython('_fm_buf.getvalue()').trimEnd()
  return { output, error: null }
}

// Start loading as soon as this module is imported so the runtime is warm
load().catch(() => {})
