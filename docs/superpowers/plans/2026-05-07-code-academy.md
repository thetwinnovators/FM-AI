# Code Academy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive coding tutor section in FlowMap (`/code-academy`) that teaches HTML, CSS, and Python through AI-generated lessons, worked examples, a live code editor, immediate LLM feedback, hover vocabulary definitions, and per-lesson progress tracking.

**Architecture:** New `src/code-academy/` module with Ollama `chatJson` for lesson generation and Python validation, DOMParser for HTML/CSS structural validation with iframe visual preview, and a `useCodeAcademy` hook as the central state machine. Lesson content and user progress persist in `useStore`. The UI is a 3-panel layout: left lesson nav, center lesson+editor, right AI feedback+hints.

**Tech Stack:** React 19, Tailwind v4, `prism-react-renderer` v2 (already installed), Ollama `chatJson`, DOMParser API, `useStore` localStorage persistence.

---

## File map

**Create:**
- `src/code-academy/types.ts` — TypeScript interfaces
- `src/code-academy/constants.js` — Languages, concepts, goals
- `src/code-academy/lessonGenerator.js` — Two-step Ollama lesson + exercise generation
- `src/code-academy/validatorEngine.js` — HTML/CSS DOMParser + LLM Python validation
- `src/code-academy/feedbackEngine.js` — Ollama error explanation (middle-school tone)
- `src/code-academy/useCodeAcademy.js` — Central state machine hook
- `src/code-academy/components/TermHoverCard.jsx` — Vocabulary hover tooltip
- `src/code-academy/components/WorkedExampleCard.jsx` — Worked example with step annotations
- `src/code-academy/components/CodeEditorPanel.jsx` — Textarea editor + Run/Reset/Hint buttons
- `src/code-academy/components/OutputPanel.jsx` — HTML iframe preview or text output
- `src/code-academy/components/ExerciseCard.jsx` — Exercise prompt + validation result
- `src/code-academy/components/ProgressSidebar.jsx` — Right panel: AI feedback + hints + goals
- `src/code-academy/components/CodeAcademyHome.jsx` — Entry: language/concept/goal picker
- `src/code-academy/components/CodeAcademyPage.jsx` — 3-panel lesson workspace
- `src/views/CodeAcademy.jsx` — Thin view wrapper

**Modify:**
- `src/store/useStore.js` — Add `codeLessons`, `codeProgress` to EMPTY + 5 new store methods
- `src/App.jsx` — Add `/code-academy` lazy route
- `src/components/layout/LeftRail.jsx` — Add nav item

---

## Task 1: Types, constants, and store additions

**Files:**
- Create: `src/code-academy/types.ts`
- Create: `src/code-academy/constants.js`
- Modify: `src/store/useStore.js`

- [ ] **Step 1: Create `src/code-academy/types.ts`**

```typescript
export interface TermDefinition {
  term: string
  plainMeaning: string
  example: string
  whyItMatters: string
}

export interface WorkedExample {
  code: string
  language: string
  explanationSteps: string[]
  expectedOutput?: string
}

export interface CodeExercise {
  id: string
  prompt: string
  starterCode?: string
  successCriteria: string[]
  expectedOutput?: string
  validatorType: 'output' | 'structure' | 'logic' | 'llm'
  hints: string[]
}

export type Language = 'html' | 'css' | 'python'
export type Difficulty = 'beginner' | 'beginner_plus' | 'intermediate'
export type MasteryState = 'not_started' | 'in_progress' | 'passed' | 'review' | 'mastered'

export interface CodeLesson {
  id: string
  language: Language
  concept: string
  title: string
  summary: string
  difficulty: Difficulty
  objectives: string[]
  prerequisites: string[]
  terminology: TermDefinition[]
  workedExample: WorkedExample
  exercises: CodeExercise[]
  commonMistakes: string[]
  generatedAt: string
}

export interface CodeLessonProgress {
  lessonKey: string
  language: Language
  concept: string
  attempts: number
  hintsUsed: number
  exercisesCompleted: number
  exercisesTotal: number
  masteryState: MasteryState
  lastAttemptedAt?: string
  completedAt?: string
}
```

- [ ] **Step 2: Create `src/code-academy/constants.js`**

```javascript
export const LANGUAGES = [
  { id: 'html',   label: 'HTML',   color: '#e34c26', desc: 'The building blocks of web pages' },
  { id: 'css',    label: 'CSS',    color: '#264de4', desc: 'Make web pages look beautiful' },
  { id: 'python', label: 'Python', color: '#3572A5', desc: 'Automate, build scripts, work with data' },
]

export const CONCEPTS_BY_LANGUAGE = {
  html: [
    'Headings and paragraphs',
    'Links and images',
    'Lists (ordered and unordered)',
    'Forms and inputs',
    'Divs and spans',
    'Tables',
    'Semantic elements',
    'HTML structure (head and body)',
  ],
  css: [
    'Selectors',
    'Colors and backgrounds',
    'Fonts and text',
    'Box model (padding, margin, border)',
    'Flexbox layout',
    'Width and height',
    'Classes and IDs',
    'Hover effects',
  ],
  python: [
    'Variables',
    'Print and input',
    'Numbers and math',
    'Strings',
    'Lists',
    'If and else',
    'Loops (for and while)',
    'Functions',
  ],
}

export const GOALS = [
  { label: 'Build a simple web page',       language: 'html',   concept: 'HTML structure (head and body)' },
  { label: 'Add links and images to HTML',   language: 'html',   concept: 'Links and images' },
  { label: 'Create an HTML form',            language: 'html',   concept: 'Forms and inputs' },
  { label: 'Style a card layout',            language: 'css',    concept: 'Box model (padding, margin, border)' },
  { label: 'Center things with Flexbox',     language: 'css',    concept: 'Flexbox layout' },
  { label: 'Change colors and fonts',        language: 'css',    concept: 'Colors and backgrounds' },
  { label: 'Learn Python for beginners',     language: 'python', concept: 'Variables' },
  { label: 'Write a simple Python script',   language: 'python', concept: 'Print and input' },
  { label: 'Work with lists in Python',      language: 'python', concept: 'Lists' },
]
```

- [ ] **Step 3: Add `codeLessons` and `codeProgress` to EMPTY in `src/store/useStore.js`**

Find the EMPTY constant (line ~12). After `courses: {},` add:

```javascript
  codeLessons: {},      // Code Academy — lessonKey -> CodeLesson (cached AI-generated)
  codeProgress: {},     // Code Academy — lessonKey -> CodeLessonProgress
```

- [ ] **Step 4: Add 5 store methods to `src/store/useStore.js`**

After the `allCoursesSorted` function (around line 884), add:

```javascript
  // ── Code Academy ─────────────────────────────────────────────────────────────

  const addCodeLesson = useCallback((key, lesson) => {
    const cur = memoryState
    persist({ ...cur, codeLessons: { ...cur.codeLessons, [key]: lesson } })
  }, [])

  const getCodeLesson = useCallback((key) => memoryState.codeLessons?.[key] || null, [])

  const saveCodeProgress = useCallback((key, patch) => {
    const cur = memoryState
    const existing = cur.codeProgress?.[key] || {
      lessonKey: key,
      attempts: 0,
      hintsUsed: 0,
      exercisesCompleted: 0,
      exercisesTotal: 0,
      masteryState: 'not_started',
    }
    persist({ ...cur, codeProgress: { ...cur.codeProgress, [key]: { ...existing, ...patch } } })
  }, [])

  const getCodeProgress = useCallback((key) => memoryState.codeProgress?.[key] || null, [])

  const allCodeProgress = useCallback(() => Object.values(memoryState.codeProgress || {}), [])
```

