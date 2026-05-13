# Code Academy — Python Curriculum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured Python learning track (Learn mode) to FlowMap's Code Academy alongside the existing Ollama-powered Generate mode.

**Architecture:** New `src/python-curriculum/` module with static curriculum data, localStorage progress storage, and static challenge validation. `src/views/CodeAcademy.jsx` gains a Learn/Generate tab switcher; the existing `src/code-academy/` module is untouched.

**Tech Stack:** React (JSX), TypeScript (curriculum + storage), Vitest (tests), Tailwind CSS + FlowMap design tokens, localStorage

---

## File Structure

```
src/python-curriculum/
  storage/
    progressStorage.ts
    __tests__/progressStorage.test.ts
  validator.ts
  __tests__/validator.test.ts
  curriculum/
    python.ts
  components/
    PythonCurriculumApp.jsx
    PlaceholderModal.jsx
    LanguagePicker.jsx
    LessonMap.jsx
    SubLessonView.jsx
    ChallengePanel.jsx

src/views/CodeAcademy.jsx   (modify — add Learn/Generate tabs)
```

---

## Static validator constraints (read before writing any curriculum content)

- `code_run` challenges: `simulateOutput` parses `print("literal string")` and `print(integer arithmetic)` only.
- `print(variable)` is **not supported** — any exercise requiring variable output must use `multiple_choice` or `fill_blank`.
- Division (`/`) is excluded from `code_run` — Python returns `5.0`, JS would compute `5`. Use `multiple_choice` for division questions.
- `normalise` = trim whitespace only (case-sensitive — do not lowercase).
- `validate` = exact match after normalise.
- Integer arithmetic in `simulateOutput` is parsed without `eval` — a direct `a op b` parser handles `+`, `-`, `*` only.

---

## Task 1: progressStorage.ts

**Files:**
- Create: `src/python-curriculum/storage/progressStorage.ts`
- Create: `src/python-curriculum/storage/__tests__/progressStorage.test.ts`

- [ ] **Step 1: Write the test first**

```ts
// src/python-curriculum/storage/__tests__/progressStorage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadProgress,
  saveProgress,
  loadAllProgress,
  clearAllProgress,
} from '../progressStorage'

const mockStorage: Record<string, string> = {}
const localStorageMock = {
  getItem:    (k: string) => mockStorage[k] ?? null,
  setItem:    (k: string, v: string) => { mockStorage[k] = v },
  removeItem: (k: string) => { delete mockStorage[k] },
  key:        (i: number) => Object.keys(mockStorage)[i] ?? null,
  get length() { return Object.keys(mockStorage).length },
  clear:      () => { for (const k in mockStorage) delete mockStorage[k] },
}
vi.stubGlobal('localStorage', localStorageMock)

beforeEach(() => localStorageMock.clear())

describe('loadProgress', () => {
  it('returns defaults for unknown id', () => {
    const p = loadProgress('foo')
    expect(p).toEqual({
      subLessonId: 'foo',
      viewed:      false,
      practiced:   false,
      completed:   false,
      skipped:     false,
      lastOpenedAt: '',
    })
  })
  it('returns saved values', () => {
    saveProgress('bar', { viewed: true })
    expect(loadProgress('bar').viewed).toBe(true)
  })
})

describe('saveProgress', () => {
  it('merges partial into existing', () => {
    saveProgress('x', { viewed: true })
    saveProgress('x', { completed: true })
    const p = loadProgress('x')
    expect(p.viewed).toBe(true)
    expect(p.completed).toBe(true)
  })
  it('writes ISO timestamp', () => {
    saveProgress('ts', { viewed: true })
    expect(loadProgress('ts').lastOpenedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('loadAllProgress', () => {
  it('returns all fm_pyca_ entries', () => {
    saveProgress('a', { viewed: true })
    saveProgress('b', { completed: true })
    const all = loadAllProgress()
    expect(Object.keys(all)).toHaveLength(2)
    expect(all['a'].viewed).toBe(true)
  })
})

describe('clearAllProgress', () => {
  it('removes all fm_pyca_ keys', () => {
    saveProgress('a', { viewed: true })
    saveProgress('b', { viewed: true })
    clearAllProgress()
    expect(Object.keys(loadAllProgress())).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — confirm it fails**

```
npx vitest run src/python-curriculum
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/python-curriculum/storage/progressStorage.ts
export interface SubLessonProgress {
  subLessonId:  string
  viewed:       boolean
  practiced:    boolean
  completed:    boolean
  skipped:      boolean
  lastOpenedAt: string
}

const PREFIX = 'fm_pyca_'

function defaults(id: string): SubLessonProgress {
  return { subLessonId: id, viewed: false, practiced: false, completed: false, skipped: false, lastOpenedAt: '' }
}

export function loadProgress(id: string): SubLessonProgress {
  try {
    const raw = localStorage.getItem(PREFIX + id)
    return raw ? { ...defaults(id), ...JSON.parse(raw) } : defaults(id)
  } catch {
    return defaults(id)
  }
}

export function saveProgress(id: string, partial: Partial<SubLessonProgress>): void {
  const current = loadProgress(id)
  const updated  = { ...current, ...partial, subLessonId: id, lastOpenedAt: new Date().toISOString() }
  localStorage.setItem(PREFIX + id, JSON.stringify(updated))
}

export function loadAllProgress(): Record<string, SubLessonProgress> {
  const result: Record<string, SubLessonProgress> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) {
      const id = key.slice(PREFIX.length)
      result[id] = loadProgress(id)
    }
  }
  return result
}

export function clearAllProgress(): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) toRemove.push(key)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
}
```

- [ ] **Step 4: Run — confirm passing**

```
npx vitest run src/python-curriculum
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```
git add src/python-curriculum/storage/progressStorage.ts src/python-curriculum/storage/__tests__/progressStorage.test.ts
git commit -m "feat(python-curriculum): add progress storage with localStorage CRUD"
```

---

## Task 2: validator.ts

**Files:**
- Create: `src/python-curriculum/validator.ts`
- Create: `src/python-curriculum/__tests__/validator.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/python-curriculum/__tests__/validator.test.ts
import { describe, it, expect } from 'vitest'
import { simulateOutput, normalise, validate } from '../validator'

describe('simulateOutput', () => {
  it('extracts a double-quoted string', () => {
    expect(simulateOutput('print("Hello, World!")')).toBe('Hello, World!')
  })
  it('extracts a single-quoted string', () => {
    expect(simulateOutput("print('Hi there')")).toBe('Hi there')
  })
  it('evaluates integer addition', () => {
    expect(simulateOutput('print(5 + 2)')).toBe('7')
  })
  it('evaluates integer subtraction', () => {
    expect(simulateOutput('print(10 - 3)')).toBe('7')
  })
  it('evaluates integer multiplication', () => {
    expect(simulateOutput('print(3 * 4)')).toBe('12')
  })
  it('joins multiple print calls with newline', () => {
    expect(simulateOutput('print("a")\nprint("b")')).toBe('a\nb')
  })
  it('returns null when no print found', () => {
    expect(simulateOutput('x = 5')).toBeNull()
  })
  it('does not match print(variable)', () => {
    expect(simulateOutput('x = 5\nprint(x)')).toBeNull()
  })
})

describe('normalise', () => {
  it('trims leading/trailing whitespace', () => {
    expect(normalise('  hello  ')).toBe('hello')
  })
  it('preserves internal whitespace', () => {
    expect(normalise('hello world')).toBe('hello world')
  })
  it('preserves case', () => {
    expect(normalise('Hello')).toBe('Hello')
  })
})

describe('validate — code_run', () => {
  const challenge = { type: 'code_run' as const, expectedOutput: 'Hello, World!' }

  it('passes when output matches', () => {
    const r = validate('print("Hello, World!")', challenge)
    expect(r.passed).toBe(true)
  })
  it('fails when output differs', () => {
    const r = validate('print("hello, world!")', challenge)
    expect(r.passed).toBe(false)
    expect(r.userOutput).toBe('hello, world!')
  })
  it('fails when no print found', () => {
    const r = validate('x = 5', challenge)
    expect(r.passed).toBe(false)
    expect(r.userOutput).toBeNull()
  })
})

describe('validate — multiple_choice', () => {
  const challenge = { type: 'multiple_choice' as const, options: ['a', 'b', 'c'], correctOption: 1 }
  it('passes when correct index selected', () => {
    expect(validate('', challenge, 1).passed).toBe(true)
  })
  it('fails when wrong index', () => {
    expect(validate('', challenge, 0).passed).toBe(false)
  })
})

describe('validate — fill_blank', () => {
  const challenge = { type: 'fill_blank' as const, blankAnswer: 'print' }
  it('passes on exact normalised match', () => {
    expect(validate('', challenge, '  print  ').passed).toBe(true)
  })
  it('fails on wrong answer', () => {
    expect(validate('', challenge, 'input').passed).toBe(false)
  })
})

describe('validate — read_only', () => {
  it('always passes', () => {
    expect(validate('', { type: 'read_only' as const }).passed).toBe(true)
  })
})
```

