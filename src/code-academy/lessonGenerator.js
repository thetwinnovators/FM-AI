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
        '  "conceptBody": ["2-3 short plain sentences explaining the concept — what it is and why it matters, before any code", "Another 1-2 sentence paragraph if needed"],\n' +
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
        '- conceptBody: 2-3 short plain paragraphs (as array of strings) explaining the concept before the code example\n' +
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
      conceptBody:   Array.isArray(structureRaw.conceptBody)   ? structureRaw.conceptBody.map(String)   : [],
      prerequisites: Array.isArray(structureRaw.prerequisites) ? structureRaw.prerequisites.map(String) : [],
      terminology:   Array.isArray(structureRaw.terminology)   ? structureRaw.terminology.map(shapeTerm) : [],
      workedExample,
      exercises:     exercisesRaw.exercises.map((ex, i) => shapeExercise(ex, i)),
      commonMistakes:Array.isArray(structureRaw.commonMistakes)? structureRaw.commonMistakes.map(String): [],
      generatedAt:   new Date().toISOString(),
    }
  } catch {
    return null
  }
}