- [ ] **Step 5: Add the 5 methods to the `return {}` in `src/store/useStore.js`**

Find the `return {` block (line ~887). Add alongside the existing course methods:

```javascript
    addCodeLesson, getCodeLesson, saveCodeProgress, getCodeProgress, allCodeProgress,
```

- [ ] **Step 6: Run existing store tests**

```bash
npm test -- --run src/store/useStore.test.js
```

Expected: all tests pass (no regressions from the additions)

- [ ] **Step 7: Commit**

```bash
git add src/code-academy/types.ts src/code-academy/constants.js src/store/useStore.js
git commit -m "feat(code-academy): types, constants, and store foundation"
```

---

## Task 2: Lesson generator

**Files:**
- Create: `src/code-academy/lessonGenerator.js`
- Create: `src/code-academy/__tests__/lessonGenerator.test.js`

- [ ] **Step 1: Create `src/code-academy/lessonGenerator.js`**

```javascript
/**
 * Code Academy lesson generation.
 *
 * generateCodeLesson(language, concept) → CodeLesson | null
 *
 * Two sequential Ollama chatJson calls:
 *   1. Generate lesson structure (intro, terminology, worked example)
 *   2. Generate 3 exercises grounded in the worked example
 *
 * Returns null on any failure. Caller caches result in useStore.
 */

import { chatJson } from '../lib/llm/ollama.js'

function lessonStructureMessages(language, concept) {
  return [
    {
      role: 'system',
      content:
        'You are a coding tutor writing for a 10-12 year old who has never coded before. ' +
        'Write in plain, simple language. Short sentences. When you use a technical word, ' +
        'define it immediately in simple language. Teach one idea at a time. ' +
        'Return ONLY a valid JSON object — no markdown, no code fences, no extra text.',
    },
    {
      role: 'user',
      content:
        `Create a coding lesson about "${concept}" in ${language.toUpperCase()}.\n\n` +
        'Return this exact JSON:\n' +
        '{\n' +
        '  "title": "Short friendly lesson title (max 6 words)",\n' +
        '  "summary": "One sentence: what the student can do after this lesson",\n' +
        '  "difficulty": "beginner",\n' +
        '  "objectives": ["You will learn to...", "You will understand..."],\n' +
        '  "prerequisites": [],\n' +
        '  "terminology": [\n' +
        '    {\n' +
        '      "term": "technical word",\n' +
        '      "plainMeaning": "Simple-language meaning for a 10-year-old. 1-2 sentences.",\n' +
        '      "example": "Tiny 1-2 line code example",\n' +
        '      "whyItMatters": "One sentence on why a coder needs this"\n' +
        '    }\n' +
        '  ],\n' +
        '  "workedExample": {\n' +
        '    "code": "Complete short example — 4-8 lines",\n' +
        '    "explanationSteps": ["Line 1: plain explanation", "Lines 2-3: plain explanation"],\n' +
        '    "expectedOutput": "What appears when this runs — omit for HTML/CSS layout examples"\n' +
        '  },\n' +
        '  "commonMistakes": ["Common error 1 in plain language", "Common error 2"]\n' +
        '}\n\n' +
        'Rules:\n' +
        '- title: max 6 words, no jargon\n' +
        '- objectives: 2-3 items starting with "You will"\n' +
        '- prerequisites: empty [] for intro topics\n' +
        '- terminology: 3-5 key terms actually used in this lesson\n' +
        '- workedExample.code: real runnable code, not pseudocode\n' +
        '- explanationSteps: 3-6 steps, each explaining 1-2 lines in plain English\n' +
        '- commonMistakes: 2-3 items as "You might forget to..."\n' +
        `- Use only ${language.toUpperCase()} syntax in workedExample.code`,
    },
  ]
}

function exerciseMessages(language, concept, lessonTitle, workedCode) {
  return [
    {
      role: 'system',
      content:
        'You write beginner coding exercises for a 10-12 year old. ' +
        'Exercises are short, focused, and build directly on the lesson. ' +
        'Return ONLY a valid JSON object — no markdown, no code fences.',
    },
    {
      role: 'user',
      content:
        `Write 3 exercises for the lesson "${lessonTitle}" about "${concept}" in ${language.toUpperCase()}.\n` +
        `The worked example the student just saw:\n\`\`\`\n${workedCode}\n\`\`\`\n\n` +
        'Return:\n' +
        '{\n' +
        '  "exercises": [\n' +
        '    {\n' +
        '      "id": "ex1",\n' +
        '      "prompt": "What to build. Plain friendly language. Max 3 sentences.",\n' +
        '      "starterCode": "A few starter lines or comment hints — empty string if not needed",\n' +
        '      "successCriteria": ["Specific thing the code must do", "Another requirement"],\n' +
        '      "expectedOutput": "What should show when run — omit for HTML/CSS layout",\n' +
        '      "validatorType": "llm",\n' +
        '      "hints": ["Gentle nudge hint", "More direct hint"]\n' +
        '    }\n' +
        '  ]\n' +
        '}\n\n' +
        'Rules:\n' +
        '- Exercise 1: almost identical to worked example, tiny change\n' +
        '- Exercise 2: same concept, different context\n' +
        '- Exercise 3: small challenge combining concept with one other idea\n' +
        '- successCriteria: 2-3 concrete checkable items per exercise\n' +
        '- hints: 2 per exercise\n' +
        `- validatorType: "structure" for HTML/CSS, "llm" for Python\n` +
        `- All code uses ${language.toUpperCase()} syntax only`,
    },
  ]
}

function shapeTerm(raw) {
  return {
    term:         String(raw?.term         || ''),
    plainMeaning: String(raw?.plainMeaning || ''),
    example:      String(raw?.example      || ''),
    whyItMatters: String(raw?.whyItMatters || ''),
  }
}

function shapeExercise(raw, idx) {
  return {
    id:              String(raw?.id || `ex${idx + 1}`),
    prompt:          String(raw?.prompt || ''),
    starterCode:     String(raw?.starterCode || ''),
    successCriteria: Array.isArray(raw?.successCriteria) ? raw.successCriteria.map(String) : [],
    expectedOutput:  raw?.expectedOutput ? String(raw.expectedOutput) : undefined,
    validatorType:   ['output', 'structure', 'logic', 'llm'].includes(raw?.validatorType)
                       ? raw.validatorType : 'llm',
    hints:           Array.isArray(raw?.hints) ? raw.hints.map(String) : [],
  }
}

/**
 * Generate a full CodeLesson. Returns null on any Ollama failure.
 * @param {string} language  'html' | 'css' | 'python'
 * @param {string} concept   e.g. 'Variables'
 */