- [ ] **Step 2: Run — confirm fails**

```
npx vitest run src/python-curriculum
```

- [ ] **Step 3: Implement**

```ts
// src/python-curriculum/validator.ts
export type ChallengeType = 'code_run' | 'multiple_choice' | 'fill_blank' | 'read_only'

export interface ValidationResult {
  passed:     boolean
  userOutput: string | null
}

// Evaluates "a op b" integer arithmetic without eval.
// Handles + - * only (division excluded by design — Python returns floats).
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

// Extracts output from print() calls. Handles:
//   print("string")  print('string')  print(int op int)
// Does NOT handle print(variable) — returns null if only variable prints found.
export function simulateOutput(code: string): string | null {
  const lines   = code.split('\n')
  const results: string[] = []
  const strPat  = /print\(\s*["']([^"']+)["']\s*\)/
  const mathPat = /print\(\s*((\d+)\s*[+\-*]\s*(\d+))\s*\)/

  for (const line of lines) {
    const strMatch  = line.match(strPat)
    const mathMatch = line.match(mathPat)
    if (strMatch) {
      results.push(strMatch[1])
    } else if (mathMatch) {
      const val = evalIntMath(mathMatch[1])
      if (val !== null) results.push(val)
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
```

- [ ] **Step 4: Run — confirm passing**

```
npx vitest run src/python-curriculum
```

- [ ] **Step 5: Commit**

```
git add src/python-curriculum/validator.ts src/python-curriculum/__tests__/validator.test.ts
git commit -m "feat(python-curriculum): add static challenge validator"
```

---

## Task 3: python.ts — Types + Group 1 (Introduction) + Group 2 (Variables)

**File:** `src/python-curriculum/curriculum/python.ts`

This file is built across Tasks 3–7. In this task: write the TypeScript interfaces and the first two lesson groups with full sub-lesson content.

- [ ] **Step 1: Create the file with interfaces and Groups 1–2**

```ts
// src/python-curriculum/curriculum/python.ts

export interface SubLessonChallenge {
  type:            'code_run' | 'multiple_choice' | 'fill_blank' | 'read_only'
  prompt:          string
  starterCode?:    string
  expectedOutput?: string
  options?:        string[]
  correctOption?:  number
  blankAnswer?:    string
  hints:           string[]
  solution:        string
}

export interface SubLesson {
  id:               string
  title:            string
  slug:             string
  tldr:             string
  searchableTerms:  string[]
  explanation:      string[]
  example: {
    code:    string
    output?: string
  }
  challenge:          SubLessonChallenge
  recommendedAfter?:  string
}

export interface LessonGroup {
  id:         string
  title:      string
  subLessons: SubLesson[]
}

export const PYTHON_CURRICULUM: LessonGroup[] = [

  // ── Group 1: Introduction ────────────────────────────────────────────────
  {
    id: 'introduction',
    title: 'Introduction',
    subLessons: [
      {
        id: 'what-is-python',
        title: 'What Is Python?',
        slug: 'what-is-python',
        tldr: 'Python is a beginner-friendly programming language used for websites, games, science, and AI.',
        searchableTerms: ['python', 'programming language', 'beginner', 'what is python', 'overview'],
        explanation: [
          'Python is a programming language — a special language you use to give instructions to a computer. Just like English has grammar rules, Python has its own rules for writing instructions the computer can understand.',
          'Python was created in 1991 by a programmer named Guido van Rossum. He wanted a language that was easy to read and write, almost like writing plain English. Today Python is used everywhere: YouTube, Instagram, NASA, and even robots use it.',
        ],
        example: {
          code: `# This is a Python program
# The # symbol starts a comment — Python ignores it

print("Hello! I am learning Python.")
print("Python is fun.")`,
          output: 'Hello! I am learning Python.\nPython is fun.',
        },
        challenge: {
          type: 'multiple_choice',
          prompt: 'Who created Python?',
          options: ['Linus Torvalds', 'Guido van Rossum', 'Bill Gates', 'Ada Lovelace'],
          correctOption: 1,
          hints: [
            'The creator\'s name is mentioned in the explanation above.',
            'His first name starts with the letter G.',
          ],
          solution: 'Guido van Rossum created Python in 1991.',
        },
      },
      {
        id: 'first-program',
        title: 'Your First Program',
        slug: 'first-program',
        tldr: 'print() is the command that makes Python display text on the screen.',
        searchableTerms: ['print', 'hello world', 'first program', 'output', 'display text'],
        explanation: [
          'Every programmer writes a "Hello, World!" program as their very first step. It\'s a tradition! The program just prints those words on the screen to prove the code is working.',
          'In Python, the word print is a built-in command. When you type print("something"), Python shows that something on the screen. The text you want to display goes inside the brackets, wrapped in quote marks.',
        ],
        example: {
          code: `# Your very first Python program
print("Hello, World!")`,
          output: 'Hello, World!',
        },
        challenge: {
          type: 'code_run',
          prompt: 'Write a program that prints exactly: Hello, World!',
          starterCode: '# Write your print statement below\n',
          expectedOutput: 'Hello, World!',
          hints: [
            'Use the print() command with the text inside quote marks.',
            'Type exactly: print("Hello, World!") — capital H, capital W, comma, and exclamation mark.',
          ],
          solution: 'print("Hello, World!")',
        },
      },
      {
        id: 'running-python',
        title: 'How Python Runs',
        slug: 'running-python',
        tldr: 'Python reads your code line by line, from top to bottom, running each instruction in order.',
        searchableTerms: ['run', 'execute', 'interpreter', 'line by line', 'order', 'top to bottom'],
        explanation: [
          'When you run a Python program, Python starts at the very first line and reads downward — like reading a book. It runs each line one at a time, in order.',
          'This is called an interpreter. It reads one instruction, does it, then moves to the next. If your code has five print statements, they will appear on screen one after another in the same order you wrote them.',
        ],
        example: {
          code: `# Python runs these in order, top to bottom
print("Line 1")
print("Line 2")
print("Line 3")`,
          output: 'Line 1\nLine 2\nLine 3',
        },
        challenge: {
          type: 'multiple_choice',
          prompt: 'If you have print("A") on line 1 and print("B") on line 2, what appears first?',
          options: ['B', 'A', 'They appear at the same time', 'Nothing appears'],
          correctOption: 1,
          hints: [
            'Python reads from top to bottom.',
            'Line 1 runs before line 2.',
          ],
          solution: 'A appears first. Python runs line 1 before line 2.',
        },
      },
      {
        id: 'comments',
        title: 'Comments',
        slug: 'comments',
        tldr: 'A comment starts with # and is ignored by Python — it\'s a note for the humans reading the code.',
        searchableTerms: ['comment', 'hash', '#', 'ignore', 'note', 'documentation'],
        explanation: [
          'A comment is a line in your code that Python completely ignores. You start a comment with the # symbol. Everything after # on that line is skipped when Python runs the program.',
          'Comments are for humans, not computers. You write comments to explain what your code is doing, so you (or a friend) can understand it later.',
        ],
        example: {
          code: `# This comment is ignored by Python
print("This line runs")  # End-of-line comment — also ignored
# print("This will NOT run — it is commented out")
print("Only the print lines run")`,
          output: 'This line runs\nOnly the print lines run',
        },
        challenge: {
          type: 'fill_blank',
          prompt: 'To write a comment in Python, you start the line with the _____ symbol.',
          blankAnswer: '#',
          hints: [
            'It is a punctuation symbol on your keyboard.',
            'It is sometimes called "hash" or "pound".',
          ],
          solution: 'You start a comment with the # symbol.',
        },
      },
      {
        id: 'print-function',
        title: 'The print() Function',
        slug: 'print-function',
        tldr: 'print() can display text, numbers, and multiple items separated by commas.',
        searchableTerms: ['print', 'function', 'output', 'text', 'multiple items', 'comma'],
        explanation: [
          'The print() function is the most common way to show output in Python. You can print text, numbers, or multiple things at once by separating them with commas.',
          'When you separate items with commas, Python automatically puts a space between them. So print("Hello", "World") shows Hello World — with a space added for you.',
        ],
        example: {
          code: `# Printing text (a string)
print("Hello, World!")

# Printing a number
print(42)

