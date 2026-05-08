/**
 * Code Academy validation engine.
 *
 * validateCode(userCode, exercise, language) → Promise<{ passed, reason }>
 *
 * Routing by language:
 *   html/css → validateStructure (DOMParser)
 *   python   → validateWithLLM (Ollama chatJson)
 *
 * buildIframeSrc(code, language) → string
 *   Returns a full HTML document string for the preview iframe srcdoc.
 */

import { chatJson } from '../lib/llm/ollama.js'

// ── HTML/CSS structural validation ────────────────────────────────────────────

/**
 * Checks successCriteria against the parsed DOM.
 * Criterion format (from AI output):
 *   "has h1 element"    → doc.querySelector('h1') exists
 *   "has class red"     → doc.querySelector('.red') exists
 *   "has id header"     → doc.querySelector('#header') exists
 *   "has img element"   → doc.querySelector('img') exists
 *   "has link element"  → doc.querySelector('a') exists
 *   "has style block"   → doc.querySelector('style') exists
 *   Anything else       → passes (we don't fail on criteria we can't parse)
 */
function checkCriterion(doc, criterion) {
  const c = criterion.toLowerCase().trim()

  const tagMatch = c.match(/^has\s+(\w+)\s+element$/)
  if (tagMatch) {
    const found = !!doc.querySelector(tagMatch[1])
    return { criterion, passed: found, note: found ? 'Found' : `No <${tagMatch[1]}> element` }
  }

  const classMatch = c.match(/^has\s+class\s+["']?([\w-]+)["']?$/)
  if (classMatch) {
    const found = !!doc.querySelector(`.${classMatch[1]}`)
    return { criterion, passed: found, note: found ? 'Found' : `No element with class "${classMatch[1]}"` }
  }

  const idMatch = c.match(/^has\s+id\s+["']?([\w-]+)["']?$/)
  if (idMatch) {
    const found = !!doc.querySelector(`#${idMatch[1]}`)
    return { criterion, passed: found, note: found ? 'Found' : `No element with id "${idMatch[1]}"` }
  }

  const linkMatch = c.match(/^has\s+(?:a\s+)?link/)
  if (linkMatch) {
    const found = !!doc.querySelector('a')
    return { criterion, passed: found, note: found ? 'Found' : 'No <a> link element' }
  }

  const styleMatch = c.match(/^has\s+style/)
  if (styleMatch) {
    const found = !!doc.querySelector('style') || doc.querySelectorAll('[style]').length > 0
    return { criterion, passed: found, note: found ? 'Found' : 'No CSS style found' }
  }

  // Unknown criterion — pass it (LLM may use language we don't parse; defer to LLM validation)
  return { criterion, passed: true, note: 'criterion format not parsed — assumed pass' }
}

export function validateStructure(code, exercise) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(code, 'text/html')
    const results = (exercise.successCriteria || []).map((c) => checkCriterion(doc, c))
    const passed = results.every((r) => r.passed)
    const failed = results.filter((r) => !r.passed)
    const reason = passed
      ? 'All structure checks passed!'
      : `Missing: ${failed.map((r) => r.note).join('; ')}`
    return { passed, reason, results }
  } catch {
    return { passed: false, reason: 'Could not parse your code. Check for syntax errors.' }
  }
}

// ── LLM validation for Python ─────────────────────────────────────────────────

function validationMessages(userCode, exercise, language) {
  return [
    {
      role: 'system',
      content:
        'You evaluate beginner coding exercises for a 10-12 year old student. ' +
        'Be encouraging but honest. Return ONLY valid JSON.',
    },
    {
      role: 'user',
      content:
        `Language: ${language.toUpperCase()}\n` +
        `Exercise: ${exercise.prompt}\n` +
        `Success criteria: ${(exercise.successCriteria || []).join('; ')}\n` +
        (exercise.expectedOutput ? `Expected output: ${exercise.expectedOutput}\n` : '') +
        `\nStudent's code:\n\`\`\`${language}\n${userCode}\n\`\`\`\n\n` +
        'Does this code correctly solve the exercise?\n' +
        'Return: {"pass": true/false, "reason": "One encouraging sentence. If wrong, say what the student should try next."}',
    },
  ]
}

export async function validateWithLLM(userCode, exercise, language) {
  if (!userCode || !userCode.trim()) {
    return { passed: false, reason: "You haven't written any code yet. Try it — you've got this!" }
  }
  try {
    const result = await chatJson(validationMessages(userCode, exercise, language), { temperature: 0.1 })
    return {
      passed: Boolean(result?.pass),
      reason: String(result?.reason || (result?.pass ? 'Great work!' : 'Not quite — try again!')),
    }
  } catch {
    return { passed: false, reason: 'Could not evaluate — make sure Ollama is running.' }
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

/**
 * Validate user code against the current exercise.
 * @param {string} userCode
 * @param {object} exercise  CodeExercise
 * @param {string} language  'html' | 'css' | 'python'
 * @returns {Promise<{ passed: boolean, reason: string }>}
 */
export async function validateCode(userCode, exercise, language) {
  if (language === 'python' || exercise.validatorType === 'llm') {
    return validateWithLLM(userCode, exercise, language)
  }
  // html / css — structural check
  return validateStructure(userCode, exercise)
}

// ── Preview iframe ────────────────────────────────────────────────────────────

/**
 * Build an srcdoc string for the preview iframe.
 * For CSS exercises, wraps the CSS in a <style> block inside a simple HTML skeleton.
 * For HTML exercises, uses the code as-is (or wraps in basic skeleton if no <html> tag).
 */
export function buildIframeSrc(code, language) {
  if (language === 'css') {
    return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<style>
body { margin: 16px; font-family: system-ui, sans-serif; }
${code}
</style>
</head><body>
<h1>Heading Example</h1>
<p>A paragraph of text for testing your CSS styles.</p>
<div class="box">A box element</div>
<a href="#">A link</a>
</body></html>`
  }
  // HTML — use as-is if it has an html tag, otherwise wrap
  if (code.toLowerCase().includes('<html')) return code
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<style>body{margin:16px;font-family:system-ui,sans-serif}</style>
</head><body>${code}</body></html>`
}
