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

// Injected when a lesson provides mocks. Replaces sys.modules['requests'] with
// a lightweight fake that returns lesson-defined responses for known URLs.
const MOCK_SETUP = `
import sys as _sys, json as _json
class _FMResponse:
    def __init__(self, sc, d):
        self.status_code = sc
        self._d = d
        self.text = _json.dumps(d) if isinstance(d, (dict, list)) else str(d)
    def json(self):
        return self._d
    def __repr__(self):
        return f'<Response [{self.status_code}]>'
class _FMMockRequests:
    def __init__(self, m): self._m = m
    def _respond(self, url):
        entry = self._m.get(url)
        if entry:
            return _FMResponse(entry.get('status', 200), entry.get('json', {}))
        return _FMResponse(404, {'error': 'URL not available in this lesson environment'})
    def get(self, url, **kw):    return self._respond(url)
    def post(self, url, **kw):   return self._respond(url)
    def put(self, url, **kw):    return self._respond(url)
    def delete(self, url, **kw): return self._respond(url)
_sys.modules['requests'] = _FMMockRequests(_json.loads(_fm_mocks_json))
del _FMResponse, _FMMockRequests
`

// mocks: Record<string, { status?: number; json?: unknown }> | null
export async function runPython(code, mocks = null) {
  const py = await load()
  py.runPython(STDOUT_INIT)
  if (mocks && Object.keys(mocks).length > 0) {
    py.globals.set('_fm_mocks_json', JSON.stringify(mocks))
    py.runPython(MOCK_SETUP)
  }
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