# Printing multiple things — Python adds spaces between them
print("I am", 12, "years old")`,
          output: 'Hello, World!\n42\nI am 12 years old',
        },
        challenge: {
          type: 'code_run',
          prompt: 'Write a program that prints exactly: Python is awesome!',
          starterCode: '',
          expectedOutput: 'Python is awesome!',
          hints: [
            'Use print() with your text inside quote marks.',
            'Check the capital P and the exclamation mark at the end.',
          ],
          solution: 'print("Python is awesome!")',
        },
      },
    ],
  },

  // ── Group 2: Variables ────────────────────────────────────────────────────
  {
    id: 'variables',
    title: 'Variables',
    subLessons: [
      {
        id: 'what-is-a-variable',
        title: 'What Is a Variable?',
        slug: 'what-is-a-variable',
        tldr: 'A variable is a named container that stores a value so you can use it later.',
        searchableTerms: ['variable', 'store', 'container', 'value', 'name', 'memory'],
        explanation: [
          'A variable is like a labelled box. You put a value inside the box and give it a name. Later, whenever you need that value, you just use the name instead of writing the value again.',
          'In Python, you create a variable by writing a name, then an equals sign, then the value: age = 12. The equals sign means "store this value in this variable" — it does NOT mean "these two things are equal."',
        ],
        example: {
          code: `# Create variables and store values in them
name = "Alice"
age  = 12

# Use the variables inside print
print("My name is", name)
print("I am", age, "years old")`,
          output: 'My name is Alice\nI am 12 years old',
        },
        challenge: {
          type: 'multiple_choice',
          prompt: 'What does the = sign do when you write: score = 100',
          options: [
            'It checks if score and 100 are equal',
            'It stores the value 100 in a variable called score',
            'It prints the number 100',
            'It creates a new number',
          ],
          correctOption: 1,
          hints: [
            'The = sign in Python is about storing, not checking equality.',
            'Think of = as an arrow pointing left: "put 100 into score".',
          ],
          solution: 'The = sign stores the value 100 in a variable called score.',
        },
      },
      {
        id: 'naming-variables',
        title: 'Naming Variables',
        slug: 'naming-variables',
        tldr: 'Variable names must start with a letter or underscore and use only letters, numbers, and underscores.',
        searchableTerms: ['variable name', 'naming rules', 'underscore', 'snake case', 'case-sensitive'],
        recommendedAfter: 'what-is-a-variable',
        explanation: [
          'Variable names in Python follow rules. A name can contain letters (a–z, A–Z), numbers (0–9), and underscores (_). It must start with a letter or underscore — never a number. Names are case-sensitive: age and Age are two different variables.',
          'Python programmers use a style called snake_case for variable names — all lowercase with underscores between words. So instead of myVariableName, you write my_variable_name.',
        ],
        example: {
          code: `# Valid snake_case variable names
first_name   = "Alice"
age_in_years = 12
score1       = 100

# Python is case-sensitive — these are two different variables
score  = 50
Score  = 99

print(first_name)
print(score)`,
          output: 'Alice\n50',
        },
        challenge: {
          type: 'multiple_choice',
          prompt: 'Which of these is a valid Python variable name?',
          options: ['1score', 'my score', 'my_score', 'my-score'],
          correctOption: 2,
          hints: [
            'Names cannot start with a number, contain spaces, or use hyphens.',
            'Only letters, numbers, and underscores are allowed.',
          ],
          solution: 'my_score is the only valid name. 1score starts with a number, "my score" has a space, my-score uses a hyphen.',
        },
      },
      {
        id: 'changing-variables',
        title: 'Changing Variables',
        slug: 'changing-variables',
        tldr: 'You can change a variable\'s value at any time — the old value is replaced with the new one.',
        searchableTerms: ['reassign', 'update', 'change variable', 'overwrite', 'new value'],
        recommendedAfter: 'what-is-a-variable',
        explanation: [
          'Variables are called "variable" because they can vary — they can change! After you create a variable, you can give it a new value at any time by assigning again.',
          'When you change a variable, the old value is gone. Python only keeps the most recent value. Think of it like erasing what is on a sticky note and writing something new.',
        ],
        example: {
          code: `score = 0
print("Start:", score)

score = 10
print("After first round:", score)

score = 25
print("Final score:", score)`,
          output: 'Start: 0\nAfter first round: 10\nFinal score: 25',
        },
        challenge: {
          type: 'multiple_choice',
          prompt: 'What does this code print?\n\nx = 5\nx = 10\nprint(x)',
          options: ['5', '10', '5 10', 'Error'],
          correctOption: 1,
          hints: [
            'When you assign a new value, the old value is replaced.',
            'x is changed to 10 before print(x) runs.',
          ],
          solution: 'The program prints 10. The second line replaces 5 with 10.',
        },
      },
      {
        id: 'multiple-variables',
        title: 'Multiple Variables',
        slug: 'multiple-variables',
        tldr: 'A program can have as many variables as you need — each has its own name and value.',
        searchableTerms: ['multiple variables', 'several', 'combine', 'together', 'many variables'],
        recommendedAfter: 'what-is-a-variable',
        explanation: [
          'A program can have as many variables as you need. Each variable has its own name and stores its own value independently.',
          'You can use number variables in arithmetic. Python substitutes the value stored in the variable before doing the calculation.',
        ],
        example: {
          code: `first_name = "Alice"
last_name  = "Smith"
age        = 12

print("Name:", first_name, last_name)
print("Age:", age)`,
          output: 'Name: Alice Smith\nAge: 12',
        },
        challenge: {
          type: 'multiple_choice',
          prompt: 'If a = 3 and b = 7, what does print(a + b) display?',
          options: ['37', 'a + b', '10', 'Error'],
          correctOption: 2,
          hints: [
            'Python replaces variable names with their stored values before doing maths.',
            'a is 3 and b is 7, so a + b = 3 + 7.',
          ],
          solution: 'print(a + b) displays 10 because a is 3 and b is 7.',
        },
      },
      {
        id: 'constants',
        title: 'Constants',
        slug: 'constants',
        tldr: 'A constant is a variable whose value you never plan to change — Python programmers write them in ALL_CAPS.',
        searchableTerms: ['constant', 'ALL_CAPS', 'convention', 'fixed value', 'uppercase', 'final'],
        recommendedAfter: 'naming-variables',
        explanation: [
          'Sometimes you have a value that should never change in your program — like the number of seconds in a minute, or a player\'s maximum health. These are called constants.',
          'Python doesn\'t stop you from changing a constant, but there is a convention: write constant names in ALL_CAPS with underscores. MAX_SCORE = 100 tells any reader "this value is not meant to change."',
        ],
        example: {
          code: `# Constants are written in ALL_CAPS by convention
MAX_HEALTH  = 100
PLAYER_NAME = "Hero"

print("Player:", PLAYER_NAME)
print("Max health:", MAX_HEALTH)`,
          output: 'Player: Hero\nMax health: 100',
        },
        challenge: {
          type: 'fill_blank',
          prompt: 'In Python, constant names are written in _____ (e.g. MAX_SCORE, GRAVITY).',
          blankAnswer: 'ALL_CAPS',
          hints: [
            'Think about how the letters look — are they big or small?',
            'It is the opposite of lowercase.',
          ],
          solution: 'Constants are written in ALL_CAPS.',
        },
      },
    ],
  },
]
```

- [ ] **Step 2: Commit**

```
git add src/python-curriculum/curriculum/python.ts
git commit -m "feat(python-curriculum): add curriculum types + Introduction + Variables groups"
```

---

## Task 4: python.ts — Groups 3–5 (Data Types, Strings, Numbers)

**File:** `src/python-curriculum/curriculum/python.ts` — append to `PYTHON_CURRICULUM` array before the closing `]`.

- [ ] **Step 1: Append Groups 3–5**

Each group below lists every sub-lesson. Write each one following the exact SubLesson structure from Task 3. All fields must be filled — no placeholder text.

**Group 3: Data Types**

```ts
{
  id: 'data-types',
  title: 'Data Types',
  subLessons: [
    {
      id: 'integers',
      title: 'Integers',
      slug: 'integers',
      tldr: 'An integer is a whole number — positive, negative, or zero — with no decimal point.',
      searchableTerms: ['integer', 'int', 'whole number', 'positive', 'negative', 'zero', 'data type'],
      explanation: [
        'An integer is a whole number — a number with no decimal point. Examples: 5, -3, 0, 100. In Python, when you write a number without a decimal point, Python calls it an int.',
        'You can do addition, subtraction, and multiplication with integers and always get another integer back.',
      ],
      example: {
        code: `apples      = 5
temperature = -3
population  = 1000000

print(apples)
print(temperature)`,
        output: '5\n-3',
      },
      challenge: {
        type: 'multiple_choice',
        prompt: 'Which of these is an integer?',
        options: ['3.14', '"hello"', '42', 'True'],
        correctOption: 2,
        hints: [
          'An integer is a whole number — no decimal point.',
          '3.14 is a float, "hello" is a string, True is a boolean.',
        ],
        solution: '42 is an integer — a whole number with no decimal point.',
      },
    },
    {
      id: 'floats',
      title: 'Floats',
      slug: 'floats',
      tldr: 'A float is a number with a decimal point, like 3.14 or -0.5.',
      searchableTerms: ['float', 'decimal', 'floating point', '3.14', 'real number'],
      explanation: [
        'A float is a number that has a decimal point. Examples: 3.14, 0.5, -9.99. Python uses floats whenever a number needs a fractional part.',
        'When you divide two integers in Python, the result is always a float even if the answer is a whole number. For example, 10 / 2 gives 5.0, not 5.',
      ],
      example: {
        code: `pi      = 3.14159
