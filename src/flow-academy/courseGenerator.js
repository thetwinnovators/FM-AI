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
 * Generate a course syllabus. Returns shaped course data (ready to pass to
 * addCourse) or null on failure.
 */
export async function generateCourseSyllabus(topic) {
  if (!topic || !String(topic).trim()) return null
  try {
    const raw = await chatJson(syllabusMessages(String(topic).trim()), { temperature: 0.3 })
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
        `What this lesson teaches: ${(objectives || []).join('; ')}\n\n` +
        'Return this exact JSON structure:\n' +
        '{\n' +
        '  "explanation": "The full lesson explanation. Write in plain English. Use short paragraphs separated by blank lines. Define every technical word when first used. Teach one idea at a time. Minimum 3 paragraphs.",\n' +
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
        '        "options": ["Option A text", "Option B text", "Option C text", "Option D text"],\n' +
        '        "correctIndex": 1,\n' +
        '        "explanation": "The correct answer is \'Option B text\'. Brief reason why. Why the others are wrong."\n' +
        '      }\n' +
        '    ]\n' +
        '  }\n' +
        '}\n\n' +
        'Rules:\n' +
        '- explanation: minimum 3 paragraphs, separated by \\n\\n, simple language throughout\n' +
        '- examples: give exactly 2 concrete, real-world examples\n' +
        '- quiz: exactly 6 to 8 questions\n' +
        '- quiz questions only test what was explicitly taught in this lesson\n' +
        '- all 4 answer options must be plausible (no obviously wrong answers)\n' +
        '- CRITICAL: correctIndex is the 0-based position of the correct option in the options array (0=first, 1=second, 2=third, 3=fourth)\n' +
        '- CRITICAL: the explanation field MUST start with: The correct answer is \'<exact text of correct option>\'\n' +
        '- CRITICAL: the text in options[correctIndex] must exactly match what you write in the explanation\n' +
        '- question ids must be q1, q2, q3, ... in order',
    },
  ]
}


/**
 * Generate full content for one lesson. Returns the content patch object
 * (fields to merge into the lesson) or null on failure.
 */
export async function generateLessonContent(courseTitle, lessonTitle, objectives, lessonIndex, totalLessons) {
  try {
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
        questions: raw.quiz.questions.map((q, i) => {
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
        }),
      },
    }
  } catch {
    return null
  }
}
