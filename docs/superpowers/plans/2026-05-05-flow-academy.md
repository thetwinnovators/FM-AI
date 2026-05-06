# Flow Academy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mastery-based AI learning system inside FlowMap where Ollama generates structured beginner-friendly courses on any topic, with lesson-by-lesson progression, 6–8 question quizzes, a 70 % pass threshold, retry flows, and full local-first persistence.

**Architecture:** All course data lives in a new `courses` key in the existing `useStore.js` localStorage store — same persist/snapshot pattern used by conversations and documents. Ollama generates content in two phases via `chatJson()`: first a full syllabus with lesson stubs (fast), then each lesson's body + quiz on demand when the user opens that lesson. The Education view (already routed at `/education`) is replaced with a three-tab layout: Discover (topic picker + generator), In Progress (active courses), Completed (finished courses). Navigation between syllabus/lesson/quiz views is local React state — no URL changes needed for MVP.

**Tech Stack:** React 18 + hooks (`.js`/`.jsx` — the codebase is JavaScript, not TypeScript), `useSyncExternalStore` store pattern, Ollama via `chatJson()` from `src/lib/llm/ollama.js`, Tailwind CSS + existing `glass-panel`/`btn`/`glass-input` tokens, Vitest + `@testing-library/react`

---

## File Map

**Create:**
- `src/flow-academy/quizEngine.js` — pure scoring logic, no React
- `src/flow-academy/quizEngine.test.js` — unit tests
- `src/flow-academy/courseGenerator.js` — Ollama prompt functions
- `src/flow-academy/courseGenerator.test.js` — unit tests (mocked chatJson)
- `src/flow-academy/components/AcademyHome.jsx` — main page, tab routing, local nav state
- `src/flow-academy/components/TopicPicker.jsx` — topic suggestions + manual input + Generate button
- `src/flow-academy/components/SyllabusView.jsx` — course overview + lesson list
- `src/flow-academy/components/LessonView.jsx` — lesson content, lazy generation trigger
- `src/flow-academy/components/QuizView.jsx` — quiz form
- `src/flow-academy/components/QuizResults.jsx` — score display + retry/continue

**Modify:**
- `src/store/useStore.js` — add `courses: {}` to EMPTY; add `addCourse`, `updateCourse`, `deleteCourse`, `updateLesson` actions + selectors
- `src/store/useStore.test.js` — add course action tests
- `src/views/Education.jsx` — replace stub with `<AcademyHome />`
- `src/components/layout/LeftRail.jsx` — add "Flow Academy" nav entry

---

## Task 1: Store slice for courses

**Files:**
- Modify: `src/store/useStore.js`
- Modify: `src/store/useStore.test.js`

- [ ] **Step 1: Write failing store tests**

Add to `src/store/useStore.test.js` (after the existing tests):

```js
  it('addCourse creates a course with status draft', () => {
    const { result } = renderHook(() => useStore())
    let course
    act(() => {
      course = result.current.addCourse({
        topic: 'photosynthesis',
        title: 'How Plants Make Food',
        summary: 'A beginner introduction.',
        estimatedDurationMinutes: 45,
        objectives: ['Understand chlorophyll'],
        keyVocabulary: ['chlorophyll', 'glucose'],
        lessons: [
          { id: 'l1', title: 'Lesson 1', order: 0, summary: 'Intro', objectives: ['Learn basics'], status: 'unlocked' }
        ],
      })
    })
    expect(course.id).toMatch(/^course_/)
    expect(course.status).toBe('draft')
    expect(course.topic).toBe('photosynthesis')
    expect(result.current.courses[course.id]).toBeDefined()
  })

  it('updateCourse patches fields', () => {
    const { result } = renderHook(() => useStore())
    let course
    act(() => { course = result.current.addCourse({ topic: 't', title: 'T', summary: 's', estimatedDurationMinutes: 30, objectives: [], keyVocabulary: [], lessons: [] }) })
    act(() => result.current.updateCourse(course.id, { status: 'in_progress' }))
    expect(result.current.courses[course.id].status).toBe('in_progress')
  })

  it('deleteCourse removes a course', () => {
    const { result } = renderHook(() => useStore())
    let course
    act(() => { course = result.current.addCourse({ topic: 't', title: 'T', summary: 's', estimatedDurationMinutes: 30, objectives: [], keyVocabulary: [], lessons: [] }) })
    act(() => result.current.deleteCourse(course.id))
    expect(result.current.courses[course.id]).toBeUndefined()
  })

  it('updateLesson patches a single lesson by id', () => {
    const { result } = renderHook(() => useStore())
    let course
    act(() => {
      course = result.current.addCourse({
        topic: 't', title: 'T', summary: 's', estimatedDurationMinutes: 30, objectives: [], keyVocabulary: [],
        lessons: [{ id: 'l1', title: 'L1', order: 0, summary: 's', objectives: [], status: 'unlocked' }],
      })
    })
    act(() => result.current.updateLesson(course.id, 'l1', { status: 'passed', bestScore: 85 }))
    const updated = result.current.courses[course.id].lessons.find((l) => l.id === 'l1')
    expect(updated.status).toBe('passed')
    expect(updated.bestScore).toBe(85)
  })
```

- [ ] **Step 2: Run tests — verify they fail**

```
npx vitest run src/store/useStore.test.js
```
Expected: FAIL — `result.current.addCourse is not a function`

- [ ] **Step 3: Add `courses: {}` to EMPTY in `src/store/useStore.js`**

Find the `const EMPTY = {` block (around line 10). Add `courses: {}` as the last key before the closing brace:

```js
const EMPTY = {
  saves: {},
  follows: {},
  dismisses: {},
  collections: {},
  views: {},
  searches: {},
  memoryEntries: {},
  memoryDismisses: {},
  userTopics: {},
  manualContent: {},
  documents: {},
  documentContents: {},
  conversations: {},
  chatMessages: {},
  userNotes: {},
  folders: {},
  topicSummaries: {},
  courses: {},   // Flow Academy — keyed by course id
}
```

- [ ] **Step 4: Add course actions inside `useStore()` function**

Add after the `clearTopicSummary` callback (around line 562), before the `ensureFolderByName` callback:

```js
  // ── Flow Academy ────────────────────────────────────────────────────────────
  // Courses are stored inline: each course object contains its lesson stubs and,
  // once generated, their full content + quiz. Status and scores live inline too.

  const addCourse = useCallback((data) => {
    const cur = memoryState
    const id = `course_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const now = new Date().toISOString()
    const course = {
      id,
      topic: String(data.topic || '').trim(),
      title: String(data.title || '').trim(),
      summary: String(data.summary || '').trim(),
      estimatedDurationMinutes: Number(data.estimatedDurationMinutes) || 45,
      objectives: Array.isArray(data.objectives) ? data.objectives : [],
      keyVocabulary: Array.isArray(data.keyVocabulary) ? data.keyVocabulary : [],
      status: 'draft',
      createdAt: now,
      completedAt: null,
      lessons: Array.isArray(data.lessons) ? data.lessons : [],
    }
    persist({ ...cur, courses: { ...cur.courses, [id]: course } })
    return course
  }, [])

  const updateCourse = useCallback((id, patch) => {
    const cur = memoryState
    const existing = cur.courses?.[id]
    if (!existing) return null
    const next = { ...existing, ...patch, id }
    persist({ ...cur, courses: { ...cur.courses, [id]: next } })
    return next
  }, [])

  const deleteCourse = useCallback((id) => {
    const cur = memoryState
    const next = { ...cur.courses }
    delete next[id]
    persist({ ...cur, courses: next })
  }, [])

  // Patch a single lesson within a course (by lesson id).
  const updateLesson = useCallback((courseId, lessonId, patch) => {
    const cur = memoryState
    const course = cur.courses?.[courseId]
    if (!course) return null
    const lessons = course.lessons.map((l) =>
      l.id === lessonId ? { ...l, ...patch } : l
    )
    const next = { ...course, lessons }
    persist({ ...cur, courses: { ...cur.courses, [courseId]: next } })
    return next
  }, [])

  const courseById = useCallback((id) => memoryState.courses?.[id] || null, [])

  const allCoursesSorted = useCallback(() =>
    Object.values(memoryState.courses || {})
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
  [])
