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
import { inferCorrectIndex } from './quizEngine.js'

// ── Topic clarification ───────────────────────────────────────────────────────
// Called before syllabus generation. Returns { skip: true } when the topic is
// already specific, or { skip: false, question, options } when it's ambiguous.

const clarificationMessages = (topic, goal) => {
  const goalCtx = goal && goal.trim()
    ? `\nThe learner's stated goal: "${goal.trim()}"\nUse this goal to narrow the clarification options — only suggest angles that serve this goal.`
    : ''
  return [
    {
      role: 'system',
      content:
        'You help students pick the right course topic. ' +
        'Return ONLY a valid JSON object — no markdown, no code fences, no extra text.',
    },
    {
      role: 'user',
      content:
        `A student typed this as their course topic: "${topic}"${goalCtx}\n\n` +
        'Is this already specific and unambiguous? If yes, return:\n' +
        '{ "skip": true }\n\n' +
        'If the topic could mean several different things, return:\n' +
        '{\n' +
        '  "skip": false,\n' +
        '  "question": "Short clarifying question, max 12 words",\n' +
        '  "options": [\n' +
        '    "Full specific course topic option 1",\n' +
        '    "Full specific course topic option 2",\n' +
        '    "Full specific course topic option 3"\n' +
        '  ]\n' +
        '}\n\n' +
        'Rules:\n' +
        '- If the topic is already precise (e.g. "Python decorators", "How vaccines work"), always return skip:true\n' +
        '- If ambiguous (e.g. "Agentic", "Design", "AI", "Python"), return 3 to 4 distinct, fully-phrased options\n' +
        '- Options must be complete course topic strings a student could click — not one-word categories\n' +
        '- Question must be conversational and short (e.g. "Which area of Agentic interests you?")',
    },
  ]
}

/**
 * Ask the model whether the topic needs clarification before course generation.
 * Never throws — falls back to { skip: true } on any error so generation
 * always has a path forward.
 */
export async function getClarificationQuestion(topic, goal) {
  if (!topic || !String(topic).trim()) return { skip: true }
  try {
    const raw = await chatJson(
      clarificationMessages(String(topic).trim(), goal),
      { temperature: 0.3 },
    )
    if (!raw || raw.skip !== false) return { skip: true }
    if (!Array.isArray(raw.options) || raw.options.length < 2) return { skip: true }
    return {
      skip: false,
      question: String(raw.question || `Which aspect of "${topic}" do you want to learn?`),
      options: raw.options.map(String).filter(Boolean).slice(0, 4),
    }
  } catch {
    return { skip: true }
  }
}

// ── Syllabus generation ───────────────────────────────────────────────────────

function syllabusMessages(topic, goal) {
  const hasGoal   = !!(goal && goal.trim())
  const goalBlock = hasGoal ? `\nLearner's goal: "${goal.trim()}"` : ''

  // When the learner has stated a goal, adapt the framing and depth rules.
  const systemDesc = hasGoal
    ? 'You are an expert educator creating courses tailored to a learner\'s specific goal and background.'
    : 'You are an expert educator creating beginner-friendly courses for someone with no prior knowledge.'

  const depthRule = hasGoal
    ? '- Match the depth, vocabulary, and examples to the learner\'s stated goal — do NOT force beginner framing if the goal implies existing knowledge'
    : '- Assume no prior knowledge; use plain language throughout'

  return [
    {
      role: 'system',
      content: systemDesc + ' You must return ONLY a valid JSON object — no markdown, no code fences, no extra text.',
    },
    {
      role: 'user',
      content:
        `Generate a course syllabus for: "${topic}"${goalBlock}\n\n` +
        (hasGoal ? 'Tailor every lesson directly toward the learner\'s goal above.\n\n' : '') +
        'Return this exact JSON structure:\n' +
        '{\n' +
        '  "title": "Short, friendly course title",\n' +
        '  "summary": "2-3 sentence description of what the learner will understand by the end",\n' +
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
        depthRule + '\n' +
        '- estimatedDurationMinutes should be between 30 and 90\n' +
        '- keyVocabulary: 4 to 8 important terms from the topic',
    },
  ]
}

/**
 * Generate a course syllabus. Returns shaped course data (ready to pass to
 * addCourse) or null on failure.
 * @param {string} topic - The course topic
 * @param {string} [goal] - Optional learner goal to tailor the syllabus
 */