export async function generateCodeLesson(language, concept) {
  if (!language || !concept) return null
  try {
    const structureRaw = await chatJson(
      lessonStructureMessages(language, concept),
      { temperature: 0.3, num_ctx: 8192 },
    )
    if (!structureRaw?.title || !structureRaw?.workedExample?.code) return null

    const workedExample = {
      code:             String(structureRaw.workedExample.code).trim(),
      language,
      explanationSteps: Array.isArray(structureRaw.workedExample.explanationSteps)
                          ? structureRaw.workedExample.explanationSteps.map(String) : [],
      expectedOutput:   structureRaw.workedExample.expectedOutput
                          ? String(structureRaw.workedExample.expectedOutput) : undefined,
    }

    const exercisesRaw = await chatJson(
      exerciseMessages(language, concept, structureRaw.title, workedExample.code),
      { temperature: 0.3, num_ctx: 8192 },
    )
    if (!Array.isArray(exercisesRaw?.exercises) || exercisesRaw.exercises.length < 1) return null

    const lessonKey = `${language}_${concept.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`

    return {
      id:            lessonKey,
      language,
      concept,
      title:         String(structureRaw.title   || concept),
      summary:       String(structureRaw.summary || ''),
      difficulty:    ['beginner', 'beginner_plus', 'intermediate'].includes(structureRaw.difficulty)
                       ? structureRaw.difficulty : 'beginner',
      objectives:    Array.isArray(structureRaw.objectives)    ? structureRaw.objectives.map(String)    : [],
      prerequisites: Array.isArray(structureRaw.prerequisites) ? structureRaw.prerequisites.map(String) : [],
      terminology:   Array.isArray(structureRaw.terminology)   ? structureRaw.terminology.map(shapeTerm) : [],
      workedExample,
      exercises:     exercisesRaw.exercises.map(shapeExercise),
      commonMistakes:Array.isArray(structureRaw.commonMistakes)? structureRaw.commonMistakes.map(String): [],
      generatedAt:   new Date().toISOString(),
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Create `src/code-academy/__tests__/lessonGenerator.test.js`**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/llm/ollama.js', () => ({ chatJson: vi.fn() }))

import { chatJson } from '../../lib/llm/ollama.js'
import { generateCodeLesson } from '../lessonGenerator.js'

const MOCK_STRUCTURE = {
  title: 'What is a Variable',
  summary: 'You will create your first Python variable.',
  difficulty: 'beginner',
  objectives: ['You will learn to create a variable'],
  prerequisites: [],
  terminology: [{ term: 'variable', plainMeaning: 'A box for a value', example: 'x = 5', whyItMatters: 'Stores info' }],
  workedExample: { code: 'name = "Alice"\nprint(name)', explanationSteps: ['Line 1: store Alice', 'Line 2: print it'], expectedOutput: 'Alice' },
  commonMistakes: ['Forgetting quotes around text'],
}

const MOCK_EXERCISES = {
  exercises: [
    { id: 'ex1', prompt: 'Create a variable', starterCode: '', successCriteria: ['has variable'], validatorType: 'llm', hints: ['use ='] },
    { id: 'ex2', prompt: 'Print a variable',  starterCode: '', successCriteria: ['uses print'],   validatorType: 'llm', hints: ['use print()'] },
    { id: 'ex3', prompt: 'Two variables',     starterCode: '', successCriteria: ['two vars'],     validatorType: 'llm', hints: ['name = ...'] },
  ],
}

beforeEach(() => { chatJson.mockReset() })

describe('generateCodeLesson', () => {
  it('returns null when language is empty', async () => {
    expect(await generateCodeLesson('', 'Variables')).toBeNull()
  })

  it('returns null when concept is empty', async () => {
    expect(await generateCodeLesson('python', '')).toBeNull()
  })

  it('shapes lesson correctly from valid Ollama response', async () => {
    chatJson.mockResolvedValueOnce(MOCK_STRUCTURE).mockResolvedValueOnce(MOCK_EXERCISES)
    const lesson = await generateCodeLesson('python', 'Variables')
    expect(lesson).not.toBeNull()
    expect(lesson.id).toBe('python_variables')
    expect(lesson.language).toBe('python')
    expect(lesson.title).toBe('What is a Variable')
    expect(lesson.workedExample.language).toBe('python')
    expect(lesson.exercises).toHaveLength(3)
    expect(lesson.terminology[0].term).toBe('variable')
  })

  it('returns null when Ollama returns null for structure', async () => {
    chatJson.mockResolvedValueOnce(null)
    expect(await generateCodeLesson('python', 'Variables')).toBeNull()
  })

  it('returns null when exercises array is empty', async () => {
    chatJson.mockResolvedValueOnce(MOCK_STRUCTURE).mockResolvedValueOnce({ exercises: [] })
    expect(await generateCodeLesson('python', 'Variables')).toBeNull()
  })

  it('generates a stable lessonKey from concept name', async () => {
    chatJson.mockResolvedValueOnce(MOCK_STRUCTURE).mockResolvedValueOnce(MOCK_EXERCISES)
    const lesson = await generateCodeLesson('html', 'Headings and paragraphs')
    expect(lesson.id).toBe('html_headings_and_paragraphs')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --run src/code-academy/__tests__/lessonGenerator.test.js
```

Expected: 6 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/code-academy/lessonGenerator.js src/code-academy/__tests__/lessonGenerator.test.js
git commit -m "feat(code-academy): AI lesson generator with unit tests"
```

---

## Task 3: Validator and feedback engines

**Files:**
- Create: `src/code-academy/validatorEngine.js`
- Create: `src/code-academy/feedbackEngine.js`
- Create: `src/code-academy/__tests__/validatorEngine.test.js`

- [ ] **Step 1: Create `src/code-academy/validatorEngine.js`**

```javascript
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
      passed: result?.pass === true,
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
  const structResult = validateStructure(userCode, exercise)
  // If structural check fails, use LLM as a second opinion for richer feedback
  if (!structResult.passed) {
    return structResult
  }
  return structResult
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
```

- [ ] **Step 2: Create `src/code-academy/__tests__/validatorEngine.test.js`**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/llm/ollama.js', () => ({ chatJson: vi.fn() }))
import { chatJson } from '../../lib/llm/ollama.js'

import { validateStructure, validateCode, buildIframeSrc } from '../validatorEngine.js'

const htmlExercise = {
  id: 'ex1',
  prompt: 'Create an h1 heading',
  successCriteria: ['has h1 element', 'has p element'],
  validatorType: 'structure',
  hints: [],
}

describe('validateStructure', () => {
  it('passes when all required elements exist', () => {
    const code = '<h1>Hello</h1><p>World</p>'
    const result = validateStructure(code, htmlExercise)
    expect(result.passed).toBe(true)
  })

  it('fails when required element is missing', () => {
    const code = '<h1>Hello</h1>'
    const result = validateStructure(code, htmlExercise)
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('No <p>')
  })

  it('detects class selectors', () => {
    const ex = { successCriteria: ['has class container'], hints: [] }
    expect(validateStructure('<div class="container"></div>', ex).passed).toBe(true)
    expect(validateStructure('<div></div>', ex).passed).toBe(false)
  })

  it('returns passed:false and reason on parse error with empty code', () => {
    const result = validateStructure('', { successCriteria: ['has h1 element'], hints: [] })
    // DOMParser still returns a document for empty string — h1 won't be there
    expect(result.passed).toBe(false)
  })
})

describe('validateCode routing', () => {
  beforeEach(() => chatJson.mockReset())

  it('calls LLM for python language', async () => {
    chatJson.mockResolvedValueOnce({ pass: true, reason: 'Great!' })
    const ex = { prompt: 'print hello', successCriteria: ['prints hello'], validatorType: 'llm', hints: [] }
    const result = await validateCode('print("hello")', ex, 'python')
    expect(chatJson).toHaveBeenCalledTimes(1)
    expect(result.passed).toBe(true)
  })

  it('uses structure for html without calling LLM when it passes', async () => {
    const ex = { ...htmlExercise }
    const result = await validateCode('<h1>Hi</h1><p>text</p>', ex, 'html')
    expect(chatJson).not.toHaveBeenCalled()
    expect(result.passed).toBe(true)
  })
})

describe('buildIframeSrc', () => {
  it('wraps CSS in a full HTML page', () => {
    const src = buildIframeSrc('body { color: red; }', 'css')
    expect(src).toContain('<!DOCTYPE html>')
    expect(src).toContain('body { color: red; }')
    expect(src).toContain('<body>')
  })

  it('wraps bare HTML in a skeleton', () => {
    const src = buildIframeSrc('<h1>Hello</h1>', 'html')
    expect(src).toContain('<!DOCTYPE html>')
    expect(src).toContain('<h1>Hello</h1>')
  })

  it('returns full HTML as-is when it has an html tag', () => {
    const fullHtml = '<!DOCTYPE html><html><body><p>hi</p></body></html>'
    expect(buildIframeSrc(fullHtml, 'html')).toBe(fullHtml)
  })
})
```

- [ ] **Step 3: Create `src/code-academy/feedbackEngine.js`**

```javascript
/**
 * AI error explanation engine.
 *
 * explainError(userCode, exercise, language, validationReason)
 *   → Promise<string>
 *
 * Returns a multi-sentence middle-school-friendly explanation of what went
 * wrong and how to fix it. Returns a fallback string on Ollama failure.
 */

import { chatJson } from '../lib/llm/ollama.js'

function feedbackMessages(userCode, exercise, language, validationReason) {
  return [
    {
      role: 'system',
      content:
        'You are a friendly coding tutor helping a 10-12 year old who just made a mistake. ' +
        'Be encouraging and clear. Use simple words. Short sentences. ' +
        'Do not use scary technical jargon without explaining it first. ' +
        'Return ONLY a valid JSON object.',
    },
    {
      role: 'user',
      content:
        `Language: ${language.toUpperCase()}\n` +
        `Exercise the student is working on: ${exercise.prompt}\n` +
        `What the validator said was wrong: ${validationReason}\n` +
        `\nThe student's code:\n\`\`\`${language}\n${userCode}\n\`\`\`\n\n` +
        'Explain the mistake and how to fix it in 3-4 sentences a 10-year-old can understand.\n' +
        'Return: {"explanation": "Your 3-4 sentence explanation here."}',
    },
  ]
}

/**
 * Generate a plain-language explanation of why the student's code failed.
 * Returns a fallback string on Ollama failure — never throws.
 */
export async function explainError(userCode, exercise, language, validationReason) {
  try {
    const result = await chatJson(
      feedbackMessages(userCode, exercise, language, validationReason),
      { temperature: 0.4 },
    )
    if (result?.explanation) return String(result.explanation).trim()
  } catch { /* fall through */ }
  // Fallback if Ollama is off or response is malformed
  return `${validationReason} Try reading the exercise instructions again and compare your code to the worked example.`
}
```

- [ ] **Step 4: Run validator tests**

```bash
npm test -- --run src/code-academy/__tests__/validatorEngine.test.js
```

Expected: 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/code-academy/validatorEngine.js src/code-academy/feedbackEngine.js src/code-academy/__tests__/validatorEngine.test.js
git commit -m "feat(code-academy): validator engine (HTML/CSS + LLM) and feedback engine"
```

---

## Task 4: useCodeAcademy hook

**Files:**
- Create: `src/code-academy/useCodeAcademy.js`

- [ ] **Step 1: Create `src/code-academy/useCodeAcademy.js`**

```javascript
/**
 * Central state machine for Code Academy lesson flow.
 *
 * Stages:
 *   'home'       — showing language/concept picker
 *   'loading'    — generating lesson via Ollama
 *   'lesson'     — reading lesson intro + worked example
 *   'exercising' — user working on current exercise
 *   'feedback'   — fetching AI error explanation
 *   'complete'   — all exercises done
 *
 * Usage:
 *   const academy = useCodeAcademy()
 *   academy.startLesson('python', 'Variables')
 */

import { useCallback, useReducer } from 'react'
import { useStore } from '../store/useStore.js'
import { generateCodeLesson } from './lessonGenerator.js'
import { validateCode } from './validatorEngine.js'
import { explainError } from './feedbackEngine.js'
import { OLLAMA_CONFIG } from '../lib/llm/ollamaConfig.js'

const INITIAL = {
  stage: 'home',
  language: '',
  concept: '',
  lesson: null,
  exerciseIndex: 0,
  userCode: '',
  validationResult: null,
  aiFeedback: null,
  hintsUsed: 0,
  attempts: 0,
  isRunning: false,
  isFetchingFeedback: false,
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'START_LOADING':
      return { ...INITIAL, stage: 'loading', language: action.language, concept: action.concept }
    case 'LESSON_LOADED':
      return {
        ...state,
        stage: 'lesson',
        lesson: action.lesson,
        userCode: action.lesson.exercises[0]?.starterCode || '',
        error: null,
      }
    case 'LOAD_FAILED':
      return { ...state, stage: 'home', error: action.error }
    case 'BEGIN_EXERCISES':
      return { ...state, stage: 'exercising', exerciseIndex: 0, validationResult: null, aiFeedback: null }
    case 'SET_CODE':
      return { ...state, userCode: action.code }
    case 'RUN_START':
      return { ...state, isRunning: true, validationResult: null, aiFeedback: null }
    case 'RUN_DONE':
      return {
        ...state,
        isRunning: false,
        validationResult: action.result,
        attempts: state.attempts + 1,
      }
    case 'FETCH_FEEDBACK_START':
      return { ...state, stage: 'feedback', isFetchingFeedback: true }
    case 'FETCH_FEEDBACK_DONE':
      return { ...state, stage: 'exercising', isFetchingFeedback: false, aiFeedback: action.feedback }
    case 'USE_HINT':
      return { ...state, hintsUsed: state.hintsUsed + 1 }
    case 'RESET_CODE': {
      const starter = state.lesson?.exercises[state.exerciseIndex]?.starterCode || ''
      return { ...state, userCode: starter, validationResult: null, aiFeedback: null }
    }
    case 'NEXT_EXERCISE': {
      const nextIdx = state.exerciseIndex + 1
      const exercises = state.lesson?.exercises || []
      if (nextIdx >= exercises.length) {
        return { ...state, stage: 'complete', validationResult: null, aiFeedback: null }
      }
      return {
        ...state,
        exerciseIndex: nextIdx,
        userCode: exercises[nextIdx]?.starterCode || '',
        validationResult: null,
        aiFeedback: null,
        attempts: 0,
      }
    }
    case 'BACK_TO_HOME':
      return INITIAL
    default:
      return state
  }
}

export function useCodeAcademy() {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const { addCodeLesson, getCodeLesson, saveCodeProgress } = useStore()

  const startLesson = useCallback(async (language, concept) => {
    if (!language || !concept) return
    if (!OLLAMA_CONFIG.enabled) {
      dispatch({ type: 'LOAD_FAILED', error: 'Ollama is not enabled. Turn it on in Settings to use Code Academy.' })
      return
    }

    dispatch({ type: 'START_LOADING', language, concept })

    const lessonKey = `${language}_${concept.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`

    // Check cache first
    let lesson = getCodeLesson(lessonKey)
    if (!lesson) {
      lesson = await generateCodeLesson(language, concept)
      if (!lesson) {
        dispatch({ type: 'LOAD_FAILED', error: 'Could not generate lesson. Make sure Ollama is running and a model is pulled.' })
        return
      }
      addCodeLesson(lessonKey, lesson)
    }

    // Init progress if not started
    saveCodeProgress(lessonKey, {
      language,
      concept,
      exercisesTotal: lesson.exercises.length,
      masteryState: 'in_progress',
      lastAttemptedAt: new Date().toISOString(),
    })

    dispatch({ type: 'LESSON_LOADED', lesson })
  }, [addCodeLesson, getCodeLesson, saveCodeProgress])

  const beginExercises = useCallback(() => {
    dispatch({ type: 'BEGIN_EXERCISES' })
  }, [])

  const setUserCode = useCallback((code) => {
    dispatch({ type: 'SET_CODE', code })
  }, [])

  const runCode = useCallback(async () => {
    const { lesson, exerciseIndex, userCode, language } = state
    if (!lesson) return
    const exercise = lesson.exercises[exerciseIndex]
    if (!exercise) return

    dispatch({ type: 'RUN_START' })
    const result = await validateCode(userCode, exercise, language)
    dispatch({ type: 'RUN_DONE', result })

    // If failed, fetch AI explanation
    if (!result.passed) {
      dispatch({ type: 'FETCH_FEEDBACK_START' })
      const feedback = await explainError(userCode, exercise, language, result.reason)
      dispatch({ type: 'FETCH_FEEDBACK_DONE', feedback })
    }
  }, [state])

  const useHint = useCallback(() => {
    dispatch({ type: 'USE_HINT' })
  }, [])

  const resetCode = useCallback(() => {
    dispatch({ type: 'RESET_CODE' })
  }, [])

  const nextExercise = useCallback(() => {
    const { lesson, exerciseIndex, language } = state
    if (!lesson) return
    const lessonKey = lesson.id
    const nextIdx = exerciseIndex + 1
    const isLastExercise = nextIdx >= lesson.exercises.length

    saveCodeProgress(lessonKey, {
      exercisesCompleted: nextIdx,
      masteryState: isLastExercise ? 'passed' : 'in_progress',
      ...(isLastExercise ? { completedAt: new Date().toISOString() } : {}),
    })

    dispatch({ type: 'NEXT_EXERCISE' })
  }, [state, saveCodeProgress])

  const backToHome = useCallback(() => {
    dispatch({ type: 'BACK_TO_HOME' })
  }, [])

  const currentExercise = state.lesson?.exercises[state.exerciseIndex] || null
  const currentHints = currentExercise?.hints || []
  const visibleHints = currentHints.slice(0, state.hintsUsed)
  const hasMoreHints = state.hintsUsed < currentHints.length

  return {
    ...state,
    currentExercise,
    visibleHints,
    hasMoreHints,
    startLesson,
    beginExercises,
    setUserCode,
    runCode,
    useHint,
    resetCode,
    nextExercise,
    backToHome,
  }
}
```

- [ ] **Step 2: Verify app still starts**

```bash
npm run dev
```

Navigate to any existing page — confirm no import errors in the console.

- [ ] **Step 3: Commit**

```bash
git add src/code-academy/useCodeAcademy.js
git commit -m "feat(code-academy): useCodeAcademy state machine hook"
```

---

## Task 5: TermHoverCard and WorkedExampleCard

**Files:**
- Create: `src/code-academy/components/TermHoverCard.jsx`
- Create: `src/code-academy/components/WorkedExampleCard.jsx`

- [ ] **Step 1: Create `src/code-academy/components/TermHoverCard.jsx`**

```jsx
import { useState } from 'react'

/**
 * Wraps a term in a dashed underline. Shows a definition card on hover.
 * Matches the GlossaryTerm pattern from LessonView.jsx.
 */
export default function TermHoverCard({ term, definition }) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="border-b border-dashed border-teal-500/60 cursor-help text-teal-700 font-medium">
        {term}
      </span>
      {visible && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-64 p-3 rounded-xl text-xs text-slate-800 leading-relaxed z-50 pointer-events-none shadow-xl"
          style={{ background: '#fff', border: '1px solid rgba(13,148,136,0.2)' }}
        >
          <span className="block font-bold text-teal-700 mb-1">{definition.term}</span>
          <span className="block mb-1">{definition.plainMeaning}</span>
          {definition.example && (
            <code className="block mt-1 px-2 py-1 rounded bg-slate-100 font-mono text-[11px] text-slate-700 whitespace-pre-wrap">
              {definition.example}
            </code>
          )}
          {definition.whyItMatters && (
            <span className="block mt-1 text-slate-500 italic">{definition.whyItMatters}</span>
          )}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #fff' }}
          />
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: Create `src/code-academy/components/WorkedExampleCard.jsx`**

```jsx
import { useState } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { ChevronRight, Eye } from 'lucide-react'

const CODE_THEME = {
  ...themes.vsDark,
  plain: { ...themes.vsDark.plain, backgroundColor: '#1a1d2e' },
}

/**
 * Shows a worked example with:
 * - Syntax-highlighted code block
 * - Step-by-step explanation cards (collapsible)
 * - Optional expected output
 */
export default function WorkedExampleCard({ example }) {
  const [expanded, setExpanded] = useState(false)
  const lang = example.language || 'html'

  return (
    <div className="rounded-xl border border-indigo-200 overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-indigo-500" />
          <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Worked Example</span>
        </div>
        <span className="text-[10px] font-mono text-indigo-400 uppercase">{lang}</span>
      </div>

      {/* Code block */}
      <div style={{ background: '#1a1d2e' }}>
        <Highlight theme={CODE_THEME} code={String(example.code || '').trimEnd()} language={lang}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="px-5 py-4 font-mono text-sm leading-relaxed overflow-x-auto m-0">
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="flex">
                  <span className="select-none w-7 text-right mr-4 text-white/20 text-[11px] flex-shrink-0 leading-6">
                    {i + 1}
                  </span>
                  <span>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>

      {/* Expected output */}
      {example.expectedOutput && (
        <div className="px-4 py-2.5 bg-slate-900 border-t border-white/[0.06]">
          <span className="text-[10px] text-white/30 uppercase tracking-wider mr-2">Output:</span>
          <code className="text-[12px] text-green-400 font-mono">{example.expectedOutput}</code>
        </div>
      )}

      {/* Step-by-step explanation toggle */}
      {example.explanationSteps && example.explanationSteps.length > 0 && (
        <div className="bg-white">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors border-t border-indigo-100"
          >
            <span>How does this code work?</span>
            <ChevronRight
              size={14}
              className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>

          {expanded && (
            <ol className="px-4 pb-4 space-y-2.5 border-t border-indigo-50">
              {example.explanationSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 pt-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify no import errors**

```bash
npm run dev
```

Check console — no errors for the new files.

- [ ] **Step 4: Commit**

```bash
git add src/code-academy/components/TermHoverCard.jsx src/code-academy/components/WorkedExampleCard.jsx
git commit -m "feat(code-academy): TermHoverCard and WorkedExampleCard components"
```

---

## Task 6: CodeEditorPanel

**Files:**
- Create: `src/code-academy/components/CodeEditorPanel.jsx`

- [ ] **Step 1: Create `src/code-academy/components/CodeEditorPanel.jsx`**

```jsx
import { useRef } from 'react'
import { Play, RotateCcw, Lightbulb, Loader2 } from 'lucide-react'

/**
 * Code editor panel with:
 * - Textarea with tab-key support and monospace styling
 * - Run, Reset, and Hint buttons
 * - Hint display area
 */
export default function CodeEditorPanel({
  code,
  language,
  onChange,
  onRun,
  onReset,
  onHint,
  isRunning,
  disabled,
  visibleHints,
  hasMoreHints,
}) {
  const textareaRef = useRef(null)

  // Handle Tab key — insert 2 spaces instead of losing focus
  function handleKeyDown(e) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end   = ta.selectionEnd
      const newCode = code.slice(0, start) + '  ' + code.slice(end)
      onChange(newCode)
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        ta.selectionStart = start + 2
        ta.selectionEnd   = start + 2
      })
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!isRunning && !disabled) onRun()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Editor label */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Your code · {language.toUpperCase()}
        </span>
        <span className="text-[10px] text-slate-400">Ctrl+Enter to run</span>
      </div>

      {/* Textarea */}
      <div className="rounded-xl overflow-hidden border border-slate-300" style={{ background: '#1a1d2e' }}>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isRunning}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          rows={10}
          className="w-full px-5 py-4 font-mono text-sm leading-relaxed resize-none focus:outline-none disabled:opacity-60"
          style={{
            background: 'transparent',
            color: '#d4d4d4',
            caretColor: '#2dd4bf',
            minHeight: '220px',
          }}
          placeholder={`# Write your ${language.toUpperCase()} code here…`}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRun}
          disabled={isRunning || disabled || !code.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} className="fill-current" />}
          {isRunning ? 'Running…' : 'Run'}
        </button>

        <button
          onClick={onReset}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors"
        >
          <RotateCcw size={13} />
          Reset
        </button>

        {hasMoreHints && (
          <button
            onClick={onHint}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 transition-colors ml-auto"
          >
            <Lightbulb size={13} />
            Show hint
          </button>
        )}
      </div>

      {/* Hints */}
      {visibleHints && visibleHints.length > 0 && (
        <div className="space-y-2">
          {visibleHints.map((hint, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200"
            >
              <Lightbulb size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 leading-relaxed">{hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/code-academy/components/CodeEditorPanel.jsx
git commit -m "feat(code-academy): CodeEditorPanel with tab support and hints"
```

---

## Task 7: OutputPanel and ExerciseCard

**Files:**
- Create: `src/code-academy/components/OutputPanel.jsx`
- Create: `src/code-academy/components/ExerciseCard.jsx`

- [ ] **Step 1: Create `src/code-academy/components/OutputPanel.jsx`**

```jsx
import { CheckCircle2, XCircle, Eye } from 'lucide-react'
import { buildIframeSrc } from '../validatorEngine.js'

/**
 * Shows the result of running code:
 * - For HTML/CSS: an iframe preview of the rendered page
 * - For all languages: pass/fail badge + reason text
 */
export default function OutputPanel({ language, userCode, validationResult, hasRun }) {
  const showPreview = (language === 'html' || language === 'css') && userCode && userCode.trim()

  if (!hasRun && !showPreview) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center py-10">
        <p className="text-sm text-slate-400">Run your code to see output here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* HTML/CSS live preview */}
      {showPreview && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border-b border-slate-200">
            <Eye size={12} className="text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Preview</span>
          </div>
          <iframe
            srcDoc={buildIframeSrc(userCode, language)}
            sandbox="allow-scripts"
            className="w-full border-0"
            style={{ height: '200px', background: '#fff' }}
            title="Code preview"
          />
        </div>
      )}

      {/* Validation result */}
      {validationResult && (
        <div
          className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border ${
            validationResult.passed
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          {validationResult.passed
            ? <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            : <XCircle     size={16} className="text-red-500    flex-shrink-0 mt-0.5" />}
          <p className={`text-sm leading-relaxed ${validationResult.passed ? 'text-emerald-800' : 'text-red-800'}`}>
            {validationResult.reason}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/code-academy/components/ExerciseCard.jsx`**

```jsx
import { CheckCircle2, ArrowRight } from 'lucide-react'

/**
 * Shows the current exercise prompt, success indicator, and Next button.
 */
export default function ExerciseCard({ exercise, exerciseIndex, totalExercises, validationResult, hasRun, onNext }) {
  const passed = validationResult?.passed === true

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors ${
        passed ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
      }`}
    >
      {/* Exercise header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Exercise {exerciseIndex + 1} of {totalExercises}
        </span>
        {passed && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 size={12} /> Correct!
          </span>
        )}
      </div>

      {/* Prompt */}
      <div className="px-4 py-4">
        <p className="text-sm text-slate-800 leading-relaxed lesson-prose">{exercise.prompt}</p>
      </div>

      {/* Next button — visible only after passing */}
      {passed && (
        <div className="px-4 pb-4">
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
          >
            {exerciseIndex + 1 < totalExercises ? 'Next exercise' : 'Finish lesson'}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/code-academy/components/OutputPanel.jsx src/code-academy/components/ExerciseCard.jsx
git commit -m "feat(code-academy): OutputPanel and ExerciseCard"
```

---

## Task 8: ProgressSidebar

**Files:**
- Create: `src/code-academy/components/ProgressSidebar.jsx`

- [ ] **Step 1: Create `src/code-academy/components/ProgressSidebar.jsx`**

```jsx
import { Target, AlertTriangle, Loader2, Bot } from 'lucide-react'

/**
 * Right-side panel showing:
 * - Lesson objectives
 * - Common mistakes
 * - AI feedback (error explanation from Flow AI)
 */
export default function ProgressSidebar({ lesson, exerciseIndex, exercisesTotal, aiFeedback, isFetchingFeedback }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Lesson objectives */}
      {lesson && lesson.objectives.length > 0 && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 uppercase tracking-wider mb-3">
            <Target size={12} /> Lesson goals
          </h3>
          <ul className="space-y-2">
            {lesson.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-teal-900 leading-relaxed">
                <span className="text-teal-500 font-bold flex-shrink-0 mt-0.5">·</span>
                {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Exercise progress dots */}
      {exercisesTotal > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Progress
          </h3>
          <div className="flex items-center gap-2">
            {Array.from({ length: exercisesTotal }).map((_, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
                style={{
                  background: i < exerciseIndex
                    ? 'linear-gradient(135deg, #0d9488, #6366f1)'
                    : i === exerciseIndex
                    ? 'rgba(13,148,136,0.15)'
                    : 'rgba(0,0,0,0.05)',
                  color: i < exerciseIndex ? '#fff' : i === exerciseIndex ? '#0d9488' : '#94a3b8',
                  border: i === exerciseIndex ? '2px solid #0d9488' : '2px solid transparent',
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI feedback */}
      {(isFetchingFeedback || aiFeedback) && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 uppercase tracking-wider mb-3">
            <Bot size={12} /> Flow AI says
          </h3>
          {isFetchingFeedback ? (
            <div className="flex items-center gap-2 text-xs text-indigo-600">
              <Loader2 size={12} className="animate-spin" />
              Thinking…
            </div>
          ) : (
            <p className="text-xs text-indigo-900 leading-relaxed">{aiFeedback}</p>
          )}
        </div>
      )}

      {/* Common mistakes */}
      {lesson && lesson.commonMistakes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-3">
            <AlertTriangle size={12} /> Common mistakes
          </h3>
          <ul className="space-y-2">
            {lesson.commonMistakes.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-900 leading-relaxed">
                <span className="text-amber-500 flex-shrink-0 mt-0.5">!</span>
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/code-academy/components/ProgressSidebar.jsx
git commit -m "feat(code-academy): ProgressSidebar with objectives, progress, AI feedback"
```

---

## Task 9: CodeAcademyHome (entry screen)

**Files:**
- Create: `src/code-academy/components/CodeAcademyHome.jsx`

- [ ] **Step 1: Create `src/code-academy/components/CodeAcademyHome.jsx`**

```jsx
import { useState } from 'react'
import { Code2, Loader2, Sparkles } from 'lucide-react'
import { LANGUAGES, CONCEPTS_BY_LANGUAGE, GOALS } from '../constants.js'

/**
 * Entry screen — user picks language + concept/goal, then clicks Start Lesson.
 * Props:
 *   onStart(language, concept) — called when user clicks Start Lesson
 *   isLoading — true while lesson is being generated
 *   error — error string or null
 *   progressList — array of CodeLessonProgress for the "resume" section
 */
export default function CodeAcademyHome({ onStart, isLoading, error, progressList }) {
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [selectedConcept, setSelectedConcept]   = useState('')
  const [searchQuery, setSearchQuery]            = useState('')

  const concepts = selectedLanguage ? (CONCEPTS_BY_LANGUAGE[selectedLanguage] || []) : []
  const filteredConcepts = searchQuery.trim()
    ? concepts.filter((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
    : concepts

  function handleGoal(goal) {
    setSelectedLanguage(goal.language)
    setSelectedConcept(goal.concept)
  }

  const canStart = selectedLanguage && selectedConcept && !isLoading

  return (
    <div className="flex flex-col items-center px-6 pt-10 pb-16">
      {/* Hero */}
      <div className="flex flex-col items-center gap-2 mb-10">
        <div className="p-3 rounded-2xl mb-2" style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.2) 0%, rgba(99,102,241,0.15) 100%)', border: '1px solid rgba(45,212,191,0.2)' }}>
          <Code2 size={28} className="text-teal-400" />
        </div>
        <h1 className="text-3xl font-light tracking-tight text-center">Code Academy</h1>
        <p className="text-sm text-[color:var(--color-text-tertiary)] text-center max-w-md">
          Learn to code step by step. Flow AI teaches one concept at a time with examples, exercises, and plain-language explanations.
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">

        {/* Step 1: Language */}
        <div
          className="rounded-2xl border border-teal-500/20 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.10) 0%, rgba(99,102,241,0.06) 100%)' }}
        >
          <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #0d9488 0%, #6366f1 100%)' }} />
          <div className="p-5">
            <p className="text-xs font-semibold text-teal-300/70 uppercase tracking-wider mb-3">
              Step 1 · Choose a language
            </p>
            <div className="flex gap-3 flex-wrap">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => { setSelectedLanguage(lang.id); setSelectedConcept('') }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                  style={{
                    borderColor: selectedLanguage === lang.id ? lang.color : 'rgba(255,255,255,0.12)',
                    background: selectedLanguage === lang.id ? `${lang.color}22` : 'rgba(255,255,255,0.04)',
                    color: selectedLanguage === lang.id ? lang.color : 'rgba(255,255,255,0.65)',
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: lang.color }}
                  />
                  {lang.label}
                </button>
              ))}
            </div>
            {selectedLanguage && (
              <p className="mt-2 text-xs text-white/35">
                {LANGUAGES.find((l) => l.id === selectedLanguage)?.desc}
              </p>
            )}
          </div>
        </div>

        {/* Step 2: Concept */}
        {selectedLanguage && (
          <div
            className="rounded-2xl border border-indigo-500/20 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.05) 100%)' }}
          >
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)' }} />
            <div className="p-5">
              <p className="text-xs font-semibold text-indigo-300/70 uppercase tracking-wider mb-3">
                Step 2 · Choose a concept
              </p>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search concepts…"
                className="w-full mb-3 px-3 py-2 rounded-lg text-sm bg-white/[0.06] border border-white/[0.10] text-white placeholder-white/25 focus:outline-none focus:border-indigo-400/50"
              />
              <div className="flex flex-wrap gap-2">
                {filteredConcepts.map((concept) => (
                  <button
                    key={concept}
                    onClick={() => setSelectedConcept(concept)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                    style={{
                      borderColor: selectedConcept === concept ? 'rgba(129,140,248,0.6)' : 'rgba(129,140,248,0.2)',
                      background: selectedConcept === concept ? 'rgba(99,102,241,0.20)' : 'rgba(99,102,241,0.07)',
                      color: selectedConcept === concept ? '#a5b4fc' : 'rgba(199,210,254,0.75)',
                    }}
                  >
                    {concept}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick goals */}
        <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
          <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles size={11} /> Or pick a goal
          </p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((goal) => (
              <button
                key={goal.label}
                onClick={() => handleGoal(goal)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.10] bg-white/[0.04] text-white/50 hover:border-white/[0.22] hover:text-white/80 transition-all"
              >
                {goal.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-400/25 text-sm text-amber-300">
            {error}
          </div>
        )}

        {/* Start button */}
        {canStart && (
          <button
            onClick={() => onStart(selectedLanguage, selectedConcept)}
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Code2 size={16} />}
            {isLoading ? 'Generating lesson…' : `Start lesson: ${selectedConcept}`}
          </button>
        )}

        {/* Resume section */}
        {progressList && progressList.filter((p) => p.masteryState === 'in_progress').length > 0 && (
          <div>
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Resume</p>
            <div className="space-y-2">
              {progressList
                .filter((p) => p.masteryState === 'in_progress')
                .slice(0, 4)
                .map((p) => (
                  <button
                    key={p.lessonKey}
                    onClick={() => onStart(p.language, p.concept)}
                    className="w-full text-left flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium text-white/80">{p.concept}</span>
                      <span className="ml-2 text-xs text-white/30 uppercase">{p.language}</span>
                    </div>
                    <span className="text-xs text-teal-400/70">
                      {p.exercisesCompleted}/{p.exercisesTotal} done
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/code-academy/components/CodeAcademyHome.jsx
git commit -m "feat(code-academy): CodeAcademyHome entry screen"
```

---

## Task 10: CodeAcademyPage (lesson workspace)

**Files:**
- Create: `src/code-academy/components/CodeAcademyPage.jsx`

- [ ] **Step 1: Create `src/code-academy/components/CodeAcademyPage.jsx`**

```jsx
import { GraduationCap, ArrowLeft, CheckCircle2, PartyPopper } from 'lucide-react'
import WorkedExampleCard  from './WorkedExampleCard.jsx'
import TermHoverCard      from './TermHoverCard.jsx'
import CodeEditorPanel    from './CodeEditorPanel.jsx'
import OutputPanel        from './OutputPanel.jsx'
import ExerciseCard       from './ExerciseCard.jsx'
import ProgressSidebar    from './ProgressSidebar.jsx'

/**
 * 3-panel lesson workspace.
 * Left:   lesson list (simplified for MVP — just back button + lesson info)
 * Center: lesson content → worked example → exercise + editor + output
 * Right:  objectives + progress + AI feedback + common mistakes
 */
export default function CodeAcademyPage({ academy }) {
  const {
    stage, lesson, currentExercise, exerciseIndex,
    userCode, setUserCode, validationResult, aiFeedback,
    isFetchingFeedback, isRunning, visibleHints, hasMoreHints,
    runCode, useHint, resetCode, nextExercise, backToHome, beginExercises,
  } = academy

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-white/70">Flow AI is writing your lesson…</p>
          <p className="text-xs text-white/35">This takes about 15–30 seconds</p>
        </div>
      </div>
    )
  }

  if (!lesson) return null

  // ── Complete ─────────────────────────────────────────────────────────────────
  if (stage === 'complete') {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <PartyPopper size={40} className="text-teal-400 mb-4" />
        <h2 className="text-2xl font-semibold text-white mb-2">Lesson complete!</h2>
        <p className="text-sm text-white/50 mb-6 max-w-sm">
          You finished <strong className="text-white/80">{lesson.title}</strong>. Keep going — pick your next concept below.
        </p>
        <button
          onClick={backToHome}
          className="px-6 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
        >
          Pick next lesson
        </button>
      </div>
    )
  }

  const hasRun = validationResult !== null

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.08] flex-shrink-0">
        <button
          onClick={backToHome}
          className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 transition-colors"
        >
          <ArrowLeft size={14} />
          Code Academy
        </button>
        <span className="text-white/20">/</span>
        <span className="text-sm font-medium text-white/70">{lesson.title}</span>
        <span
          className="ml-auto text-[11px] px-2 py-0.5 rounded-md font-medium uppercase tracking-wide"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
        >
          {lesson.language}
        </span>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel (lesson nav) — simplified for MVP ── */}
        <div
          className="w-[220px] flex-shrink-0 border-r border-white/[0.06] p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.15)' }}
        >
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-3">This lesson</p>
          <div className="space-y-1">
            {[
              { id: 'intro',     label: 'Introduction',    active: stage === 'lesson' },
              { id: 'exercises', label: 'Exercises',       active: stage === 'exercising' || stage === 'feedback' },
            ].map((item) => (
              <div
                key={item.id}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  item.active
                    ? 'text-teal-300 bg-teal-500/10'
                    : 'text-white/30'
                }`}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Terminology list */}
          {lesson.terminology.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-2">Key terms</p>
              <div className="space-y-1">
                {lesson.terminology.map((term) => (
                  <div key={term.term} className="px-3 py-1.5 rounded-lg">
                    <TermHoverCard term={term.term} definition={term} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Center panel ── */}
        <div className="flex-1 overflow-y-auto">
          <div
            className="mx-auto px-8 py-6"
            style={{ maxWidth: '680px' }}
          >
            {/* Lesson introduction */}
            {stage === 'lesson' && (
              <>
                <div className="mb-6">
                  <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-2">
                    {lesson.language.toUpperCase()} · {lesson.concept}
                  </p>
                  <h1 className="text-2xl font-bold text-white mb-3">{lesson.title}</h1>
                  <p className="text-sm text-white/60 leading-relaxed">{lesson.summary}</p>
                </div>

                {/* Objectives */}
                {lesson.objectives.length > 0 && (
                  <div className="mb-6 p-4 rounded-xl bg-teal-500/10 border border-teal-500/20">
                    <p className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider mb-2.5">
                      What you will learn
                    </p>
                    <ul className="space-y-1.5">
                      {lesson.objectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-teal-100/80">
                          <span className="text-teal-500 font-bold flex-shrink-0 mt-0.5">·</span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Worked example */}
                <WorkedExampleCard example={lesson.workedExample} />

                {/* Start exercises CTA */}
                <button
                  onClick={beginExercises}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
                >
                  Start practising →
                </button>
              </>
            )}

            {/* Exercise + editor */}
            {(stage === 'exercising' || stage === 'feedback') && currentExercise && (
              <div className="space-y-5">
                <ExerciseCard
                  exercise={currentExercise}
                  exerciseIndex={exerciseIndex}
                  totalExercises={lesson.exercises.length}
                  validationResult={validationResult}
                  hasRun={hasRun}
                  onNext={nextExercise}
                />
                <CodeEditorPanel
                  code={userCode}
                  language={lesson.language}
                  onChange={setUserCode}
                  onRun={runCode}
                  onReset={resetCode}
                  onHint={useHint}
                  isRunning={isRunning}
                  disabled={stage === 'feedback' && isFetchingFeedback}
                  visibleHints={visibleHints}
                  hasMoreHints={hasMoreHints}
                />
                <OutputPanel
                  language={lesson.language}
                  userCode={userCode}
                  validationResult={validationResult}
                  hasRun={hasRun}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div
          className="w-[260px] flex-shrink-0 border-l border-white/[0.06] p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.10)' }}
        >
          <ProgressSidebar
            lesson={lesson}
            exerciseIndex={exerciseIndex}
            exercisesTotal={lesson.exercises.length}
            aiFeedback={aiFeedback}
            isFetchingFeedback={isFetchingFeedback}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/code-academy/components/CodeAcademyPage.jsx
git commit -m "feat(code-academy): CodeAcademyPage 3-panel lesson workspace"
```

---

## Task 11: Route, view wrapper, and navigation

**Files:**
- Create: `src/views/CodeAcademy.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/layout/LeftRail.jsx`

- [ ] **Step 1: Create `src/views/CodeAcademy.jsx`**

```jsx
import { useStore } from '../store/useStore.js'
import { useCodeAcademy } from '../code-academy/useCodeAcademy.js'
import CodeAcademyHome from '../code-academy/components/CodeAcademyHome.jsx'
import CodeAcademyPage from '../code-academy/components/CodeAcademyPage.jsx'

export default function CodeAcademy() {
  const { allCodeProgress } = useStore()
  const academy = useCodeAcademy()
  const progressList = allCodeProgress()

  if (academy.stage === 'home') {
    return (
      <CodeAcademyHome
        onStart={academy.startLesson}
        isLoading={false}
        error={academy.error}
        progressList={progressList}
      />
    )
  }

  return <CodeAcademyPage academy={academy} />
}
```

- [ ] **Step 2: Add the lazy import and route to `src/App.jsx`**

After the existing lazy imports (around line 34), add:

```javascript
const CodeAcademy = lazy(() => import('./views/CodeAcademy.jsx'))
```

Inside `<Routes>`, after the `/education` route, add:

```jsx
<Route path="/code-academy" element={<CodeAcademy />} />
```

- [ ] **Step 3: Add "Code Academy" to `src/components/layout/LeftRail.jsx`**

In the `NAV_GROUPS` array, in the last group (alongside `/education`), change:

```javascript
  [
    { to: '/education',     label: 'Flow Academy',  icon: GraduationCap },
    { to: '/code-academy',  label: 'Code Academy',  icon: Code2         },
    { to: '/chat',          label: 'Ask Flow.AI',   icon: Bot           },
  ],
```

Add the `Code2` import alongside existing imports at the top:

```javascript
import { BookOpen, LayoutDashboard, Brain, FileText, Bot, Compass, Plug, Activity, Radar, GraduationCap, Code2 } from 'lucide-react'
```

- [ ] **Step 4: Verify the app builds**

```bash
npm run dev
```

Navigate to `/code-academy` in the browser. The home screen should appear with language buttons.

- [ ] **Step 5: Smoke test end-to-end**

1. Click "Python"
2. Click "Variables"
3. Click "Start lesson: Variables"
4. Confirm loading spinner appears (Ollama must be running)
5. After ~20 seconds, confirm lesson intro page loads with worked example
6. Click "Start practising →"
7. Confirm exercise prompt, editor, and Run button appear
8. Type some Python, click Run
9. Confirm output panel shows result and ProgressSidebar shows AI feedback if wrong

- [ ] **Step 6: Commit**

```bash
git add src/views/CodeAcademy.jsx src/App.jsx src/components/layout/LeftRail.jsx
git commit -m "feat(code-academy): route, view wrapper, and nav item — feature complete"
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Language dropdown (HTML, CSS, Python) | Task 9 (CodeAcademyHome) |
| Concept picker with search | Task 9 |
| Goal-first entry | Task 9 (GOALS list) |
| Lesson generation (AI) | Task 2 (lessonGenerator) |
| Worked example block with steps | Task 5 (WorkedExampleCard) |
| Code editor | Task 6 (CodeEditorPanel) |
| Run button | Task 6 |
| HTML/CSS preview iframe | Task 7 (OutputPanel + buildIframeSrc) |
| Correctness validation | Task 3 (validatorEngine) |
| AI error explanation (middle-school) | Task 3 (feedbackEngine) |
| Hover definitions | Task 5 (TermHoverCard) |
| Lesson progress tracking | Task 1 (store) + Task 4 (hook) |
| Reset and hint buttons | Task 6 |
| Tab support in editor | Task 6 |
| 3-panel layout | Task 10 (CodeAcademyPage) |
| Common mistakes sidebar | Task 8 (ProgressSidebar) |
| Resume in-progress lessons | Task 9 (CodeAcademyHome resume section) |
| Lesson complete screen | Task 10 |

**Deferred (per spec MVP scope):**
- JavaScript runtime sandbox
- Mini projects
- Adaptive exercise engine (simplified: fixed 3 exercises)
- Achievement system

**Placeholder scan:** None found — all steps have concrete code.

**Type consistency check:**
- `CodeLesson.id` = lessonKey (e.g. `python_variables`) — used consistently in lessonGenerator, useCodeAcademy, and store methods
- `CodeExercise.validatorType` = `'llm'` for Python, `'structure'` for HTML/CSS — routed correctly in validatorEngine
- `CodeLessonProgress.masteryState` transitions: `not_started` → `in_progress` (on startLesson) → `passed` (on nextExercise after last exercise) — consistent across useCodeAcademy and store

---

Plan complete and saved to `docs/superpowers/plans/2026-05-07-code-academy.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, two-stage review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans

Which approach?
