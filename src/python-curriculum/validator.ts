export type ChallengeType = 'code_run' | 'multiple_choice' | 'fill_blank' | 'read_only'

export interface MockDef {
  status?: number
  json?:   unknown
}

export type MockMap = Record<string, MockDef>

export interface ValidationResult {
  passed:     boolean
  userOutput: string | null
}

// Evaluates "a op b" integer arithmetic without eval.
// Handles + - * only (division excluded — Python returns floats, JS returns ints).
function evalIntMath(expr: string): string | null {
  const m = expr.trim().match(/^(\d+)\s*([+\-*])\s*(\d+)$/)
  if (!m) return null
  const a = parseInt(m[1], 10)
  const b = parseInt(m[3], 10)
  switch (m[2]) {
    case '+': return String(a + b)
    case '-': return String(a - b)
    case '*': return String(a * b)
    default:  return null
  }
}

// Extracts output from print() calls. Single-pass: tracks both integer and
// string variable assignments so print(var) resolves to the current value.
// Handles: print("string")  print(int op int)  print(var)  print(var op int)
export function simulateOutput(code: string): string | null {
  const lines   = code.split('\n')
  const results: string[] = []
  const vars:    Record<string, string>  = {}  // all values stored as strings
  const intVars: Set<string>             = new Set()

  const intAssignPat = /^\s*([A-Za-z_]\w*)\s*=\s*(-?\d+)\s*(?:#.*)?$/
  const strAssignPat = /^\s*([A-Za-z_]\w*)\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/
  const strPat       = /print\(\s*["']([^"']+)["']\s*\)/
  const mathPrintPat = /print\(\s*(\w+)\s*([+\-*])\s*(\w+)\s*\)/
  const varPat       = /print\(\s*([A-Za-z_]\w*)\s*\)/

  function resolveInt(token: string): number | null {
    const t = token.trim()
    if (/^-?\d+$/.test(t)) return parseInt(t, 10)
    if (intVars.has(t)) return parseInt(vars[t], 10)
    return null
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const intAssign = trimmed.match(intAssignPat)
    if (intAssign) {
      vars[intAssign[1]] = intAssign[2]
      intVars.add(intAssign[1])
      continue
    }

    const strAssign = trimmed.match(strAssignPat)
    if (strAssign) {
      vars[strAssign[1]] = strAssign[2]
      continue
    }

    const strMatch = line.match(strPat)
    if (strMatch) { results.push(strMatch[1]); continue }

    const mathMatch = line.match(mathPrintPat)
    if (mathMatch) {
      const a = resolveInt(mathMatch[1])
      const b = resolveInt(mathMatch[3])
      if (a !== null && b !== null) {
        const val = evalIntMath(`${a} ${mathMatch[2]} ${b}`)
        if (val !== null) { results.push(val); continue }
      }
    }

    const varMatch = line.match(varPat)
    if (varMatch && varMatch[1] in vars) {
      results.push(vars[varMatch[1]])
    }
  }

  return results.length > 0 ? results.join('\n') : null
}

// Returns the set of simple variable assignments visible in the code,
// for display in the Try-it editor's variable inspector.
export function extractVars(code: string): Record<string, string> {
  const vars: Record<string, string> = {}
  const intPat = /^\s*([A-Za-z_]\w*)\s*=\s*(-?\d+)\s*(?:#.*)?$/
  const strPat = /^\s*([A-Za-z_]\w*)\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/
  for (const line of code.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const im = t.match(intPat)
    if (im) { vars[im[1]] = im[2]; continue }
    const sm = t.match(strPat)
    if (sm) { vars[sm[1]] = `"${sm[2]}"`; continue }
  }
  return vars
}

export function normalise(s: string): string {
  return s.trim()
}

export function validate(
  userCode: string,
  challenge: { type: ChallengeType; expectedOutput?: string; options?: string[]; correctOption?: number; blankAnswer?: string },
  userInput?: string | number,
): ValidationResult {
  switch (challenge.type) {
    case 'read_only':
      return { passed: true, userOutput: null }

    case 'multiple_choice':
      return {
        passed:     userInput === challenge.correctOption,
        userOutput: userInput != null ? String(userInput) : null,
      }

    case 'fill_blank': {
      const answer   = normalise(String(userInput ?? ''))
      const expected = normalise(challenge.blankAnswer ?? '')
      return { passed: answer === expected, userOutput: answer }
    }

    case 'code_run': {
      const raw      = simulateOutput(userCode)
      const actual   = raw != null ? normalise(raw) : null
      const expected = normalise(challenge.expectedOutput ?? '')
      return { passed: actual === expected, userOutput: actual }
    }

    default:
      return { passed: false, userOutput: null }
  }
}