price   = 9.99
gravity = -9.8

print(pi)
print(price)`,
        output: '3.14159\n9.99',
      },
      challenge: {
        type: 'multiple_choice',
        prompt: 'Which of these is a float?',
        options: ['100', '"3.14"', '3.14', 'True'],
        correctOption: 2,
        hints: [
          'A float has a decimal point.',
          '"3.14" is a string (it has quote marks), 100 is an integer.',
        ],
        solution: '3.14 is a float — it has a decimal point.',
      },
    },
    {
      id: 'strings-intro',
      title: 'Strings',
      slug: 'strings-intro',
      tldr: 'A string is a piece of text wrapped in quote marks — single or double quotes both work.',
      searchableTerms: ['string', 'str', 'text', 'quotes', 'single quote', 'double quote'],
      explanation: [
        'A string is any piece of text. In Python, you wrap strings in quote marks — either single quotes or double quotes. Both work the same way.',
        'Strings can hold letters, numbers, spaces, symbols — anything you can type. But if you wrap 42 in quotes ("42"), it becomes text, not a number. Python cannot do maths with it.',
      ],
      example: {
        code: `# Both single and double quotes create strings
greeting = "Hello, World!"
name     = 'Alice'
mixed    = "I have 3 cats"

print(greeting)
print(name)`,
        output: 'Hello, World!\nAlice',
      },
      challenge: {
        type: 'fill_blank',
        prompt: 'In Python, a string is any piece of text wrapped in _____.',
        blankAnswer: 'quote marks',
        hints: [
          'Think about what surrounds the text in print("Hello").',
          'They can be single or double.',
        ],
        solution: 'Strings are wrapped in quote marks (single or double).',
      },
    },
    {
      id: 'booleans',
      title: 'Booleans',
      slug: 'booleans',
      tldr: 'A boolean is either True or False — Python\'s way of representing yes/no answers.',
      searchableTerms: ['boolean', 'bool', 'True', 'False', 'yes no', 'condition', 'logic'],
      explanation: [
        'A boolean is the simplest data type — it is either True or False. Nothing else. In Python, True and False are written with a capital first letter.',
        'Booleans are most useful when making decisions. When you compare two values (is 5 greater than 3?), Python gives you back True or False.',
      ],
      example: {
        code: `is_raining = True
has_umbrella = False