export async function generateCourseSyllabus(topic, goal) {
  if (!topic || !String(topic).trim()) return null
  try {
    const raw = await chatJson(syllabusMessages(String(topic).trim(), goal), { temperature: 0.3 })
    if (!raw || !raw.title || !Array.isArray(raw.lessons)) return null

    // Attach stable ids, order indexes, and initial lock/unlock status to each lesson.
    const ts = Date.now().toString(36)
    const lessons = raw.lessons.map((l, i) => ({
      id: `l_${ts}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      title: String(l.title || `Lesson ${i + 1}`),
      order: i,
      summary: String(l.summary || ''),
      objectives: Array.isArray(l.objectives) ? l.objectives : [],
      status: i === 0 ? 'unlocked' : 'locked',
      // Content fields — populated by generateLessonContent on first open:
      explanation: null,
      examples: null,
      recap: null,
      quiz: null,
      bestScore: null,
      lastAttemptAt: null,
    }))

    return {
      topic: String(topic).trim(),
      goal: goal ? String(goal).trim() : '',
      title: String(raw.title || topic),
      summary: String(raw.summary || ''),
      estimatedDurationMinutes: Number(raw.estimatedDurationMinutes) || 45,
      objectives: Array.isArray(raw.objectives) ? raw.objectives : [],
      keyVocabulary: Array.isArray(raw.keyVocabulary) ? raw.keyVocabulary : [],
      lessons,
    }
  } catch {
    return null
  }
}

// ── Lesson content generation ─────────────────────────────────────────────────
// Split into two calls:
//   Step 1 — generate explanation, examples, recap (the teaching content)
//   Step 2 — generate quiz questions grounded in the actual explanation text
// This prevents the model from asking about concepts it never explained.

function lessonBodyMessages(courseTitle, lessonTitle, objectives, lessonIndex, totalLessons, goal) {
  const hasGoal    = !!(goal && goal.trim())
  const goalLine   = hasGoal ? `\nLearner's goal: "${goal.trim()}"` : ''
  const systemDesc = hasGoal
    ? 'You are an expert teacher writing lessons tailored to a learner\'s specific goal and background.'
    : 'You are an expert teacher writing clear, beginner-friendly lessons.'
  const depthRule  = hasGoal
    ? '- Match depth and vocabulary to the learner\'s stated goal; use practical, goal-relevant examples'
    : '- Use simple language; define every technical word when first used'

  return [
    {
      role: 'system',
      content: systemDesc + ' You must return ONLY a valid JSON object — no markdown, no code fences, no extra text.',
    },
    {
      role: 'user',
      content:
        `Course: "${courseTitle}"${goalLine}\n` +
        `Lesson ${lessonIndex + 1} of ${totalLessons}: "${lessonTitle}"\n` +
        `What this lesson teaches: ${(objectives || []).join('; ')}\n\n` +
        'Return this exact JSON structure:\n' +
        '{\n' +
        '  "explanation": "The full lesson explanation. Use short paragraphs separated by \\n\\n. Teach one idea at a time. Ground EVERY concept in scenarios drawn directly from the course topic — the examples must feel native to that subject, not borrowed from unrelated domains. Wrap ALL code references in backticks: method calls like `.items()`, variable names like `my_dict`, operators like `|` or `&` when used as code. Minimum 3 paragraphs.",\n' +
        '  "examples": [\n' +
        '    {\n' +
        '      "description": "One sentence naming the scenario (it must relate to the course topic), then one sentence on what to notice in the code",\n' +
        '      "code": "actual runnable code using variable names and data drawn from the course topic — omit this field entirely if the topic has no code",\n' +
        '      "language": "python"\n' +
        '    }\n' +
        '  ],\n' +
        '  "recap": "Short 2-3 sentence recap of the key ideas just taught",\n' +
        '  "glossary": [\n' +
        '    { "term": "variable", "definition": "A named container that stores a value in your program." }\n' +
        '  ]\n' +
        '}\n\n' +
        'Rules:\n' +
        '- explanation: minimum 3 paragraphs, separated by \\n\\n\n' +
        depthRule + '\n' +
        '- EVERY concept and example must use scenarios, variable names, and data that belong to the course topic. If the topic is spiders, use spider anatomy, web-spinning, prey detection. If the topic is finance, use prices, portfolios, trades. NEVER import generic examples (inventory, e-commerce, user profiles) from outside the topic domain.\n' +
        '- examples: give exactly 2, each showing a different scenario within the course topic\n' +
        '- description: name the topic-specific scenario first, then explain what the code demonstrates\n' +
        '- code: real working code with variable names and sample data taken from the course topic (not foo/bar/x/y)\n' +
        '- language: programming language name (e.g. "python", "javascript", "sql") — omit if no code\n' +
        '- glossary: 5 to 10 key terms that appear in the explanation text; define each in one plain sentence\n' +
        '- only include terms that actually appear word-for-word in the explanation',
    },
  ]
}

function lessonQuizMessages(lessonTitle, explanationText) {
  return [
    {
      role: 'system',
      content:
        'You are a quiz writer for a beginner-friendly online academy. ' +
        'You must return ONLY a valid JSON object — no markdown, no code fences, no extra text.',
    },
    {
      role: 'user',
      content:
        `Below is the EXACT lesson text a student just read. ` +
        `Write a quiz that tests ONLY what is stated in this lesson — nothing more.\n\n` +
        `LESSON TITLE: "${lessonTitle}"\n\n` +
        `LESSON TEXT:\n${explanationText}\n\n` +
        '--- END OF LESSON ---\n\n' +
        'Return this exact JSON structure:\n' +
        '{\n' +
        '  "questions": [\n' +
        '    {\n' +
        '      "id": "q1",\n' +
        '      "question": "Question text ending with ?",\n' +
        '      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],\n' +
        '      "correctIndex": 1,\n' +
        '      "explanation": "The correct answer is \'Option B text\'. Brief reason why. Why the others are wrong."\n' +
        '    }\n' +
        '  ]\n' +
        '}\n\n' +
        'Rules:\n' +
        '- Write exactly 6 questions\n' +
        '- EVERY question must directly reference a specific concept, term, or example from the lesson text above\n' +
        '- Do NOT introduce concepts, syntax, or vocabulary that does not appear in the lesson text\n' +
        '- All 4 answer options must be plausible (no obviously wrong answers)\n' +
        '- CRITICAL: correctIndex is the 0-based position of the correct option in the options array (0=first, 1=second, 2=third, 3=fourth)\n' +
        '- CRITICAL: the explanation field MUST start with: The correct answer is \'<exact text of correct option>\'\n' +
        '- CRITICAL: the text in options[correctIndex] must exactly match what you write in the explanation\n' +
        '- question ids must be q1, q2, q3, ... in order',
    },
  ]
}

function shapeExamples(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((ex) => {
    if (typeof ex === 'string') return { description: ex, code: null, language: null }
    return {
      description: String(ex.description || ex.text || '').trim(),
      code: ex.code ? String(ex.code).trim() : null,
      language: ex.language ? String(ex.language).toLowerCase() : null,
    }
  })
}

function shapeQuestions(rawQuestions) {
  return rawQuestions.map((q, i) => {
    const shaped = {
      id: q.id || `q${i + 1}`,
      question: String(q.question || ''),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
      explanation: String(q.explanation || ''),
    }
    // Verify correctIndex against explanation — AI often misaligns these.
    shaped.correctIndex = inferCorrectIndex(shaped)
    return shaped
  })
}

/**
 * Generate full content for one lesson using two sequential LLM calls:
 * 1. Lesson body (explanation, examples, recap)
 * 2. Quiz grounded in the actual explanation text
 *
 * @param {string} courseTitle
 * @param {string} lessonTitle
 * @param {string[]} objectives
 * @param {number} lessonIndex
 * @param {number} totalLessons
 * @param {string} [goal] - Learner's stated goal from course creation
 * Returns the content patch object (fields to merge into the lesson) or null on failure.
 */
export async function generateLessonContent(courseTitle, lessonTitle, objectives, lessonIndex, totalLessons, goal) {
  try {
    // ── Step 1: generate teaching content ──────────────────────────────────────
    const body = await chatJson(
      lessonBodyMessages(courseTitle, lessonTitle, objectives || [], lessonIndex, totalLessons, goal),
      { temperature: 0.4, num_ctx: 8192 },
    )
    if (!body || typeof body.explanation !== 'string') return null

    const explanation = String(body.explanation).trim()
    const examples    = shapeExamples(body.examples)
    const recap       = String(body.recap || '').trim()

    // Build a lowercase-keyed lookup: { "variable": "A named container..." }
    const glossary = {}
    if (Array.isArray(body.glossary)) {
      for (const entry of body.glossary) {
        if (entry?.term && entry?.definition) {
          glossary[String(entry.term).toLowerCase()] = String(entry.definition).trim()
        }
      }
    }

    // ── Step 2: generate quiz grounded in the actual explanation text ──────────
    const quizRaw = await chatJson(
      lessonQuizMessages(lessonTitle, explanation),
      { temperature: 0.3, num_ctx: 8192 },
    )
    if (!quizRaw || !Array.isArray(quizRaw.questions) || quizRaw.questions.length < 4) return null

    return {
      explanation,
      examples,
      recap,
      glossary,
      quiz: {
        passingScore: 70,
        questions: shapeQuestions(quizRaw.questions),
      },
    }
  } catch {
    return null
  }
}