```

- [ ] **Step 5: Add the new actions to the return object**

Find the `return {` near the end of `useStore()` (line 760). Add the course actions and selectors:

```js
  return {
    ...state,
    toggleSave, toggleFollow, dismiss,
    recordView, recordSearch,
    addMemory, updateMemory, deleteMemory, isMemoryDismissed, pinMemoryAsIdentity,
    notesFor, addNote, removeNote,
    addUserTopic, removeUserTopic, updateUserTopic, userTopicBySlug,
    addManualContent, removeManualContent, manualContentForTopic, manualContentByUrl,
    addDocument, updateDocument, removeDocument, documentById, documentContentById, documentsForTopic, requestSummary,
    addFolder, renameFolder, removeFolder, ensureFolderByName,
    setTopicSummary, clearTopicSummary,
    createConversation, updateConversation, deleteConversation, addChatMessage, patchChatMessage,
    conversationById, chatMessagesFor, allConversationsSorted,
    isSaved, isFollowing, isDismissed, viewCount, recentSearches,
    // Flow Academy
    addCourse, updateCourse, deleteCourse, updateLesson,
    courseById, allCoursesSorted,
  }
```

- [ ] **Step 6: Run tests — verify they pass**

```
npx vitest run src/store/useStore.test.js
```
Expected: all PASS (including the 4 new course tests)

- [ ] **Step 7: Commit**

```bash
git add src/store/useStore.js src/store/useStore.test.js
git commit -m "feat(academy): add courses slice to useStore with add/update/delete/updateLesson actions"
```

---

## Task 2: Quiz engine (pure scoring logic)

**Files:**
- Create: `src/flow-academy/quizEngine.js`
- Create: `src/flow-academy/quizEngine.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/flow-academy/quizEngine.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { scoreQuiz, computePercentComplete } from './quizEngine.js'

const QUESTIONS = [
  { id: 'q1', question: 'Q1?', options: ['A','B','C','D'], correctIndex: 0, explanation: 'A is right' },
  { id: 'q2', question: 'Q2?', options: ['A','B','C','D'], correctIndex: 2, explanation: 'C is right' },
  { id: 'q3', question: 'Q3?', options: ['A','B','C','D'], correctIndex: 1, explanation: 'B is right' },
  { id: 'q4', question: 'Q4?', options: ['A','B','C','D'], correctIndex: 3, explanation: 'D is right' },
]

describe('scoreQuiz', () => {
  it('returns 100 when all answers correct', () => {
    const answers = { q1: 0, q2: 2, q3: 1, q4: 3 }
    const result = scoreQuiz(QUESTIONS, answers)
    expect(result.score).toBe(100)
    expect(result.passed).toBe(true)
    expect(result.correct).toBe(4)
    expect(result.total).toBe(4)
    expect(result.missedIndexes).toEqual([])
  })

  it('returns 50 and failed when half correct', () => {
    const answers = { q1: 0, q2: 0, q3: 1, q4: 0 }
    const result = scoreQuiz(QUESTIONS, answers)
    expect(result.score).toBe(50)
    expect(result.passed).toBe(false)
    expect(result.correct).toBe(2)
    expect(result.missedIndexes).toEqual([1, 3])
  })

  it('passes at exactly 70 percent', () => {
    // 3 out of 4 is 75% — pass
    const answers = { q1: 0, q2: 2, q3: 1, q4: 0 }
    const result = scoreQuiz(QUESTIONS, answers)
    expect(result.score).toBe(75)
    expect(result.passed).toBe(true)
  })

  it('fails at 69 percent (2 of 3 questions correct)', () => {
    const threeQs = QUESTIONS.slice(0, 3)
    const answers = { q1: 0, q2: 2, q3: 0 }
    const result = scoreQuiz(threeQs, answers)
    // 2/3 = 66.7% → below 70, fail
    expect(result.passed).toBe(false)
  })

  it('returns 0 when no answers provided', () => {
    const result = scoreQuiz(QUESTIONS, {})
    expect(result.score).toBe(0)
    expect(result.passed).toBe(false)
    expect(result.correct).toBe(0)
    expect(result.missedIndexes).toEqual([0,1,2,3])
  })
})

describe('computePercentComplete', () => {
  it('returns 0 for course with no passed lessons', () => {
    const course = {
      lessons: [
        { id: 'l1', status: 'unlocked' },
        { id: 'l2', status: 'locked' },
      ],
    }
    expect(computePercentComplete(course)).toBe(0)
  })

  it('returns 50 when half the lessons are passed', () => {
    const course = {
      lessons: [
        { id: 'l1', status: 'passed' },
        { id: 'l2', status: 'unlocked' },
      ],
    }
    expect(computePercentComplete(course)).toBe(50)
  })

  it('returns 100 when all lessons passed', () => {
    const course = {
      lessons: [
        { id: 'l1', status: 'passed' },
        { id: 'l2', status: 'passed' },
      ],
    }
    expect(computePercentComplete(course)).toBe(100)
  })

  it('returns 0 for course with no lessons', () => {
    expect(computePercentComplete({ lessons: [] })).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```
npx vitest run src/flow-academy/quizEngine.test.js
```
Expected: FAIL — `Cannot find module './quizEngine.js'`

- [ ] **Step 3: Create `src/flow-academy/quizEngine.js`**

```js
/**
 * Pure scoring logic for Flow Academy quizzes. No React, no side effects.
 *
 * scoreQuiz(questions, answers) — takes the quiz question array and a map of
 * questionId -> selectedOptionIndex. Returns { score, passed, correct, total,
 * missedIndexes } where missedIndexes are the 0-based positions of wrong answers.
 *
 * computePercentComplete(course) — returns 0-100 based on how many lessons
 * have status 'passed'.
 */

/**
 * @param {Array<{id:string, correctIndex:number}>} questions
 * @param {Record<string, number>} answers  — { questionId: selectedIndex }
 * @returns {{ score: number, passed: boolean, correct: number, total: number, missedIndexes: number[] }}
 */
export function scoreQuiz(questions, answers) {
  if (!questions || questions.length === 0) return { score: 0, passed: false, correct: 0, total: 0, missedIndexes: [] }
  let correct = 0
  const missedIndexes = []
  questions.forEach((q, i) => {
    const selected = answers?.[q.id]
    if (selected !== undefined && selected === q.correctIndex) {
      correct++
    } else {
      missedIndexes.push(i)
    }
  })
  const score = Math.round((correct / questions.length) * 100)
  return { score, passed: score >= 70, correct, total: questions.length, missedIndexes }
}

/**
 * @param {{ lessons: Array<{status: string}> }} course
 * @returns {number} 0-100
 */
export function computePercentComplete(course) {
  const lessons = course?.lessons || []
  if (lessons.length === 0) return 0
  const passed = lessons.filter((l) => l.status === 'passed').length
  return Math.round((passed / lessons.length) * 100)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```
npx vitest run src/flow-academy/quizEngine.test.js
```
Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/flow-academy/quizEngine.js src/flow-academy/quizEngine.test.js
git commit -m "feat(academy): add quizEngine with scoreQuiz and computePercentComplete"
```

---

## Task 3: Course generator (Ollama prompts)

**Files:**
- Create: `src/flow-academy/courseGenerator.js`
- Create: `src/flow-academy/courseGenerator.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/flow-academy/courseGenerator.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock chatJson before importing courseGenerator so the module-level import
// picks up the mock.
vi.mock('../lib/llm/ollama.js', () => ({
  chatJson: vi.fn(),
}))
vi.mock('../lib/llm/ollamaConfig.js', () => ({
  OLLAMA_CONFIG: { enabled: true, model: 'llama3.2:3b' },
  addTokenUsage: vi.fn(),
}))

import { chatJson } from '../lib/llm/ollama.js'
import { generateCourseSyllabus, generateLessonContent } from './courseGenerator.js'

const MOCK_SYLLABUS = {
  title: 'Introduction to Photosynthesis',
  summary: 'Learn how plants make food.',
  estimatedDurationMinutes: 45,
  objectives: ['Understand chlorophyll'],
  keyVocabulary: ['chlorophyll'],
  lessons: [
    { title: 'What is a plant?', summary: 'Basics', objectives: ['Know plant parts'] },
  ],
}

const MOCK_LESSON = {
  explanation: 'Photosynthesis is how plants make food.',
  examples: ['A leaf in sunlight makes glucose.', 'A cactus stores food too.'],
  recap: 'Plants use sunlight to make food.',
  quiz: {
    passingScore: 70,
    questions: [
      { id: 'q1', question: 'What do plants use to make food?', options: ['Sunlight','Music','Rocks','Water alone'], correctIndex: 0, explanation: 'Sunlight powers photosynthesis.' },
      { id: 'q2', question: 'What gas do plants absorb?', options: ['Oxygen','Nitrogen','Carbon dioxide','Helium'], correctIndex: 2, explanation: 'Plants absorb CO2.' },
      { id: 'q3', question: 'What do plants produce?', options: ['Plastic','Glucose','Metal','Sand'], correctIndex: 1, explanation: 'Plants produce glucose.' },
      { id: 'q4', question: 'Where does photosynthesis happen?', options: ['Roots','Bark','Leaves','Flowers'], correctIndex: 2, explanation: 'Mainly in leaves.' },
      { id: 'q5', question: 'What is chlorophyll?', options: ['A mineral','A vitamin','Green pigment','A bug'], correctIndex: 2, explanation: 'Chlorophyll is the green pigment.' },
      { id: 'q6', question: 'Which light color is most used?', options: ['Blue','Green','Yellow','Purple'], correctIndex: 0, explanation: 'Blue and red light are most used.' },
    ],
  },
}

beforeEach(() => vi.clearAllMocks())

describe('generateCourseSyllabus', () => {
  it('calls chatJson and returns shaped course data', async () => {
    chatJson.mockResolvedValue(MOCK_SYLLABUS)
    const result = await generateCourseSyllabus('photosynthesis')
    expect(chatJson).toHaveBeenCalledOnce()
    expect(result.title).toBe('Introduction to Photosynthesis')
    expect(Array.isArray(result.lessons)).toBe(true)
    expect(result.lessons[0].id).toMatch(/^l_/)
    expect(result.lessons[0].status).toBe('unlocked')
  })

  it('returns null when chatJson returns null', async () => {
    chatJson.mockResolvedValue(null)
    const result = await generateCourseSyllabus('something')
    expect(result).toBeNull()
  })

  it('marks lessons after the first as locked', async () => {
    chatJson.mockResolvedValue({
      ...MOCK_SYLLABUS,
      lessons: [
        { title: 'L1', summary: 's', objectives: [] },
        { title: 'L2', summary: 's', objectives: [] },
      ],
    })
    const result = await generateCourseSyllabus('test')
    expect(result.lessons[0].status).toBe('unlocked')
    expect(result.lessons[1].status).toBe('locked')
  })
})

describe('generateLessonContent', () => {
  it('calls chatJson and returns lesson body with quiz', async () => {
    chatJson.mockResolvedValue(MOCK_LESSON)
    const result = await generateLessonContent('Photosynthesis', 'What is a plant?', ['Know plant parts'], 0, 3)
    expect(chatJson).toHaveBeenCalledOnce()
    expect(typeof result.explanation).toBe('string')
    expect(Array.isArray(result.examples)).toBe(true)
    expect(result.quiz.questions.length).toBeGreaterThanOrEqual(6)
  })

  it('returns null when chatJson returns null', async () => {
    chatJson.mockResolvedValue(null)
    const result = await generateLessonContent('Course', 'Lesson', [], 0, 1)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```
npx vitest run src/flow-academy/courseGenerator.test.js
```
Expected: FAIL — `Cannot find module './courseGenerator.js'`

- [ ] **Step 3: Create `src/flow-academy/courseGenerator.js`**

```js
/**
 * Flow Academy course generation via Ollama chatJson.
 *
 * Two entry points:
 *   generateCourseSyllabus(topic) — produces full course skeleton with lesson
 *     stubs. Lesson bodies are NOT generated here; they are lazy-loaded when
 *     the user opens each lesson for the first time.
 *
 *   generateLessonContent(courseTitle, lessonTitle, objectives, lessonIndex,
 *     totalLessons) — produces the full body + quiz for one lesson.
 *
 * Both return null on any failure (Ollama off, network error, bad JSON shape).
 * Callers handle null by showing an error state and letting the user retry.
 */

import { chatJson } from '../lib/llm/ollama.js'

// ── Syllabus generation ───────────────────────────────────────────────────────

function syllabusMessages(topic) {
  return [
    {
      role: 'system',
      content:
        'You are an expert educator creating beginner-friendly courses for someone in middle school. ' +
        'You must return ONLY a valid JSON object — no markdown, no code fences, no extra text.',
    },
    {
      role: 'user',
      content:
        `Generate a beginner-friendly course syllabus for: "${topic}"\n\n` +
        'Return this exact JSON structure:\n' +
        '{\n' +
        '  "title": "Short, friendly course title",\n' +
        '  "summary": "2-3 sentence friendly description of what the learner will understand by the end",\n' +
        '  "estimatedDurationMinutes": 45,\n' +
        '  "objectives": ["By the end you will understand...", "..."],\n' +
        '  "keyVocabulary": ["term1", "term2", "term3"],\n' +
        '  "lessons": [\n' +
        '    {\n' +
        '      "title": "Lesson title",\n' +
        '      "summary": "One sentence: what this lesson covers",\n' +
        '      "objectives": ["You will learn to...", "..."]\n' +
        '    }\n' +
        '  ]\n' +
        '}\n\n' +
        'Rules:\n' +
        '- Use 4 to 6 lessons\n' +
        '- Each lesson teaches exactly one main concept\n' +
        '- Use plain language, no jargon without definition\n' +
        '- Assume no prior knowledge\n' +
        '- estimatedDurationMinutes should be between 30 and 90\n' +
        '- keyVocabulary: 4 to 8 important terms from the topic',
    },
  ]
}

/**
 * Generate a course syllabus. Returns the shaped course data (ready to pass
 * to `addCourse`) or null on failure.
 */
export async function generateCourseSyllabus(topic) {
  if (!topic || !String(topic).trim()) return null
  const raw = await chatJson(syllabusMessages(String(topic).trim()), { temperature: 0.3 })
  if (!raw || !raw.title || !Array.isArray(raw.lessons)) return null

  // Attach stable ids, order indexes, and initial lock/unlock status to each lesson.
  const lessons = raw.lessons.map((l, i) => ({
    id: `l_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 5)}`,
    title: String(l.title || `Lesson ${i + 1}`),
    order: i,
    summary: String(l.summary || ''),
    objectives: Array.isArray(l.objectives) ? l.objectives : [],
    status: i === 0 ? 'unlocked' : 'locked',
    // content fields — populated by generateLessonContent on first open:
    explanation: null,
    examples: null,
    recap: null,
    quiz: null,
    bestScore: null,
    lastAttemptAt: null,
  }))

  return {
    topic: String(topic).trim(),
    title: String(raw.title || topic),
    summary: String(raw.summary || ''),
    estimatedDurationMinutes: Number(raw.estimatedDurationMinutes) || 45,
    objectives: Array.isArray(raw.objectives) ? raw.objectives : [],
    keyVocabulary: Array.isArray(raw.keyVocabulary) ? raw.keyVocabulary : [],
    lessons,
  }
}

// ── Lesson content generation ─────────────────────────────────────────────────

function lessonMessages(courseTitle, lessonTitle, objectives, lessonIndex, totalLessons) {
  return [
    {
      role: 'system',
      content:
        'You are an expert teacher writing beginner-friendly lessons for someone in middle school. ' +
        'You must return ONLY a valid JSON object — no markdown, no code fences, no extra text.',
    },
    {
      role: 'user',
      content:
        `Course: "${courseTitle}"\n` +
        `Lesson ${lessonIndex + 1} of ${totalLessons}: "${lessonTitle}"\n` +
        `What this lesson teaches: ${objectives.join('; ')}\n\n` +
        'Return this exact JSON structure:\n' +
        '{\n' +
        '  "explanation": "The full lesson explanation. Write in plain English. Use short paragraphs. Define every technical word when first used. Teach one idea at a time. Minimum 3 paragraphs.",\n' +
        '  "examples": [\n' +
        '    "Example 1: a concrete real-world example with detail",\n' +
        '    "Example 2: another concrete example"\n' +
        '  ],\n' +
        '  "recap": "Short 2-3 sentence recap of the key ideas just taught",\n' +
        '  "quiz": {\n' +
        '    "passingScore": 70,\n' +
        '    "questions": [\n' +
        '      {\n' +
        '        "id": "q1",\n' +
        '        "question": "Question text ending with ?",\n' +
        '        "options": ["Option A", "Option B", "Option C", "Option D"],\n' +
        '        "correctIndex": 0,\n' +
        '        "explanation": "Why Option A is correct, and briefly why the others are not"\n' +
        '      }\n' +
        '    ]\n' +
        '  }\n' +
        '}\n\n' +
        'Rules:\n' +
        '- explanation: minimum 3 paragraphs, simple language throughout\n' +
        '- examples: give exactly 2 concrete, real-world examples\n' +
        '- quiz: exactly 6 to 8 questions\n' +
        '- quiz questions only test what was explicitly taught in this lesson\n' +
        '- all 4 answer options must be plausible (no obviously wrong answers)\n' +
        '- correctIndex must be 0, 1, 2, or 3\n' +
        '- question ids must be q1, q2, q3, ... in order',
    },
  ]
}

/**
 * Generate full content for one lesson. Returns the content patch object
 * (fields to merge into the lesson) or null on failure.
 */
export async function generateLessonContent(courseTitle, lessonTitle, objectives, lessonIndex, totalLessons) {
  const raw = await chatJson(
    lessonMessages(courseTitle, lessonTitle, objectives || [], lessonIndex, totalLessons),
    { temperature: 0.4, num_ctx: 8192 },
  )
  if (!raw || typeof raw.explanation !== 'string') return null
  if (!raw.quiz || !Array.isArray(raw.quiz.questions) || raw.quiz.questions.length < 4) return null

  return {
    explanation: String(raw.explanation).trim(),
    examples: Array.isArray(raw.examples) ? raw.examples.map(String) : [],
    recap: String(raw.recap || '').trim(),
    quiz: {
      passingScore: 70,
      questions: raw.quiz.questions.map((q, i) => ({
        id: q.id || `q${i + 1}`,
        question: String(q.question || ''),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
        explanation: String(q.explanation || ''),
      })),
    },
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```
npx vitest run src/flow-academy/courseGenerator.test.js
```
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/flow-academy/courseGenerator.js src/flow-academy/courseGenerator.test.js
git commit -m "feat(academy): add courseGenerator with syllabus + lesson content generation via chatJson"
```

---

## Task 4: AcademyHome — main page shell and navigation

**Files:**
- Create: `src/flow-academy/components/AcademyHome.jsx`

This component is the top-level container for the `/education` route. It manages three tabs (Discover, In Progress, Completed) and an internal navigation stack (home → syllabus → lesson → quiz). No URL changes — all local state.

- [ ] **Step 1: Create `src/flow-academy/components/AcademyHome.jsx`**

```jsx
import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import TopicPicker from './TopicPicker.jsx'
import SyllabusView from './SyllabusView.jsx'
import LessonView from './LessonView.jsx'
import QuizView from './QuizView.jsx'
import QuizResults from './QuizResults.jsx'
import { computePercentComplete } from '../quizEngine.js'

// ── Course card for In Progress / Completed tabs ──────────────────────────────
function CourseCard({ course, onOpen }) {
  const pct = computePercentComplete(course)
  const nextLesson = course.lessons.find((l) => l.status === 'unlocked' || l.status === 'passed')
  return (
    <button
      onClick={() => onOpen(course.id)}
      className="w-full text-left p-4 rounded-xl border border-white/[0.08] hover:border-white/20 transition-colors"
      style={{ background: 'linear-gradient(160deg, rgba(15,17,28,0.6) 0%, rgba(8,10,18,0.7) 100%)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-medium text-white/90">{course.title}</p>
          <p className="text-xs text-[color:var(--color-text-tertiary)] mt-0.5">{course.topic}</p>
        </div>
        {course.status === 'completed' && (
          <span className="flex-shrink-0 text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded border text-emerald-300 border-emerald-400/40 bg-emerald-500/10">
            Completed
          </span>
        )}
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1 rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-teal-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-[color:var(--color-text-tertiary)] mt-1.5">
        {pct}% complete · {course.lessons.filter((l) => l.status === 'passed').length} of {course.lessons.length} lessons
      </p>
    </button>
  )
}

// ── Suggested topic chips ──────────────────────────────────────────────────────
const SUGGESTED_TOPICS = [
  'How the internet works', 'The basics of electricity', 'DNA and genetics',
  'How black holes form', 'The water cycle', 'How computers process information',
  'The history of money', 'How vaccines work', 'Climate and weather patterns',
  'Newton\'s laws of motion', 'How the stock market works', 'The basics of machine learning',
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function AcademyHome() {
  const { courses, courseById, allCoursesSorted } = useStore()

  // Tab: 'discover' | 'in_progress' | 'completed'
  const [tab, setTab] = useState('discover')

  // Internal nav: null = tab home; otherwise an object describing what to show
  // { view: 'syllabus' | 'lesson' | 'quiz' | 'results', courseId, lessonId?, quizResult? }
  const [nav, setNav] = useState(null)

  function openCourse(courseId) {
    setNav({ view: 'syllabus', courseId })
  }

  function openLesson(courseId, lessonId) {
    setNav({ view: 'lesson', courseId, lessonId })
  }

  function openQuiz(courseId, lessonId) {
    setNav({ view: 'quiz', courseId, lessonId })
  }

  function showResults(courseId, lessonId, quizResult) {
    setNav({ view: 'results', courseId, lessonId, quizResult })
  }

  function goBack() {
    if (!nav) return
    if (nav.view === 'results' || nav.view === 'quiz') {
      setNav({ view: 'lesson', courseId: nav.courseId, lessonId: nav.lessonId })
    } else if (nav.view === 'lesson') {
      setNav({ view: 'syllabus', courseId: nav.courseId })
    } else {
      setNav(null)
    }
  }

  // ── Render inner views ──────────────────────────────────────────────────────
  if (nav) {
    const course = courseById(nav.courseId)
    if (!course) { setNav(null); return null }

    if (nav.view === 'syllabus') {
      return (
        <div className="p-6">
          <BackButton onBack={() => setNav(null)} label="Flow Academy" />
          <SyllabusView course={course} onOpenLesson={openLesson} />
        </div>
      )
    }

    const lesson = course.lessons.find((l) => l.id === nav.lessonId)
    if (!lesson) { setNav({ view: 'syllabus', courseId: nav.courseId }); return null }

    if (nav.view === 'lesson') {
      return (
        <div className="p-6">
          <BackButton onBack={() => setNav({ view: 'syllabus', courseId: nav.courseId })} label={course.title} />
          <LessonView course={course} lesson={lesson} onTakeQuiz={() => openQuiz(nav.courseId, nav.lessonId)} />
        </div>
      )
    }

    if (nav.view === 'quiz') {
      return (
        <div className="p-6">
          <BackButton onBack={() => openLesson(nav.courseId, nav.lessonId)} label={lesson.title} />
          <QuizView lesson={lesson} onSubmit={(result) => showResults(nav.courseId, nav.lessonId, result)} />
        </div>
      )
    }

    if (nav.view === 'results') {
      return (
        <div className="p-6">
          <QuizResults
            course={course}
            lesson={lesson}
            result={nav.quizResult}
            onRetry={() => openQuiz(nav.courseId, nav.lessonId)}
            onContinue={() => {
              // Find next unlocked lesson after this one
              const nextLesson = course.lessons.find((l) => l.order > lesson.order && l.status === 'unlocked')
              if (nextLesson) {
                openLesson(nav.courseId, nextLesson.id)
              } else {
                setNav({ view: 'syllabus', courseId: nav.courseId })
              }
            }}
            onBackToSyllabus={() => setNav({ view: 'syllabus', courseId: nav.courseId })}
          />
        </div>
      )
    }
  }

  // ── Tab home views ──────────────────────────────────────────────────────────
  const allCourses = allCoursesSorted()
  const inProgress = allCourses.filter((c) => c.status === 'in_progress' || c.status === 'draft')
  const completed = allCourses.filter((c) => c.status === 'completed')

  const TABS = [
    { id: 'discover',    label: 'Discover'    },
    { id: 'in_progress', label: 'In Progress', count: inProgress.length },
    { id: 'completed',   label: 'Completed',   count: completed.length  },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2.5">
          <GraduationCap size={22} className="text-teal-400" /> Flow Academy
        </h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
          AI-generated beginner courses on any topic. Learn step-by-step, prove your understanding.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.08]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative -mb-px ${
              tab === t.id
                ? 'text-white border-b-2 border-teal-400'
                : 'text-[color:var(--color-text-secondary)] hover:text-white'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-white/[0.08] text-[color:var(--color-text-tertiary)]">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'discover' && (
        <TopicPicker
          suggestedTopics={SUGGESTED_TOPICS}
          onCourseCreated={(courseId) => openCourse(courseId)}
        />
      )}

      {tab === 'in_progress' && (
        inProgress.length === 0 ? (
          <div className="py-16 text-center text-sm text-[color:var(--color-text-tertiary)]">
            <GraduationCap size={28} className="mx-auto mb-3 opacity-40" />
            <p>No courses in progress. Head to <button className="underline text-white" onClick={() => setTab('discover')}>Discover</button> to start one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {inProgress.map((c) => <CourseCard key={c.id} course={c} onOpen={openCourse} />)}
          </div>
        )
      )}

      {tab === 'completed' && (
        completed.length === 0 ? (
          <div className="py-16 text-center text-sm text-[color:var(--color-text-tertiary)]">
            <p>No completed courses yet. Keep learning!</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {completed.map((c) => <CourseCard key={c.id} course={c} onOpen={openCourse} />)}
          </div>
        )
      )}
    </div>
  )
}

function BackButton({ onBack, label }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 text-sm text-[color:var(--color-text-secondary)] hover:text-white mb-5 transition-colors"
    >
      <span>←</span> <span>{label}</span>
    </button>
  )
}
```

- [ ] **Step 2: Verify no import errors**

```
npx vitest run src/flow-academy/quizEngine.test.js
```
(Run a test that doesn't import AcademyHome to check no stray syntax errors in related files.) Expected: still all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/flow-academy/components/AcademyHome.jsx
git commit -m "feat(academy): add AcademyHome with tab routing and internal nav state"
```

---

## Task 5: TopicPicker — topic selection and course generation trigger

**Files:**
- Create: `src/flow-academy/components/TopicPicker.jsx`

- [ ] **Step 1: Create `src/flow-academy/components/TopicPicker.jsx`**

```jsx
import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import { generateCourseSyllabus } from '../courseGenerator.js'

export default function TopicPicker({ suggestedTopics, onCourseCreated }) {
  const { addCourse, updateCourse } = useStore()
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  async function handleGenerate(topic) {
    const t = String(topic || input).trim()
    if (!t) return
    if (!OLLAMA_CONFIG.enabled) {
      setError('Ollama is not enabled. Turn it on in Settings (gear icon) and make sure the Docker container is running.')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const data = await generateCourseSyllabus(t)
      if (!data) {
        setError('Could not generate a course. Make sure Ollama is running and a model is pulled, then try again.')
        return
      }
      const course = addCourse(data)
      // Immediately mark in_progress so it appears in In Progress tab
      updateCourse(course.id, { status: 'in_progress' })
      onCourseCreated(course.id)
    } catch (err) {
      setError('Something went wrong generating the course. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Manual input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-white/80 mb-2">What do you want to learn?</label>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !generating) handleGenerate(input) }}
            placeholder="e.g. How does the immune system work?"
            className="glass-input text-sm flex-1"
            disabled={generating}
          />
          <button
            onClick={() => handleGenerate(input)}
            disabled={generating || !input.trim()}
            className="btn flex items-center gap-2 px-4"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-amber-300/90">{error}</p>
        )}
      </div>

      {/* Suggested topics */}
      <div>
        <p className="text-xs font-medium text-[color:var(--color-text-tertiary)] uppercase tracking-wide mb-3">
          Or pick a suggested topic
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestedTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => { setInput(topic); handleGenerate(topic) }}
              disabled={generating}
              className="px-3 py-1.5 rounded-lg text-sm border border-white/[0.08] text-[color:var(--color-text-secondary)] hover:border-teal-400/40 hover:text-teal-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* Ollama not enabled warning */}
      {!OLLAMA_CONFIG.enabled && (
        <div className="mt-6 p-4 rounded-xl border border-amber-400/20 bg-amber-500/5 text-sm">
          <p className="text-amber-200/90 font-medium mb-1">Ollama is not enabled</p>
          <p className="text-amber-200/60 text-xs leading-relaxed">
            Flow Academy uses your local Ollama AI to generate courses. Enable Ollama in Settings
            and make sure the Docker container is running.
          </p>
          <code className="block mt-2 text-[11px] text-amber-200/50 font-mono">
            docker run -d -p 11434:11434 -v ollama:/root/.ollama --name ollama ollama/ollama
          </code>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/flow-academy/components/TopicPicker.jsx
git commit -m "feat(academy): add TopicPicker with manual input, suggestions, and Ollama generation trigger"
```

---

## Task 6: SyllabusView — course overview and lesson list

**Files:**
- Create: `src/flow-academy/components/SyllabusView.jsx`

- [ ] **Step 1: Create `src/flow-academy/components/SyllabusView.jsx`**

```jsx
import { Lock, CheckCircle, Circle, Clock, BookOpen, Target } from 'lucide-react'
import { computePercentComplete } from '../quizEngine.js'

function lessonIcon(status) {
  if (status === 'passed') return <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
  if (status === 'unlocked') return <Circle size={16} className="text-teal-400 flex-shrink-0" />
  return <Lock size={16} className="text-white/20 flex-shrink-0" />
}

export default function SyllabusView({ course, onOpenLesson }) {
  const pct = computePercentComplete(course)
  const nextLesson = course.lessons.find((l) => l.status === 'unlocked')

  return (
    <div className="max-w-2xl">
      {/* Course header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-white">{course.title}</h2>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-2 leading-relaxed">{course.summary}</p>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-[12px] text-[color:var(--color-text-tertiary)] mb-6">
        <span className="flex items-center gap-1"><Clock size={12} /> ~{course.estimatedDurationMinutes} min</span>
        <span className="flex items-center gap-1"><BookOpen size={12} /> {course.lessons.length} lessons</span>
        {pct > 0 && <span className="text-teal-400">{pct}% complete</span>}
      </div>

      {/* Progress bar */}
      {pct > 0 && (
        <div className="mb-6 h-1.5 rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Start / Continue button */}
      {nextLesson && (
        <button
          onClick={() => onOpenLesson(course.id, nextLesson.id)}
          className="btn mb-6 px-5 flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.3) 0%, rgba(99,102,241,0.3) 100%)', borderColor: 'rgba(20,184,166,0.4)' }}
        >
          {pct === 0 ? 'Start Lesson 1' : `Continue — ${nextLesson.title}`}
        </button>
      )}

      {/* Objectives */}
      {course.objectives.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-[color:var(--color-text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Target size={11} /> What you will learn
          </h3>
          <ul className="space-y-1">
            {course.objectives.map((obj, i) => (
              <li key={i} className="text-sm text-white/75 flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">✓</span> {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key vocabulary */}
      {course.keyVocabulary.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-[color:var(--color-text-tertiary)] uppercase tracking-wide mb-2">Key vocabulary</h3>
          <div className="flex flex-wrap gap-1.5">
            {course.keyVocabulary.map((word, i) => (
              <span key={i} className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-xs text-white/70">
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lesson list */}
      <div>
        <h3 className="text-xs font-medium text-[color:var(--color-text-tertiary)] uppercase tracking-wide mb-3">Lessons</h3>
        <div className="space-y-2">
          {course.lessons.map((lesson, i) => (
            <button
              key={lesson.id}
              onClick={() => lesson.status !== 'locked' && onOpenLesson(course.id, lesson.id)}
              disabled={lesson.status === 'locked'}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                lesson.status === 'locked'
                  ? 'border-white/[0.04] opacity-40 cursor-not-allowed'
                  : lesson.status === 'passed'
                  ? 'border-emerald-400/20 hover:border-emerald-400/40'
                  : 'border-teal-400/20 hover:border-teal-400/40'
              }`}
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              {lessonIcon(lesson.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white/85 truncate">
                    {i + 1}. {lesson.title}
                  </p>
                  {lesson.bestScore !== null && (
                    <span className="text-[11px] text-emerald-400 flex-shrink-0">{lesson.bestScore}%</span>
                  )}
                </div>
                <p className="text-xs text-[color:var(--color-text-tertiary)] mt-0.5">{lesson.summary}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/flow-academy/components/SyllabusView.jsx
git commit -m "feat(academy): add SyllabusView with lesson list, progress bar, and objectives"
```

---

## Task 7: LessonView — lesson content with lazy generation

**Files:**
- Create: `src/flow-academy/components/LessonView.jsx`

- [ ] **Step 1: Create `src/flow-academy/components/LessonView.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { Loader2, BookOpen, Target, Lightbulb, RotateCcw } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import { generateLessonContent } from '../courseGenerator.js'

export default function LessonView({ course, lesson, onTakeQuiz }) {
  const { updateLesson, updateCourse } = useStore()
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)

  // Lazy-generate lesson content the first time the lesson is opened.
  useEffect(() => {
    if (lesson.explanation) return       // already generated
    if (!OLLAMA_CONFIG.enabled) return  // no Ollama — show the error state below
    let cancelled = false
    async function generate() {
      setGenerating(true)
      setGenError(null)
      try {
        const content = await generateLessonContent(
          course.title,
          lesson.title,
          lesson.objectives,
          lesson.order,
          course.lessons.length,
        )
        if (cancelled) return
        if (!content) {
          setGenError('Could not generate lesson content. Make sure Ollama is running, then try again.')
          return
        }
        updateLesson(course.id, lesson.id, content)
        // Mark course as in_progress if still draft
        if (course.status === 'draft') updateCourse(course.id, { status: 'in_progress' })
      } catch {
        if (!cancelled) setGenError('Something went wrong. Please go back and try opening this lesson again.')
      } finally {
        if (!cancelled) setGenerating(false)
      }
    }
    generate()
    return () => { cancelled = true }
  }, [lesson.id]) // re-run only if lesson identity changes

  // ── States ──────────────────────────────────────────────────────────────────
  if (!OLLAMA_CONFIG.enabled && !lesson.explanation) {
    return (
      <div className="max-w-2xl py-12 text-center">
        <p className="text-sm text-amber-200/80 mb-2">Ollama is not enabled.</p>
        <p className="text-xs text-[color:var(--color-text-tertiary)]">
          Enable Ollama in Settings and make sure the container is running to generate lesson content.
        </p>
      </div>
    )
  }

  if (generating) {
    return (
      <div className="max-w-2xl flex flex-col items-center justify-center py-24 gap-4">
        <div className="relative flex items-center justify-center w-14 h-14">
          <div className="absolute inset-0 rounded-full bg-teal-400/10 animate-ping" style={{ animationDuration: '1.8s' }} />
          <Loader2 size={28} className="animate-spin text-teal-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white/80">Writing your lesson…</p>
          <p className="text-xs text-[color:var(--color-text-tertiary)] mt-1">Flow AI is crafting a beginner-friendly explanation just for you.</p>
        </div>
      </div>
    )
  }

  if (genError) {
    return (
      <div className="max-w-2xl py-12 text-center">
        <p className="text-sm text-amber-200/80 mb-3">{genError}</p>
        <button className="btn flex items-center gap-2 mx-auto" onClick={() => { setGenError(null); setGenerating(false) }}>
          <RotateCcw size={13} /> Retry
        </button>
      </div>
    )
  }

  if (!lesson.explanation) return null  // still waiting for first paint

  // ── Lesson content ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-teal-400 font-medium uppercase tracking-wide mb-1">
          Lesson {lesson.order + 1} of {course.lessons.length}
        </p>
        <h2 className="text-xl font-semibold text-white">{lesson.title}</h2>
      </div>

      {/* What you will learn */}
      {lesson.objectives.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(20,184,166,0.05)' }}>
          <h3 className="text-xs font-medium text-teal-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Target size={11} /> What you will learn
          </h3>
          <ul className="space-y-1">
            {lesson.objectives.map((obj, i) => (
              <li key={i} className="text-sm text-white/75 flex items-start gap-2">
                <span className="text-teal-400 flex-shrink-0 mt-0.5">·</span> {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main explanation */}
      <div className="mb-6 space-y-4">
        {lesson.explanation.split('\n\n').filter(Boolean).map((para, i) => (
          <p key={i} className="text-sm text-white/85 leading-relaxed">{para}</p>
        ))}
      </div>

      {/* Examples */}
      {lesson.examples && lesson.examples.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-[color:var(--color-text-tertiary)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Lightbulb size={11} /> Examples
          </h3>
          <div className="space-y-3">
            {lesson.examples.map((ex, i) => (
              <div key={i} className="p-4 rounded-xl border border-white/[0.06] text-sm text-white/80 leading-relaxed"
                style={{ background: 'rgba(99,102,241,0.04)' }}>
                {ex}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recap */}
      {lesson.recap && (
        <div className="mb-8 p-4 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <h3 className="text-xs font-medium text-[color:var(--color-text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <BookOpen size={11} /> Quick recap
          </h3>
          <p className="text-sm text-white/75 leading-relaxed">{lesson.recap}</p>
        </div>
      )}

      {/* Take quiz CTA */}
      {lesson.quiz && (
        <button
          onClick={onTakeQuiz}
          className="btn w-full py-3 flex items-center justify-center gap-2 font-medium"
          style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.25) 0%, rgba(99,102,241,0.25) 100%)', borderColor: 'rgba(20,184,166,0.35)' }}
        >
          Take the lesson quiz — {lesson.quiz.questions.length} questions
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/flow-academy/components/LessonView.jsx
git commit -m "feat(academy): add LessonView with lazy content generation, examples, recap, and quiz CTA"
```

---

## Task 8: QuizView — quiz form

**Files:**
- Create: `src/flow-academy/components/QuizView.jsx`

- [ ] **Step 1: Create `src/flow-academy/components/QuizView.jsx`**

```jsx
import { useState } from 'react'
import { scoreQuiz } from '../quizEngine.js'

export default function QuizView({ lesson, onSubmit }) {
  const { quiz } = lesson
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  if (!quiz) return null

  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined)

  function handleSubmit() {
    if (!allAnswered) return
    const result = scoreQuiz(quiz.questions, answers)
    setSubmitted(true)
    onSubmit(result)
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-teal-400 font-medium uppercase tracking-wide mb-1">Quiz</p>
        <h2 className="text-xl font-semibold text-white">{lesson.title}</h2>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
          Answer all {quiz.questions.length} questions. You need {quiz.passingScore}% to pass.
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-6 mb-8">
        {quiz.questions.map((q, qi) => (
          <div key={q.id} className="p-4 rounded-xl border border-white/[0.08]" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-sm font-medium text-white/90 mb-3">
              <span className="text-[color:var(--color-text-tertiary)] mr-2">{qi + 1}.</span>
              {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const selected = answers[q.id] === oi
                return (
                  <button
                    key={oi}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                    disabled={submitted}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                      selected
                        ? 'border-teal-400/50 bg-teal-400/10 text-teal-200'
                        : 'border-white/[0.08] text-white/70 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span className="text-[color:var(--color-text-tertiary)] mr-2">{String.fromCharCode(65 + oi)}.</span>
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitted}
        className="btn w-full py-3 font-medium disabled:opacity-40"
        style={allAnswered ? { background: 'linear-gradient(135deg, rgba(20,184,166,0.25) 0%, rgba(99,102,241,0.25) 100%)', borderColor: 'rgba(20,184,166,0.35)' } : undefined}
      >
        {submitted ? 'Submitted' : allAnswered ? 'Submit answers' : `Answer all questions to submit (${Object.keys(answers).length}/${quiz.questions.length})`}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/flow-academy/components/QuizView.jsx
git commit -m "feat(academy): add QuizView with radio selection and submit"
```

---

## Task 9: QuizResults — scoring, feedback, retry/continue

**Files:**
- Create: `src/flow-academy/components/QuizResults.jsx`

- [ ] **Step 1: Create `src/flow-academy/components/QuizResults.jsx`**

```jsx
import { CheckCircle, XCircle, RotateCcw, ArrowRight } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { computePercentComplete } from '../quizEngine.js'

export default function QuizResults({ course, lesson, result, onRetry, onContinue, onBackToSyllabus }) {
  const { updateLesson, updateCourse } = useStore()
  const { score, passed, correct, total, missedIndexes } = result

  // Persist the result the first time this component renders.
  // We use a ref-style trick: write on mount without a useEffect dep array.
  const already = lesson.bestScore !== null
  if (!already) {
    const now = new Date().toISOString()
    const newBest = lesson.bestScore === null ? score : Math.max(lesson.bestScore, score)
    if (passed) {
      // Unlock next lesson
      const nextLesson = course.lessons.find((l) => l.order === lesson.order + 1)
      updateLesson(course.id, lesson.id, { status: 'passed', bestScore: newBest, lastAttemptAt: now })
      if (nextLesson) updateLesson(course.id, nextLesson.id, { status: 'unlocked' })
      // Check if all lessons passed → complete course
      const allPassed = course.lessons.every((l) => l.id === lesson.id || l.status === 'passed')
      if (allPassed) updateCourse(course.id, { status: 'completed', completedAt: now })
    } else {
      updateLesson(course.id, lesson.id, { bestScore: newBest, lastAttemptAt: now })
    }
  }

  const missedQuestions = lesson.quiz
    ? missedIndexes.map((i) => lesson.quiz.questions[i]).filter(Boolean)
    : []

  const allCourseLessons = course.lessons
  const allNowPassed = allCourseLessons.every((l) => l.id === lesson.id ? passed : l.status === 'passed')

  return (
    <div className="max-w-2xl">
      {/* Score hero */}
      <div className={`mb-6 p-6 rounded-2xl border text-center ${
        passed
          ? 'border-emerald-400/25 bg-emerald-500/5'
          : 'border-amber-400/25 bg-amber-500/5'
      }`}>
        {passed
          ? <CheckCircle size={36} className="mx-auto mb-3 text-emerald-400" />
          : <XCircle size={36} className="mx-auto mb-3 text-amber-400" />}
        <p className="text-3xl font-bold text-white mb-1">{score}%</p>
        <p className="text-sm text-[color:var(--color-text-secondary)]">
          {correct} correct out of {total} questions
        </p>
        <p className={`text-sm font-medium mt-2 ${passed ? 'text-emerald-300' : 'text-amber-300'}`}>
          {passed ? '✓ Passed!' : '✗ Not quite — you need 70% to pass'}
        </p>
      </div>

      {/* Course completion banner */}
      {passed && allNowPassed && (
        <div className="mb-6 p-4 rounded-xl border border-teal-400/30 bg-teal-500/5 text-center">
          <p className="text-sm font-medium text-teal-300">🎓 Course complete! All lessons passed.</p>
        </div>
      )}

      {/* Retry encouragement + missed topics */}
      {!passed && missedQuestions.length > 0 && (
        <div className="mb-6">
          <p className="text-sm text-white/80 mb-3 font-medium">
            You are close. Review these ideas first, then try again:
          </p>
          <div className="space-y-3">
            {missedQuestions.map((q) => (
              <div key={q.id} className="p-3 rounded-lg border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-sm text-white/75 mb-1">{q.question}</p>
                <p className="text-xs text-[color:var(--color-text-tertiary)] leading-relaxed">{q.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {passed && !allNowPassed && (
          <button
            onClick={onContinue}
            className="btn flex items-center justify-center gap-2 py-3 font-medium"
            style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.25) 0%, rgba(99,102,241,0.25) 100%)', borderColor: 'rgba(20,184,166,0.35)' }}
          >
            Continue to next lesson <ArrowRight size={14} />
          </button>
        )}
        {passed && allNowPassed && (
          <button
            onClick={onBackToSyllabus}
            className="btn flex items-center justify-center gap-2 py-3 font-medium"
            style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.25) 0%, rgba(99,102,241,0.25) 100%)', borderColor: 'rgba(20,184,166,0.35)' }}
          >
            View completed course
          </button>
        )}
        {!passed && (
          <button
            onClick={onRetry}
            className="btn flex items-center justify-center gap-2 py-3 font-medium"
          >
            <RotateCcw size={14} /> Review lesson and retry quiz
          </button>
        )}
        <button
          onClick={onBackToSyllabus}
          className="text-sm text-[color:var(--color-text-tertiary)] hover:text-white transition-colors text-center py-2"
        >
          Back to course overview
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/flow-academy/components/QuizResults.jsx
git commit -m "feat(academy): add QuizResults with score display, missed answers recap, retry/continue flow"
```

---

## Task 10: Wire up Education.jsx, LeftRail, and run full test suite

**Files:**
- Modify: `src/views/Education.jsx`
- Modify: `src/components/layout/LeftRail.jsx`

- [ ] **Step 1: Replace `src/views/Education.jsx` stub**

Replace the entire file content:

```jsx
import AcademyHome from '../flow-academy/components/AcademyHome.jsx'

export default function Education() {
  return <AcademyHome />
}
```

- [ ] **Step 2: Add Flow Academy to LeftRail navigation**

In `src/components/layout/LeftRail.jsx`, add `GraduationCap` to the import and a new nav group entry.

Replace the import line:
```js
import { BookOpen, LayoutDashboard, Brain, FileText, Bot, Compass, Plug, Activity, Radar } from 'lucide-react'
```
With:
```js
import { BookOpen, LayoutDashboard, Brain, FileText, Bot, Compass, Plug, Activity, Radar, GraduationCap } from 'lucide-react'
```

Replace the `NAV_GROUPS` array:
```js
const NAV_GROUPS = [
  [
    { to: '/',         label: 'Dashboard',      icon: LayoutDashboard },
    { to: '/memory',   label: 'Knowledge Base', icon: Brain           },
  ],
  [
    { to: '/discover', label: 'Discover',       icon: Compass         },
    { to: '/signals',  label: 'Latest Signals', icon: Activity        },
    { to: '/radar',    label: 'Opportunity Radar', icon: Radar        },
  ],
  [
    { to: '/topics',    label: 'My Topics',     icon: BookOpen        },
    { to: '/documents', label: 'My Documents',  icon: FileText        },
  ],
  [
    { to: '/education', label: 'Flow Academy',  icon: GraduationCap   },
    { to: '/chat',      label: 'Ask Flow.AI',   icon: Bot             },
  ],
]
```

- [ ] **Step 3: Run full test suite**

```
npx vitest run
```
Expected: all tests PASS, 0 failures. Fix any import or test failures before the commit.

- [ ] **Step 4: Commit**

```bash
git add src/views/Education.jsx src/components/layout/LeftRail.jsx
git commit -m "feat(academy): wire up Education view and add Flow Academy nav link"
```

- [ ] **Step 5: Manual smoke test in browser**

Open the dev server at http://localhost:5173:

1. Click **Flow Academy** in the left rail → should see the three-tab page with "Discover" active
2. **Discover tab** → should see topic suggestions and a text input
3. Enable Ollama in settings if needed, then click a suggested topic → spinner should appear, then redirect to SyllabusView
4. SyllabusView → should show course title, lesson list, "Start Lesson 1" button
5. Click "Start Lesson 1" → centered spinner while lesson generates → lesson content appears
6. Scroll to bottom → "Take the lesson quiz" button appears
7. Click quiz button → QuizView shows all questions
8. Answer all questions → "Submit answers" button activates → click it
9. QuizResults appears with score, pass/fail state, and appropriate next action button
10. If passed → "Continue to next lesson" → lesson 2 opens
11. After all lessons passed → "View completed course" → back to syllabus showing 100%
12. **Completed tab** → course appears there

- [ ] **Step 6: Final commit tag**

```bash
git add -A
git commit -m "feat(academy): Flow Academy MVP complete — syllabus generation, lesson progression, mastery quizzes"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| Topic selection from suggestions | Task 5 (TopicPicker suggested chips) |
| Manual topic entry | Task 5 (TopicPicker input field) |
| AI-generated syllabus | Tasks 3, 5 (generateCourseSyllabus, TopicPicker) |
| Lesson-by-lesson progression | Tasks 6, 7 (SyllabusView, LessonView) |
| Beginner-friendly lesson generation | Task 3 (lessonMessages prompt rules) |
| Clear learning objectives per lesson | Task 7 (LessonView objectives block) |
| End-of-lesson multiple choice quizzes | Tasks 8, 3 (QuizView, generateLessonContent) |
| 70% mastery threshold | Tasks 2, 3 (scoreQuiz, quiz.passingScore: 70) |
| Retry flow with recap of missed topics | Task 9 (QuizResults retry path) |
| In Progress tab | Task 4 (AcademyHome) |
| Completed tab + completion tracking | Tasks 4, 9 (AcademyHome, QuizResults persist) |
| Completed courses saveable/reopenable | Task 4 (CourseCard in completed tab opens SyllabusView) |
| Local-first persistence | Task 1 (useStore courses slice) |
| Three-tab structure (Discover/In Progress/Completed) | Task 4 |
| Key vocabulary display | Tasks 3, 6 (keyVocabulary in SyllabusView) |
| Progress visible (percent complete) | Tasks 2, 6 (computePercentComplete, SyllabusView bar) |
| Explanations for wrong answers | Task 9 (QuizResults shows q.explanation for missedIndexes) |
| "You are close. Review these ideas first" retry message | Task 9 |
| Unlock next lesson after passing | Task 9 (updateLesson status: 'unlocked') |
| Course completion detection | Task 9 (allNowPassed check → updateCourse completed) |

### No deferred features (MVP-only)

Adaptive difficulty, flashcards, spaced repetition, note-taking, voice mode, printable certificates — all correctly excluded per spec.

### Type consistency check

- `lesson.bestScore` — initialized as `null` in courseGenerator.js, checked with `!== null` in QuizResults ✓
- `lesson.status` — set to `'unlocked' | 'locked' | 'passed'` in courseGenerator, read in SyllabusView and AcademyHome ✓
- `course.status` — `'draft' | 'in_progress' | 'completed'` set in store actions, read in AcademyHome filter ✓
- `scoreQuiz` returns `{ score, passed, correct, total, missedIndexes }` — QuizResults destructures these exact fields ✓
- `computePercentComplete(course)` takes `{ lessons: [{status}] }` — matches store shape ✓
- `onOpenLesson(courseId, lessonId)` — called in SyllabusView, handled in AcademyHome ✓
- `updateLesson(courseId, lessonId, patch)` — store action signature matches all call sites ✓
