/**
 * Validate and import a Flow Academy sharing package.
 * Returns { ok: true, course } or { ok: false, error: string }.
 */

import { PACKAGE_VERSION, PACKAGE_TYPE } from './exportTypes.js'

const MAX_STR   = 4000
const MAX_TITLE = 200

function str(v, max = MAX_STR)  { return typeof v === 'string' ? v.slice(0, max) : '' }
function arr(v)                  { return Array.isArray(v) ? v : [] }
function num(v, def = 0)        { const n = Number(v); return isFinite(n) ? n : def }
function bool(v, def = false)   { return typeof v === 'boolean' ? v : def }

function validateLesson(raw, index) {
  if (!raw || typeof raw !== 'object') throw new Error(`Lesson ${index} is malformed`)
  return {
    id:          str(raw.id) || `imported_l${index}`,
    title:       str(raw.title, MAX_TITLE) || `Lesson ${index + 1}`,
    order:       num(raw.order, index),
    summary:     str(raw.summary),
    objectives:  arr(raw.objectives).map((o) => str(o, MAX_TITLE)).filter(Boolean),
    explanation: raw.explanation ? str(raw.explanation, 20000) : null,
    examples:    raw.examples ? arr(raw.examples).map((e) => ({
      description: str(e?.description, 500),
      code:        e?.code ? str(e.code, 5000) : null,
      language:    e?.language ? str(e.language, 20) : null,
    })) : null,
    recap:       raw.recap  ? str(raw.recap,  2000) : null,
    glossary:    (raw.glossary && typeof raw.glossary === 'object' && !Array.isArray(raw.glossary))
      ? Object.fromEntries(
          Object.entries(raw.glossary)
            .slice(0, 30)
            .map(([k, v]) => [str(k, 80).toLowerCase(), str(v, 300)])
            .filter(([k]) => k)
        )
      : null,
    quiz: raw.quiz ? {
      passingScore: num(raw.quiz.passingScore, 70),
      questions: arr(raw.quiz.questions).slice(0, 20).map((q, qi) => ({
        id:           str(q?.id) || `q${qi + 1}`,
        question:     str(q?.question, 1000),
        options:      arr(q?.options).slice(0, 6).map((o) => str(o, 300)),
        correctIndex: num(q?.correctIndex, 0),
        explanation:  str(q?.explanation, 1000),
      })).filter((q) => q.question && q.options.length >= 2),
    } : null,
    // Progress — always reset on import (caller decides based on startFresh)
    status:        null, // set below
    bestScore:     null,
    lastAttemptAt: null,
  }
}

/**
 * Parse and validate raw text from a .json package file.
 *
 * @param {string} rawText    - File content
 * @param {object} [opts]
 * @param {boolean} [opts.startFresh=true] - Ignore any sender progress
 * @returns {{ ok: boolean, course?: object, meta?: object, error?: string }}
 */
export function parseImportedPackage(rawText, opts = {}) {
  const { startFresh = true } = opts

  let pkg
  try {
    pkg = JSON.parse(rawText)
  } catch {
    return { ok: false, error: 'File is not valid JSON. Make sure you selected a Flow Academy package (.json) file.' }
  }

  // Version / type checks
  if (!pkg || typeof pkg !== 'object') {
    return { ok: false, error: 'Package format is unrecognised.' }
  }
  if (pkg.exportType !== PACKAGE_TYPE) {
    return { ok: false, error: 'This file is not a Flow Academy course package.' }
  }
  if (!pkg.version) {
    return { ok: false, error: 'Package is missing a version field.' }
  }

  const raw = pkg.course
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Package is missing course data.' }
  }
  if (!raw.title) {
    return { ok: false, error: 'Course has no title.' }
  }
  if (!Array.isArray(raw.lessons) || raw.lessons.length === 0) {
    return { ok: false, error: 'Course has no lessons.' }
  }

  let lessons
  try {
    lessons = raw.lessons
      .slice(0, 20)
      .sort((a, b) => num(a?.order, 0) - num(b?.order, 0))
      .map((l, i) => validateLesson(l, i))
  } catch (e) {
    return { ok: false, error: e.message }
  }

  // Apply progress or reset to fresh
  const senderProgress = !startFresh && bool(pkg.includeProgress) && pkg.progress
  for (let i = 0; i < lessons.length; i++) {
    const l = lessons[i]
    if (senderProgress) {
      l.status    = num(l.order, i) === 0 ? 'unlocked' : (pkg.progress?.lessonScores?.[l.id] != null ? 'passed' : 'locked')
      l.bestScore = pkg.progress?.lessonScores?.[l.id] ?? null
    } else {
      l.status    = i === 0 ? 'unlocked' : 'locked'
      l.bestScore = null
    }
  }

  const course = {
    topic:                    str(raw.topic, MAX_TITLE),
    goal:                     str(raw.goal,  MAX_STR),
    title:                    str(raw.title, MAX_TITLE),
    summary:                  str(raw.summary),
    estimatedDurationMinutes: num(raw.estimatedDurationMinutes, 45),
    objectives:               arr(raw.objectives).map((o) => str(o, 300)).filter(Boolean),
    keyVocabulary:            arr(raw.keyVocabulary).map((w) => str(w, 80)).filter(Boolean),
    status:                   senderProgress ? (str(raw.status) || 'in_progress') : 'in_progress',
    imported:                 true,
    importedAt:               new Date().toISOString(),
    exportedAt:               str(pkg.exportedAt, 40),
    lessons,
  }

  const meta = {
    title:       course.title,
    summary:     course.summary,
    lessonCount: lessons.length,
    exportedAt:  pkg.exportedAt,
    hasProgress: bool(pkg.includeProgress),
  }

  return { ok: true, course, meta }
}
