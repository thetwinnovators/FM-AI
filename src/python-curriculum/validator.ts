export type ChallengeType = 'code_run' | 'multiple_choice' | 'fill_blank' | 'read_only'

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

// Extracts output from print() calls. Single-pass: tracks integer variable
// assignments so print(var) resolves to the current value.
// Handles: print("string")  print('string')  print(int op int)  print(var)
export function simulateOutput(code: string): string | null {
  const lines      = code.split('\n')
  const results: string[] = []
  const vars: Record<string, number> = {}

  const assignPat  = /^\s*([A-Za-z_]\w*)\s*=\s*(-?\d+)\s*(?:#.*)?$/
  const strPat     = /print\(\s*["']([^"']+)["']\s*\)/
  const mathPat    = /print\(\s*((\d+)\s*[+\-*]\s*(\d+))\s*\)/
  const varPat     = /print\(\s*([A-Za-z_]\w*)\s*\)/

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const assignMatch = trimmed.match(assignPat)
    if (assignMatch) {
      vars[assignMatch[1]] = parseInt(assignMatch[2], 10)
      continue
    }

    const strMatch  = line.match(strPat)
    const mathMatch = line.match(mathPat)
    const varMatch  = line.match(varPat)

    if (strMatch) {
      results.push(strMatch[1])
    } else if (mathMatch) {
      const val = evalIntMath(mathMatch[1])
      if (val !== null) results.push(val)
    } else if (varMatch && varMatch[1] in vars) {
      results.push(String(vars[varMatch[1]]))
    }
  }

  return results.length > 0 ? results.join('\n') : null
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