print(is_raining)
print(has_umbrella)
print(5 > 3)   # Comparison — is 5 greater than 3?
print(2 > 10)  # Is 2 greater than 10?`,
        output: 'True\nFalse\nTrue\nFalse',
      },
      challenge: {
        type: 'multiple_choice',
        prompt: 'In Python, how do you write a boolean True value?',
        options: ['true', 'TRUE', 'True', '"True"'],
        correctOption: 2,
        hints: [
          'Python is case-sensitive.',
          'Only the first letter is capitalised.',
        ],
        solution: 'True — Python booleans are written with a capital T or F. "True" (with quotes) is a string, not a boolean.',
      },
    },
  ],
},
```

**Group 4: Strings**

```ts
{
  id: 'strings',
  title: 'Strings',
  subLessons: [
    {
      id: 'string-basics',
      title: 'String Basics',
      slug: 'string-basics',
      tldr: 'Strings are sequences of characters you can store, print, and combine.',
      searchableTerms: ['string', 'text', 'character', 'print string', 'string variable'],
      explanation: [
        'You already know that a string is text wrapped in quotes. Now let\'s practice storing strings in variables and printing them.',
        'You can put any characters inside a string — letters, numbers, punctuation, spaces. The quote marks are just delimiters; they tell Python where the string starts and ends.',
      ],
      example: {
        code: `language = "Python"
version  = "3"
message  = "I love coding!"

print(language)
print(message)`,
        output: 'Python\nI love coding!',
      },
      challenge: {
        type: 'code_run',
        prompt: 'Write a program that prints exactly: I love Python!',
        starterCode: '',
        expectedOutput: 'I love Python!',
        hints: [
          'Use print() with the text inside quote marks.',
          'Make sure the capitalisation and punctuation match exactly.',
        ],
        solution: 'print("I love Python!")',
      },
    },
    {
      id: 'string-concatenation',
      title: 'Joining Strings',
      slug: 'string-concatenation',
      tldr: 'You join (concatenate) strings using the + operator.',
      searchableTerms: ['concatenate', 'join', 'combine strings', '+', 'string addition'],
      recommendedAfter: 'string-basics',
      explanation: [
        'You can join two strings together using the + operator. This is called concatenation. "Hello" + " World" gives you "Hello World".',
        'Note that + does not add a space automatically between strings. You must include any space you want inside one of the strings.',
      ],
      example: {
        code: `first = "Hello"
second = " World"

# Joining two strings
result = first + second
print(result)

# Joining with a space in the middle
print("Good" + " " + "morning")`,
        output: 'Hello World\nGood morning',
      },
      challenge: {
        type: 'fill_blank',
        prompt: 'To join two strings in Python, you use the _____ operator.',
        blankAnswer: '+',
        hints: [
          'It\'s the same symbol used for addition.',
          'With strings it means "attach", not "calculate".',
        ],
        solution: 'You use the + operator to concatenate strings.',
      },
    },
    {
      id: 'string-length',
      title: 'String Length',
      slug: 'string-length',
      tldr: 'len() tells you how many characters are in a string, including spaces.',
      searchableTerms: ['len', 'length', 'count characters', 'string size', 'how many'],
      recommendedAfter: 'string-basics',
      explanation: [
        'The len() function returns the number of characters in a string. Every character counts — letters, spaces, numbers, and punctuation all add 1 to the length.',
        'len("hello") returns 5 because there are 5 characters. len("hi there") returns 8 — the space counts too.',
      ],
      example: {
        code: `word    = "Python"
sentence = "Hello, World!"

print(len(word))
print(len(sentence))`,
        output: '6\n13',
      },
      challenge: {
        type: 'multiple_choice',
        prompt: 'What does len("cat") return?',
        options: ['2', '3', '4', '"cat"'],
        correctOption: 1,
        hints: [
          'Count the letters in "cat".',
          'c-a-t is three letters.',
        ],
        solution: 'len("cat") returns 3 because "cat" has three characters.',
      },
    },
    {
      id: 'string-methods',
      title: 'String Methods',
      slug: 'string-methods',
      tldr: 'String methods like .upper(), .lower(), and .strip() transform a string without changing the original.',
      searchableTerms: ['method', 'upper', 'lower', 'strip', 'replace', 'string method', 'dot notation'],
      recommendedAfter: 'string-basics',
      explanation: [
        'A method is a built-in action that a string can perform. You call it by putting a dot after the string (or variable) and then the method name. For example: "hello".upper() gives you "HELLO".',
        'String methods return a new string — they do not change the original. Common ones: .upper() → all capitals, .lower() → all lowercase, .strip() → removes extra spaces from both ends.',
      ],
      example: {
        code: `message = "  Hello, World!  "

print(message.upper())
print(message.lower())
print(message.strip())`,
        output: '  HELLO, WORLD!  \n  hello, world!  \nHello, World!',
      },
      challenge: {
        type: 'multiple_choice',
        prompt: 'What does "Python".upper() return?',
        options: ['python', 'PYTHON', 'Python', '"PYTHON"'],
        correctOption: 1,
        hints: [
          '.upper() converts all letters to capitals.',
          'The result is a string — no quote marks in the output.',
        ],
        solution: '"Python".upper() returns PYTHON — every letter becomes uppercase.',
      },
    },
    {
      id: 'string-slicing',
      title: 'String Slicing',
      slug: 'string-slicing',
      tldr: 'String slicing lets you extract part of a string using [start:end] notation — indexing starts at 0.',
      searchableTerms: ['slice', 'index', 'substring', 'character access', 'start end', 'bracket notation'],
      recommendedAfter: 'string-basics',
      explanation: [
        'You can pick out individual characters or sections of a string using square brackets and index numbers. The first character is at index 0, the second at index 1, and so on.',
        '"hello"[0] gives "h". "hello"[1:4] gives "ell" — it takes characters from index 1 up to (but not including) index 4.',
      ],
      example: {
        code: `word = "Python"

print(word[0])    # First character
print(word[1])    # Second character
print(word[0:3])  # Characters at index 0, 1, 2
print(word[-1])   # Last character`,
        output: 'P\ny\nPyt\nn',
      },
      challenge: {
        type: 'multiple_choice',
        prompt: 'What does "hello"[1] return?',
        options: ['h', 'e', 'l', 'hello'],
        correctOption: 1,
        hints: [
          'Indexing starts at 0, not 1.',
          'Index 0 is "h", index 1 is "e".',
        ],
        solution: '"hello"[1] returns "e" — indexing starts at 0, so index 1 is the second character.',
      },
    },
  ],
},
```

**Group 5: Numbers**

```ts
{
  id: 'numbers',
  title: 'Numbers',
  subLessons: [
    {
      id: 'arithmetic-operators',
      title: 'Arithmetic Operators',
      slug: 'arithmetic-operators',
      tldr: 'Python uses +, -, and * for addition, subtraction, and multiplication.',
      searchableTerms: ['arithmetic', 'operator', 'add', 'subtract', 'multiply', '+', '-', '*'],
      explanation: [
        'Python supports all the basic arithmetic you already know. The operators are: + for addition, - for subtraction, * for multiplication.',
        'You can use these operators directly in print() to calculate and display a result in one step.',
      ],
      example: {
        code: `# Basic arithmetic
print(10 + 5)
print(10 - 3)
print(4 * 6)

# Arithmetic with parentheses
print(2 + 3 * 4)    # Multiplication first: 2 + 12
print((2 + 3) * 4)  # Parentheses first: 5 * 4`,
        output: '15\n7\n24\n14\n20',
      },
      challenge: {
        type: 'code_run',
        prompt: 'Write a program that prints the result of 8 * 3.',
        starterCode: '',
        expectedOutput: '24',
        hints: [
          'Use print() with the calculation inside the brackets.',
          'print(8 * 3) will calculate 8 times 3 and print the result.',
        ],
        solution: 'print(8 * 3)',
      },
    },
    {
      id: 'integer-division',
      title: 'Division',
      slug: 'integer-division',
      tldr: '/ always returns a float; // returns only the whole number part (integer division).',
      searchableTerms: ['division', '/', '//', 'floor division', 'float', 'integer division'],
      recommendedAfter: 'arithmetic-operators',
      explanation: [
        'In Python, the / operator always gives you a float (decimal number) even when the answer is a whole number. So 10 / 2 gives 5.0, not 5.',
        'If you want the integer part only (no decimal), use // (double slash). 10 // 3 gives 3 — the remainder is thrown away. This is called floor division.',
      ],
      example: {
        code: `# Regular division — always gives a float
print(10 / 2)   # 5.0
print(7 / 2)    # 3.5

# Floor division — gives only the whole number
print(10 // 3)  # 3 (remainder discarded)
print(7 // 2)   # 3`,
        output: '5.0\n3.5\n3\n3',
      },
      challenge: {
        type: 'multiple_choice',
        prompt: 'What does 9 / 3 return in Python?',
        options: ['3', '3.0', '0', 'Error'],
        correctOption: 1,
        hints: [
          'The / operator in Python always returns a float.',
          'Even though the answer is a whole number, it is written with a decimal.',
        ],
        solution: '9 / 3 returns 3.0 — the / operator always produces a float in Python.',
      },
    },
    {
      id: 'modulus',
      title: 'Remainder (Modulus)',
      slug: 'modulus',
      tldr: 'The % operator gives you the remainder after division — useful for checking if a number is even or odd.',
      searchableTerms: ['modulus', 'remainder', '%', 'even odd', 'divisible'],
      recommendedAfter: 'integer-division',
      explanation: [
        'The % operator (called modulus or mod) gives the remainder when one number is divided by another. 10 % 3 is 1 because 3 goes into 10 three times (3 × 3 = 9) with 1 left over.',
        'The most common use is checking even/odd: if number % 2 == 0, the number is even (no remainder). If number % 2 == 1, it is odd.',
      ],
      example: {
        code: `print(10 % 3)   # 10 divided by 3 = 3 remainder 1
print(15 % 5)   # 15 divided by 5 = 3 remainder 0
print(7 % 2)    # 7 divided by 2 = 3 remainder 1`,
        output: '1\n0\n1',
      },
      challenge: {
        type: 'multiple_choice',
        prompt: 'What does 13 % 4 return?',
        options: ['3', '1', '4', '0'],
        correctOption: 1,
        hints: [
          '4 goes into 13 three times (4 × 3 = 12).',
          '13 - 12 = 1, so the remainder is 1.',
        ],
        solution: '13 % 4 returns 1 because 4 × 3 = 12, and 13 - 12 = 1.',
      },
    },
    {
      id: 'math-functions',
      title: 'Useful Math Functions',
      slug: 'math-functions',
      tldr: 'Python has built-in functions like abs(), round(), max(), and min() for common maths tasks.',
      searchableTerms: ['abs', 'round', 'max', 'min', 'math function', 'built-in', 'absolute value'],
      recommendedAfter: 'arithmetic-operators',
      explanation: [
        'Python has several built-in functions for maths. abs(-5) gives 5 — it removes the negative sign. round(3.7) gives 4 — it rounds to the nearest integer. max(3, 8, 1) gives 8 — the largest. min(3, 8, 1) gives 1 — the smallest.',
        'These functions save you from writing complicated code yourself. You just call them by name and pass values inside the brackets.',
      ],
      example: {
        code: `print(abs(-10))         # Absolute value — removes the minus sign
print(round(3.7))       # Rounds to nearest whole number
print(max(5, 12, 3))    # Largest of the three numbers
print(min(5, 12, 3))    # Smallest of the three numbers`,
        output: '10\n4\n12\n3',
      },
      challenge: {
        type: 'multiple_choice',
        prompt: 'What does abs(-42) return?',
        options: ['-42', '42', '0', 'Error'],
        correctOption: 1,
        hints: [
          'abs() stands for "absolute value".',
          'Absolute value removes the negative sign.',
        ],
        solution: 'abs(-42) returns 42 — absolute value removes the negative sign.',
      },
    },
  ],
},
```

- [ ] **Step 2: Commit**

```
git add src/python-curriculum/curriculum/python.ts
git commit -m "feat(python-curriculum): add Data Types, Strings, Numbers groups"
```

---

## Task 5: python.ts — Groups 6–8 (Input/Output, Conditionals, Loops)

**File:** `src/python-curriculum/curriculum/python.ts` — append Groups 6–8 before the closing `]`.

- [ ] **Step 1: Append Groups 6–8**

Write each group and every sub-lesson in full following the exact SubLesson structure. Key rules:

- `input()` and f-strings require `multiple_choice` (can't test runtime input statically).
- All loop and conditional output depends on runtime values — use `multiple_choice`.
- `print("literal")` and `print(a op b)` are the only valid `code_run` targets.

Sub-lessons to write:

**Group 6: Input and Output**

| id | title | challenge type | sub-lesson content |
|----|-------|----------------|--------------------|
| `print-basics` | print() Basics | `code_run` | `print("text")` — write `print("Welcome!")` |
| `print-multiple` | Printing Multiple Items | `code_run` | `print("Hello", "Python")` → `Hello Python` |
| `input-function` | The input() Function | `multiple_choice` | `input()` pauses and waits for typed input; returns a string |
| `formatting-output` | f-Strings | `multiple_choice` | `f"Hello, {name}!"` embeds a variable into a string |

**Group 7: Conditionals**

| id | title | challenge type | sub-lesson content |
|----|-------|----------------|--------------------|
| `if-statement` | The if Statement | `multiple_choice` | Code inside `if` only runs when the condition is `True` |
| `else-clause` | The else Clause | `multiple_choice` | `else:` runs when the `if` condition is `False` |
| `elif-clause` | elif | `multiple_choice` | `elif` checks a second condition if the first was `False` |
| `comparison-operators` | Comparison Operators | `fill_blank` | `==` (equal), `!=` (not equal), `>`, `<`, `>=`, `<=` |
| `logical-operators` | and / or / not | `multiple_choice` | `and` requires both true; `or` needs one; `not` flips |

**Group 8: Loops**

| id | title | challenge type | sub-lesson content |
|----|-------|----------------|--------------------|
| `for-loop` | The for Loop | `multiple_choice` | `for item in collection:` — runs once per item |
| `range-function` | range() | `multiple_choice` | `range(5)` gives 0, 1, 2, 3, 4 |
| `while-loop` | The while Loop | `multiple_choice` | Repeats as long as condition is `True` |
| `break-statement` | break and continue | `multiple_choice` | `break` exits the loop; `continue` skips to next iteration |
| `loop-patterns` | Common Loop Patterns | `multiple_choice` | Counting up, accumulating totals |

For each sub-lesson write: 2 explanation paragraphs, a 4–6 line code example with output, a challenge with 2 hints and a solution.

- [ ] **Step 2: Commit**

```
git add src/python-curriculum/curriculum/python.ts
git commit -m "feat(python-curriculum): add Input/Output, Conditionals, Loops groups"
```

---

## Task 6: python.ts — Groups 9–11 (Functions, Lists, Dictionaries)

**File:** `src/python-curriculum/curriculum/python.ts` — append Groups 9–11.

- [ ] **Step 1: Append Groups 9–11**

Write all sub-lessons in full. `print(variable)` → use `multiple_choice`. Only literal-string `print()` calls use `code_run`.

**Group 9: Functions**

| id | title | challenge type | key content |
|----|-------|----------------|-------------|
| `defining-functions` | Defining a Function | `fill_blank` | `def` keyword; indented body |
| `calling-functions` | Calling a Function | `multiple_choice` | Write the function name + `()` to execute it |
| `parameters` | Parameters | `multiple_choice` | Named inputs a function receives |
| `return-values` | return | `multiple_choice` | `return` sends a value back to the caller |
| `scope` | Variable Scope | `multiple_choice` | Variables defined inside a function only exist inside it |

**Group 10: Lists**

| id | title | challenge type | key content |
|----|-------|----------------|-------------|
| `creating-lists` | Creating Lists | `multiple_choice` | `my_list = [1, 2, 3]` — square brackets, comma-separated |
| `accessing-items` | Accessing Items | `multiple_choice` | `my_list[0]` = first item; index starts at 0 |
| `list-methods` | List Methods | `fill_blank` | `.append()` adds to end; `.remove()` removes a value |
| `looping-lists` | Looping Over Lists | `multiple_choice` | `for item in my_list:` visits each item once |
| `list-slicing` | List Slicing | `multiple_choice` | `my_list[1:3]` returns items at index 1 and 2 |

**Group 11: Dictionaries**

| id | title | challenge type | key content |
|----|-------|----------------|-------------|
| `creating-dicts` | Creating Dictionaries | `multiple_choice` | `{}` with `key: value` pairs; keys are usually strings |
| `accessing-values` | Accessing Values | `multiple_choice` | `my_dict["key"]` returns the value for that key |
| `adding-keys` | Adding and Updating | `multiple_choice` | `my_dict["new_key"] = value` adds or overwrites |
| `dict-methods` | Dictionary Methods | `fill_blank` | `.keys()`, `.values()`, `.items()` |
| `looping-dicts` | Looping Over Dicts | `multiple_choice` | `for key, value in my_dict.items():` |

- [ ] **Step 2: Commit**

```
git add src/python-curriculum/curriculum/python.ts
git commit -m "feat(python-curriculum): add Functions, Lists, Dictionaries groups"
```

---

## Task 7: python.ts — Groups 12–15 (OOP, APIs, Files, Error Handling)

**File:** `src/python-curriculum/curriculum/python.ts` — append Groups 12–15.

- [ ] **Step 1: Append Groups 12–15**

All API and file challenges must use `multiple_choice` or `fill_blank` — no live I/O in the static validator.

**Group 12: Object-Oriented Programming**

| id | title | challenge type | key content |
|----|-------|----------------|-------------|
| `what-is-a-class` | What Is a Class? | `multiple_choice` | A class is a blueprint; an object is an instance |
| `init-method` | The __init__ Method | `fill_blank` | Runs automatically when object is created; receives `self` |
| `instance-variables` | Instance Variables | `multiple_choice` | `self.name` stores data on each individual object |
| `methods` | Methods | `multiple_choice` | A function defined inside a class; first param is `self` |
| `inheritance` | Inheritance | `multiple_choice` | Child class inherits parent's methods via `class Child(Parent):` |

**Group 13: APIs and Requests**

| id | title | challenge type | key content |
|----|-------|----------------|-------------|
| `what-is-an-api` | What Is an API? | `multiple_choice` | A way for programs to talk to each other over the internet |
| `http-requests` | HTTP Requests | `multiple_choice` | `import requests; requests.get(url)` fetches data |
| `json-data` | JSON Data | `multiple_choice` | JSON is text that looks like a Python dictionary |
| `api-response` | Reading API Responses | `multiple_choice` | `response.json()` converts JSON text into a Python dict |

**Group 14: Files**

| id | title | challenge type | key content |
|----|-------|----------------|-------------|
| `reading-files` | Reading Files | `multiple_choice` | `open("file.txt", "r")` then `.read()` or `.readlines()` |
| `writing-files` | Writing Files | `fill_blank` | `"w"` mode creates/overwrites; `"a"` mode appends |
| `appending-files` | Appending to Files | `multiple_choice` | `"a"` adds to the end without deleting existing content |
| `file-paths` | File Paths | `multiple_choice` | Relative path: `"data.txt"`; absolute path: `"C:/Users/data.txt"` |

**Group 15: Error Handling**

| id | title | challenge type | key content |
|----|-------|----------------|-------------|
| `what-is-an-error` | What Is an Error? | `multiple_choice` | An exception stops the program; common ones: ValueError, TypeError |
| `try-except` | try and except | `fill_blank` | `try:` wraps risky code; `except:` runs if it fails |
| `multiple-exceptions` | Specific Exceptions | `multiple_choice` | `except ValueError:` catches only that error type |
| `finally-block` | The finally Block | `multiple_choice` | `finally:` runs whether or not an error occurred |

- [ ] **Step 2: Commit**

```
git add src/python-curriculum/curriculum/python.ts
git commit -m "feat(python-curriculum): add OOP, APIs, Files, Error Handling groups"
```

---

## Task 8: PythonCurriculumApp.jsx + PlaceholderModal.jsx

**Files:**
- Create: `src/python-curriculum/components/PlaceholderModal.jsx`
- Create: `src/python-curriculum/components/PythonCurriculumApp.jsx`

- [ ] **Step 1: Create PlaceholderModal.jsx**

```jsx
// src/python-curriculum/components/PlaceholderModal.jsx
import { createPortal } from 'react-dom'

