# Code Academy — Python Curriculum (Learn Mode) Design

## Goal

Add a structured, non-linear Python learning track to FlowMap's existing Code Academy. The new **Learn** mode hosts a curated Python curriculum with a lesson map, split-screen sub-lessons, and static challenge validation. The existing Ollama-powered **Generate** mode stays untouched and is reframed as a sibling mode for on-demand AI lessons.

## Context

`src/views/CodeAcademy.jsx` currently delegates entirely to `src/code-academy/`, which is an AI-powered (Ollama) lesson generator. It supports many languages via freeform "pick a language + concept → generate a lesson" flow. This works and should not be replaced.

The new Learn mode adds a separate `src/python-curriculum/` module. `CodeAcademy.jsx` becomes a two-mode shell.

---

## Architecture

### Top-level shell — `src/views/CodeAcademy.jsx`

Renders two tab buttons at the top: **Learn** and **Generate**. State: `mode: 'learn' | 'generate'`.

```
CodeAcademy.jsx
  ├─ mode = 'learn'    → <PythonCurriculumApp />   (new module)
  └─ mode = 'generate' → <CodeAcademyHome />        (existing, unchanged)
```

The existing `In Progress` / `Completed` tabs inside `CodeAcademyHome` stay as-is — they track Ollama-generated lessons only. Learn mode has its own separate progress system.

### New module — `src/python-curriculum/`

```
src/python-curriculum/
  curriculum/
    python.ts              ← all 15 groups + ~75 sub-lessons, static content
  storage/
    progressStorage.ts     ← localStorage CRUD for sub-lesson progress
  components/
    PythonCurriculumApp.jsx  ← top-level; owns stage state + navigation
    LanguagePicker.jsx       ← Python active, 7 placeholders with "Coming soon"
    LessonMap.jsx            ← groups + sub-lesson card grid + search bar
    SubLessonView.jsx        ← split-screen: explanation left, challenge right
    ChallengePanel.jsx       ← static validator, run/submit/skip/hint
    PlaceholderModal.jsx     ← shown when a non-Python language is clicked
```

### Screen state machine — `PythonCurriculumApp.jsx`

Three screens, no URL changes (all within the single `CodeAcademy` view):

| stage | screen | triggered by |
|---|---|---|
| `'language'` | `LanguagePicker` | initial / "Change language" |
| `'map'` | `LessonMap` | select Python |
| `'lesson'` | `SubLessonView` | click any sub-lesson card |

Navigation helper: `navigate(stage, params?)`. Back from lesson → map (scroll position restored). Back from map → language picker.

---

## Curriculum Data

### File — `src/python-curriculum/curriculum/python.ts`

Single exported constant. All 15 groups and their sub-lessons are written out in full — no dynamic generation, no loading. Imported directly.

```ts
export interface SubLessonChallenge {
  type:           'code_run' | 'multiple_choice' | 'fill_blank' | 'read_only'
  prompt:         string
  starterCode?:   string         // for code_run
  expectedOutput?: string        // for code_run — what the static validator checks
  options?:       string[]       // for multiple_choice
  correctOption?: number         // index into options
  blankAnswer?:   string         // for fill_blank
  hints:          string[]       // revealed one at a time
  solution:       string         // shown after 3 failed attempts
}

export interface SubLesson {
  id:              string
  title:           string
  slug:            string
  tldr:            string        // one-sentence summary shown in TL;DR toggle
  searchableTerms: string[]
  explanation:     string[]      // 2-4 paragraphs, plain language
  example: {
    code:    string
    output?: string
  }
  challenge: SubLessonChallenge
  recommendedAfter?: string      // sub-lesson id — soft guidance only
}

export interface LessonGroup {
  id:         string
  title:      string
  subLessons: SubLesson[]
}

export const PYTHON_CURRICULUM: LessonGroup[] = [ /* 15 groups */ ]
```

### 15 lesson groups (in order)

1. Introduction
2. Variables
3. Data Types
4. Strings
5. Numbers
6. Input and Output
7. Conditionals
8. Loops
9. Functions
10. Lists
11. Dictionaries
12. Object-Oriented Programming *(classes, `__init__`, instance vars, methods, inheritance)*
13. APIs and Requests
14. Files
15. Error Handling

Each group has 4–6 sub-lessons. Total: ~75 sub-lessons.

### Sub-lesson content rules

All explanation text written for a middle-school student with no coding background:
- Short sentences.
- Define every technical term when first used.
- Use real-world analogies.
- One idea per paragraph.
- `example.code` is 4–8 lines, well-commented.

---

## Progress Storage

**File:** `src/python-curriculum/storage/progressStorage.ts`

One localStorage entry per sub-lesson. Key pattern: `fm_pyca_{subLessonId}`.