export default function PlaceholderModal({ language, onClose, onContinueWithPython }) {
  if (!language) return null
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-8 max-w-sm w-full mx-4"
        style={{ background: '#0f1221', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {language} is coming soon.
        </h2>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Python is the first live Code Academy track. More languages will be added later.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onContinueWithPython}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#0d9488', color: '#fff' }}
          >
            Continue with Python
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
          >
            Back
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: Create PythonCurriculumApp.jsx**

```jsx
// src/python-curriculum/components/PythonCurriculumApp.jsx
import { useState, useCallback } from 'react'
import { loadAllProgress } from '../storage/progressStorage'
import LanguagePicker from './LanguagePicker'
import LessonMap from './LessonMap'
import SubLessonView from './SubLessonView'

export default function PythonCurriculumApp() {
  const [stage, setStage]           = useState('language')  // 'language' | 'map' | 'lesson'
  const [selectedLesson, setSelectedLesson] = useState(null) // { groupId, subLessonId }
  const [mapScrollTop, setMapScrollTop]     = useState(0)
  const [progress, setProgress]     = useState(() => loadAllProgress())

  const refreshProgress = useCallback(() => {
    setProgress(loadAllProgress())
  }, [])

  function navigate(newStage, params) {
    if (newStage === 'lesson' && params) setSelectedLesson(params)
    setStage(newStage)
  }

  if (stage === 'language') {
    return <LanguagePicker onSelectPython={() => navigate('map')} />
  }

  if (stage === 'map') {
    return (
      <LessonMap
        progress={progress}
        initialScrollTop={mapScrollTop}
        onScrollChange={setMapScrollTop}
        onSelectLesson={(groupId, subLessonId) => navigate('lesson', { groupId, subLessonId })}
        onBack={() => navigate('language')}
      />
    )
  }

  const { groupId, subLessonId } = selectedLesson ?? {}
  return (
    <SubLessonView
      groupId={groupId}
      subLessonId={subLessonId}
      progress={progress}
      onBack={() => navigate('map')}
      onProgressChange={refreshProgress}
      onNext={() => navigate('map')}
    />
  )
}
```

- [ ] **Step 3: Commit**

```
git add src/python-curriculum/components/PythonCurriculumApp.jsx src/python-curriculum/components/PlaceholderModal.jsx
git commit -m "feat(python-curriculum): add PythonCurriculumApp state machine and PlaceholderModal"
```

---

## Task 9: LanguagePicker.jsx

**File:** `src/python-curriculum/components/LanguagePicker.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/python-curriculum/components/LanguagePicker.jsx
import { useState } from 'react'
import { Lock } from 'lucide-react'
import PlaceholderModal from './PlaceholderModal'

const ACTIVE_LANGUAGE = {
  id: 'python', label: 'Python', emoji: '🐍',
  desc: 'Automate tasks, analyse data, build apps',
}

const COMING_SOON = [
  { id: 'javascript', label: 'JavaScript', emoji: '🟨', desc: 'Add interactivity to websites' },
  { id: 'html',       label: 'HTML',       emoji: '🟧', desc: 'Structure web pages' },
  { id: 'css',        label: 'CSS',        emoji: '🎨', desc: 'Style web pages' },
  { id: 'sql',        label: 'SQL',        emoji: '🗄️',  desc: 'Query databases' },
  { id: 'typescript', label: 'TypeScript', emoji: '🔷', desc: 'JavaScript with types' },
  { id: 'react',      label: 'React',      emoji: '⚛️',  desc: 'Build UI components' },
  { id: 'nodejs',     label: 'Node.js',    emoji: '🟩', desc: 'Server-side JavaScript' },
]

function LanguageCard({ lang, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col gap-2 p-5 rounded-2xl text-left transition-all hover:brightness-105"
      style={{
        background: active ? 'rgba(53,114,165,0.15)'         : 'rgba(255,255,255,0.02)',
        border:     active ? '1px solid rgba(53,114,165,0.5)' : '1px solid rgba(255,255,255,0.07)',
        opacity:    active ? 1 : 0.5,
      }}
    >
      {!active && (
        <span
          className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}
        >
          <Lock size={9} /> Coming soon
        </span>
      )}
      <span className="text-2xl">{lang.emoji}</span>
      <div>
        <div className="text-[14px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
          {lang.label}
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {lang.desc}
        </div>
      </div>
      {active && (
        <span
          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full self-start"
          style={{ background: 'rgba(13,148,136,0.2)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)' }}
        >
          Available now
        </span>
      )}
    </button>
  )
}

export default function LanguagePicker({ onSelectPython }) {
  const [placeholder, setPlaceholder] = useState(null)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
          Choose a language
        </h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Python is the first available track. More are coming.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <LanguageCard lang={ACTIVE_LANGUAGE} active onClick={onSelectPython} />
        {COMING_SOON.map((lang) => (
          <LanguageCard
            key={lang.id}
            lang={lang}
            active={false}
            onClick={() => setPlaceholder(lang.label)}
          />
        ))}
      </div>

      <PlaceholderModal
        language={placeholder}
        onClose={() => setPlaceholder(null)}
        onContinueWithPython={() => { setPlaceholder(null); onSelectPython() }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```
git add src/python-curriculum/components/LanguagePicker.jsx
git commit -m "feat(python-curriculum): add LanguagePicker with Python active and Coming soon placeholders"
```

---

## Task 10: LessonMap.jsx

**File:** `src/python-curriculum/components/LessonMap.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/python-curriculum/components/LessonMap.jsx
import { useState, useMemo, useRef, useEffect } from 'react'
import { ArrowLeft, Search, CheckCircle2 } from 'lucide-react'
import { PYTHON_CURRICULUM } from '../curriculum/python'

function lessonStatus(p) {
  if (!p)          return 'not_started'
  if (p.completed) return 'completed'
  if (p.skipped)   return 'skipped'
  if (p.viewed || p.practiced) return 'in_progress'
  return 'not_started'
}

function cardStyle(status) {
  if (status === 'completed')  return { background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(45,212,191,0.3)' }
  if (status === 'in_progress') return { background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid #0d9488', border: '1px solid transparent' }
  if (status === 'skipped')    return { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', opacity: 0.5 }
  return { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }
}

export default function LessonMap({ progress, onSelectLesson, onBack, initialScrollTop, onScrollChange }) {
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    if (containerRef.current && initialScrollTop) containerRef.current.scrollTop = initialScrollTop
  }, [initialScrollTop])

  // Build id→title lookup for recommendedAfter tooltips
  const titleById = useMemo(() => {
    const map = {}
    PYTHON_CURRICULUM.forEach((g) => g.subLessons.forEach((sl) => { map[sl.id] = sl.title }))
    return map
  }, [])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return PYTHON_CURRICULUM
    return PYTHON_CURRICULUM
      .map((group) => ({
        ...group,
        subLessons: group.subLessons.filter((sl) =>
          sl.title.toLowerCase().includes(q) ||
          sl.searchableTerms.some((t) => t.toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.subLessons.length > 0)
  }, [query])

  return (
    <div
      ref={containerRef}
      className="p-6 max-w-4xl mx-auto overflow-auto"
      onScroll={() => onScrollChange?.(containerRef.current?.scrollTop ?? 0)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <h1 className="text-xl font-bold flex-1 text-center" style={{ color: 'rgba(255,255,255,0.88)' }}>
          Python Curriculum
        </h1>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
        <input
          type="text"
          placeholder="Search lessons…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border:     '1px solid rgba(255,255,255,0.09)',
            color:      'rgba(255,255,255,0.8)',
          }}
        />
      </div>

      {filteredGroups.length === 0 && (
        <p className="text-center text-sm py-12" style={{ color: 'rgba(255,255,255,0.25)' }}>
          No lessons match "{query}"
        </p>
      )}

      {filteredGroups.map((group) => {
        const total = group.subLessons.length
        const done  = group.subLessons.filter((sl) => progress[sl.id]?.completed).length
        return (
          <section key={group.id} className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {group.title}
              </h2>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: done === total ? 'rgba(13,148,136,0.2)' : 'rgba(255,255,255,0.06)',
                  color:      done === total ? '#2dd4bf' : 'rgba(255,255,255,0.35)',
                }}
              >
                {done} / {total}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {group.subLessons.map((sl) => {
                const status = lessonStatus(progress[sl.id])
                const tip    = sl.recommendedAfter ? `Helpful after: ${titleById[sl.recommendedAfter] ?? sl.recommendedAfter}` : null
                return (
                  <button
                    key={sl.id}
                    onClick={() => onSelectLesson(group.id, sl.id)}
                    title={tip ?? undefined}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:brightness-110"
                    style={cardStyle(status)}
                  >
                    {status === 'completed' && <CheckCircle2 size={13} style={{ color: '#2dd4bf', flexShrink: 0 }} />}
                    <span style={{
                      color:          status === 'skipped' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)',
                      textDecoration: status === 'skipped' ? 'line-through' : 'none',
                      fontWeight:     500,
                    }}>
                      {sl.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```
git add src/python-curriculum/components/LessonMap.jsx
git commit -m "feat(python-curriculum): add LessonMap with search, progress states, completion pills"
```

---

## Task 11: SubLessonView.jsx

**File:** `src/python-curriculum/components/SubLessonView.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/python-curriculum/components/SubLessonView.jsx
import { useEffect, useState, useMemo } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { PYTHON_CURRICULUM } from '../curriculum/python'
import { saveProgress } from '../storage/progressStorage'
import ChallengePanel from './ChallengePanel'

export default function SubLessonView({ groupId, subLessonId, progress, onBack, onProgressChange, onNext }) {
  const [tldrOpen, setTldrOpen] = useState(false)

  const group = useMemo(
    () => PYTHON_CURRICULUM.find((g) => g.id === groupId),
    [groupId],
  )
  const subLesson = useMemo(
    () => group?.subLessons.find((sl) => sl.id === subLessonId),
    [group, subLessonId],
  )
  const nextSubLesson = useMemo(() => {
    if (!group || !subLesson) return null
    const idx = group.subLessons.findIndex((sl) => sl.id === subLessonId)
    return group.subLessons[idx + 1] ?? null
  }, [group, subLesson, subLessonId])

  useEffect(() => {
    if (!subLessonId) return
    saveProgress(subLessonId, { viewed: true })
    onProgressChange()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subLessonId])

  if (!subLesson || !group) {
    return <div className="p-6 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Lesson not found.</div>
  }

  function handlePracticed() {
    saveProgress(subLessonId, { practiced: true })
    onProgressChange()
  }
  function handleComplete() {
    saveProgress(subLessonId, { completed: true })
    onProgressChange()
    onNext()
  }
  function handleSkip() {
    saveProgress(subLessonId, { skipped: true })
    onProgressChange()
    onNext()
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100%' }}>
      {/* Top nav */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b text-sm flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <ArrowLeft size={14} /> Back to map
        </button>
        <span className="flex-1 text-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {group.title} › {subLesson.title}
        </span>
        <button onClick={handleSkip} className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Skip →
        </button>
        {nextSubLesson && (
          <button onClick={onNext} className="text-xs font-medium" style={{ color: '#2dd4bf' }}>
            Next →
          </button>
        )}
      </div>

      {/* Split body */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left — explanation */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 lg:max-w-[55%]">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>
            {subLesson.title}
          </h1>
          <p className="text-xs mb-6 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {group.title}
          </p>

          <div className="flex flex-col gap-4 mb-6">
            {subLesson.explanation.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {para}
              </p>
            ))}
          </div>

          {/* Code example */}
          <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
            <div
              className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide border-b"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
            >
              Example
            </div>
            <pre className="p-4 text-[13px] leading-relaxed overflow-x-auto" style={{ background: 'rgba(0,0,0,0.3)', color: '#a5d6ff', fontFamily: 'monospace' }}>
              {subLesson.example.code}
            </pre>
            {subLesson.example.output && (
              <>
                <div
                  className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide border-t border-b"
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }}
                >
                  Output
                </div>
                <pre className="px-4 py-3 text-[13px]" style={{ background: 'rgba(0,0,0,0.2)', color: '#6ee7b7', fontFamily: 'monospace' }}>
                  {subLesson.example.output}
                </pre>
              </>
            )}
          </div>

          {/* TL;DR toggle */}
          <button
            onClick={() => setTldrOpen((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold mb-1"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            {tldrOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} TL;DR
          </button>
          {tldrOpen && (
            <p className="text-sm pl-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {subLesson.tldr}
            </p>
          )}
        </div>

        {/* Right — challenge */}
        <div
          className="lg:w-[45%] flex-shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l p-6"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <ChallengePanel
            challenge={subLesson.challenge}
            onPracticed={handlePracticed}
            onComplete={handleComplete}
            onSkip={handleSkip}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```
git add src/python-curriculum/components/SubLessonView.jsx
git commit -m "feat(python-curriculum): add SubLessonView split-screen layout with TL;DR toggle"
```

---

## Task 12: ChallengePanel.jsx

**File:** `src/python-curriculum/components/ChallengePanel.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/python-curriculum/components/ChallengePanel.jsx
import { useState } from 'react'
import { CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { validate } from '../validator'

export default function ChallengePanel({ challenge, onPracticed, onComplete, onSkip }) {
  const [code, setCode]             = useState(challenge.starterCode ?? '')
  const [selectedOption, setSelectedOption] = useState(null)
  const [fillValue, setFillValue]   = useState('')
  const [result, setResult]         = useState(null)   // { passed, userOutput }
  const [attempts, setAttempts]     = useState(0)
  const [hintsShown, setHintsShown] = useState(0)
  const [showSolution, setShowSolution] = useState(false)

  const MAX_HINTS = challenge.hints?.length ?? 0

  function getUserInput() {
    if (challenge.type === 'multiple_choice') return selectedOption
    if (challenge.type === 'fill_blank')     return fillValue
    return undefined
  }

  function handleRun() {
    if (attempts === 0) onPracticed()
    const r           = validate(code, challenge, getUserInput())
    const newAttempts = attempts + 1
    setResult(r)
    setAttempts(newAttempts)
    if (newAttempts >= 3 && !r.passed) setShowSolution(true)
  }

  if (challenge.type === 'read_only') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{challenge.prompt}</p>
        <button onClick={onComplete} className="py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#0d9488', color: '#fff' }}>
          Continue →
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#2dd4bf' }}>Challenge</div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {challenge.prompt}
        </p>
      </div>

      {/* Code textarea */}
      {challenge.type === 'code_run' && (
        <textarea
          value={code}
          onChange={(e) => { setCode(e.target.value); setResult(null) }}
          spellCheck={false}
          rows={6}
          className="w-full rounded-xl p-3 text-[13px] resize-y outline-none"
          style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.09)', color: '#a5d6ff' }}
        />
      )}

      {/* Multiple choice */}
      {challenge.type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {challenge.options?.map((opt, i) => (
            <button
              key={i}
              onClick={() => { setSelectedOption(i); setResult(null) }}
              className="text-left px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: selectedOption === i ? 'rgba(13,148,136,0.2)'          : 'rgba(255,255,255,0.03)',
                border:     selectedOption === i ? '1px solid rgba(45,212,191,0.4)' : '1px solid rgba(255,255,255,0.07)',
                color:      selectedOption === i ? '#e2f8f5'                        : 'rgba(255,255,255,0.7)',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Fill blank */}
      {challenge.type === 'fill_blank' && (
        <input
          type="text"
          value={fillValue}
          onChange={(e) => { setFillValue(e.target.value); setResult(null) }}
          placeholder="Type your answer…"
          className="px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.85)' }}
        />
      )}

      {/* Result */}
      {result && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
          style={{
            background: result.passed ? 'rgba(13,148,136,0.12)'  : 'rgba(239,68,68,0.1)',
            border:     result.passed ? '1px solid rgba(45,212,191,0.25)' : '1px solid rgba(239,68,68,0.25)',
          }}
        >
          {result.passed
            ? <CheckCircle2 size={16} style={{ color: '#2dd4bf', flexShrink: 0, marginTop: 1 }} />
            : <XCircle      size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />}
          <div>
            {result.passed ? (
              <span style={{ color: '#6ee7b7' }}>Correct!</span>
            ) : (
              <>
                <span style={{ color: '#fca5a5' }}>Not quite.</span>
                {challenge.expectedOutput != null && result.userOutput != null && (
                  <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Expected: <code style={{ color: '#6ee7b7' }}>{challenge.expectedOutput}</code>
                    {' · '}Got: <code style={{ color: '#f87171' }}>{result.userOutput}</code>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Run / Check */}
      {!result?.passed && (
        <button
          onClick={handleRun}
          disabled={challenge.type === 'multiple_choice' && selectedOption == null}
          className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: '#0d9488', color: '#fff' }}
        >
          {challenge.type === 'code_run' ? 'Run' : 'Check'}
        </button>
      )}

      {/* Continue after passing */}
      {result?.passed && (
        <button onClick={onComplete} className="py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#0d9488', color: '#fff' }}>
          Continue →
        </button>
      )}

      {/* Hints */}
      {MAX_HINTS > 0 && !result?.passed && (
        <div>
          {hintsShown < MAX_HINTS && (
            <button
              onClick={() => setHintsShown((n) => n + 1)}
              className="flex items-center gap-1 text-xs"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              <ChevronDown size={12} /> Show hint ({hintsShown + 1} of {MAX_HINTS})
            </button>
          )}
          {challenge.hints.slice(0, hintsShown).map((hint, i) => (
            <p key={i} className="text-xs mt-1 pl-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
              💡 {hint}
            </p>
          ))}
        </div>
      )}

      {/* Solution (after 3 failed attempts) */}
      {showSolution && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Solution</p>
          <pre className="text-[13px] whitespace-pre-wrap" style={{ color: '#a5d6ff', fontFamily: 'monospace' }}>
            {challenge.solution}
          </pre>
        </div>
      )}

      {/* Skip */}
      <button onClick={onSkip} className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Skip lesson
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```
git add src/python-curriculum/components/ChallengePanel.jsx
git commit -m "feat(python-curriculum): add ChallengePanel with validation, hints, solution reveal"
```

---

## Task 13: Update CodeAcademy.jsx

**File:** `src/views/CodeAcademy.jsx` — replace content with two-mode shell.

- [ ] **Step 1: Replace the file**

```jsx
// src/views/CodeAcademy.jsx
import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useCodeAcademy } from '../code-academy/useCodeAcademy.js'
import CodeAcademyHome from '../code-academy/components/CodeAcademyHome.jsx'
import CodeAcademyPage from '../code-academy/components/CodeAcademyPage.jsx'
import PythonCurriculumApp from '../python-curriculum/components/PythonCurriculumApp.jsx'

const TABS = [
  { id: 'learn',    label: 'Learn' },
  { id: 'generate', label: 'Generate' },
]

export default function CodeAcademy() {
  const [mode, setMode] = useState('learn')

  const { allCodeProgress, deleteCodeLesson } = useStore()
  const academy = useCodeAcademy()
  const progressList = allCodeProgress()

  // Hide tabs when inside a generate lesson so the tab bar doesn't float over the lesson UI
  const showTabs = mode === 'learn' || academy.stage === 'home'

  return (
    <div className="flex flex-col h-full">
      {showTabs && (
        <div className="flex gap-1 px-6 pt-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className="px-5 py-2 rounded-t-xl text-sm font-semibold transition-colors"
              style={{
                background:   mode === tab.id ? 'rgba(13,148,136,0.15)' : 'transparent',
                color:        mode === tab.id ? '#2dd4bf'               : 'rgba(255,255,255,0.35)',
                borderBottom: mode === tab.id ? '2px solid #0d9488'     : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {mode === 'learn' ? (
          <PythonCurriculumApp />
        ) : academy.stage === 'home' ? (
          <CodeAcademyHome
            onStart={academy.startLesson}
            onDelete={deleteCodeLesson}
            isLoading={academy.stage === 'loading'}
            error={academy.error}
            progressList={progressList}
          />
        ) : (
          <CodeAcademyPage academy={academy} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```
npx vitest run src/python-curriculum
```

Expected: all tests pass (Tasks 1 + 2 tests)

- [ ] **Step 3: Commit**

```
git add src/views/CodeAcademy.jsx
git commit -m "feat(code-academy): add Learn/Generate tab switcher, wire PythonCurriculumApp"
```

---

## Self-review checklist

- All 15 curriculum groups covered across Tasks 3–7 ✓
- Static validator: `code_run`, `multiple_choice`, `fill_blank`, `read_only` all handled ✓
- No `print(variable)` in any `code_run` challenge ✓
- Division excluded from `code_run` (uses `multiple_choice`) ✓
- Arithmetic evaluated with a direct `a op b` parser — no eval/new Function ✓
- localStorage keys use `fm_pyca_` prefix — no conflict with `fm_code_*` ✓
- `src/code-academy/` directory untouched ✓
- Screen state machine: `language → map → lesson` with scroll position restored ✓
- Progress lifecycle: viewed on open → practiced on first run → completed/skipped ✓
- All component file paths match the file structure at the top ✓