```ts
export interface SubLessonProgress {
  subLessonId:  string
  viewed:       boolean
  practiced:    boolean   // true after first Run attempt
  completed:    boolean   // true after passing challenge or hitting Continue
  skipped:      boolean
  lastOpenedAt: string    // ISO timestamp
}

export function loadProgress(id: string): SubLessonProgress
export function saveProgress(id: string, partial: Partial<SubLessonProgress>): void
export function loadAllProgress(): Record<string, SubLessonProgress>
export function clearAllProgress(): void
```

No conflict with Ollama generator keys (`fm_code_*`).

**Progress update lifecycle:**
1. Sub-lesson opens → `viewed: true` written immediately
2. First Run attempt → `practiced: true`
3. Challenge passed + Continue → `completed: true`
4. Skip button → `skipped: true` (does not set `completed`)

---

## Screen Designs

### LanguagePicker

Grid of language cards. Python is the only active card. All others show "Coming soon" badge (visually distinct — lower opacity, locked icon) but **are clickable** — they open `PlaceholderModal`.

Clicking any non-Python card opens `PlaceholderModal` with the message:
> **{Language} is coming soon.**  
> Python is the first live Code Academy track. More languages will be added later.  
> [Continue with Python] [Back]

### LessonMap

**Search bar** at top. Filters sub-lessons in real time against each `searchableTerms` array. When a query is active: non-matching groups collapse, matching sub-lessons highlight.

**Groups** render as labelled vertical sections. Within each group, sub-lessons render as a horizontal-wrapping card grid.

**Sub-lesson card states:**

| state | visual |
|---|---|
| Not started | default card, clickable |
| In progress | teal left border |
| Completed | teal background tint + ✓ |
| Skipped | muted + strikethrough title |

No hard locking. All cards are clickable. Cards with `recommendedAfter` show a soft tooltip on hover: *"Helpful after {title}"* — never a block.

**Group completion indicator:** small pill next to group title showing `N / M done`.

### SubLessonView — split-screen

Two columns side by side. On screens narrower than `lg` breakpoint: stacks vertically (explanation above, challenge below).

**Left — Explanation panel (scrollable)**
- Lesson title + group breadcrumb
- Explanation paragraphs
- Worked example with syntax-highlighted code block + expected output
- Key terms rendered as inline highlights; hover/click shows a `TermHoverCard` (term + plain meaning)
- Collapsible **TL;DR** toggle at the bottom: one-sentence summary of the concept

**Right — Challenge panel (fixed height, no overflow scroll)**
- Task prompt in plain language
- Code textarea (monospace font, line numbers via CSS counter)
- `Run` button — instant static validation
- Result area: ✅ correct message **or** ❌ "Expected: X / Got: Y" in plain language
- Hints section: `Show hint (1 of 3)` → reveals next hint per click
- Solution button: appears after 3 failed attempts; shows `challenge.solution`
- `Skip lesson` link (bottom, muted) → marks skipped, goes to next sub-lesson
- `Continue →` button: appears after passing; marks completed, advances

**Top navigation bar (above split):**
```
← Back to map   |   {Group title} › {Sub-lesson title}   |   Skip →   Next →
```

---

## Static Validator — `ChallengePanel.jsx`

For `code_run` challenges:

```js
function validate(userCode, challenge) {
  const userOutput   = normalise(simulateOutput(userCode))
  const expectedOutput = normalise(challenge.expectedOutput)
  return { passed: userOutput === expectedOutput, userOutput }
}

// simulateOutput: extracts the string argument from print() calls
// normalise: trim whitespace, normalise quotes to straight, lowercase
```

`simulateOutput` parses `print("…")` or `print('…')` calls via simple regex — sufficient for beginner exercises. It does not execute arbitrary Python.

**Curriculum constraint:** all `code_run` challenges must use only literal-string `print()` calls (e.g. `print("Hello")`, `print(5 + 2)`). Challenges that print variables by reference (e.g. `x = 5; print(x)`) are not supported by the regex parser and must not appear in v1 content. Use multiple-choice or fill-blank for exercises that require variable output.

For `multiple_choice`: compare selected index to `challenge.correctOption`.
For `fill_blank`: normalised string equality against `challenge.blankAnswer`.
For `read_only`: no challenge — just a Continue button.

---

## Placeholder Languages

Shown in `LanguagePicker` (v1):
- JavaScript
- HTML
- CSS
- SQL
- TypeScript
- React
- Node.js

All visually present, all non-selectable. Clicking any opens `PlaceholderModal`.

---

## What is NOT in scope (v1)

- Real JavaScript or any other structured curriculum
- Pyodide or actual Python execution
- Ollama-powered feedback in Learn mode
- Achievements / certificates
- Social / sharing features for Learn mode progress
- Syncing Learn progress to disk (localStorage only)

---

## Integration with existing system

| Area | Change |
|---|---|
| `src/views/CodeAcademy.jsx` | Add `mode` state, render Learn/Generate tabs |
| `src/code-academy/` | **No changes** — Generate mode imports it as-is |
| `src/python-curriculum/` | **New module** — entirely new |
| localStorage keys | `fm_pyca_*` — no conflict with `fm_code_*` |
| Routing | No changes to React Router config |
