/**
 * Build a Flow Academy sharing package (JSON).
 * Returns a structured object ready to JSON.stringify and save as .json.
 */

import { PACKAGE_VERSION, PACKAGE_TYPE } from './exportTypes.js'

/**
 * Strip or preserve progress fields from a lesson based on includeProgress.
 */
function shapeLessonForExport(lesson, includeProgress) {
  const base = {
    id:          lesson.id,
    title:       lesson.title,
    order:       lesson.order,
    summary:     lesson.summary || '',
    objectives:  lesson.objectives || [],
    // Content — may be null if not yet generated
    explanation: lesson.explanation || null,
    examples:    lesson.examples    || null,
    recap:       lesson.recap       || null,
    glossary:    lesson.glossary    || null,
    quiz:        lesson.quiz        || null,
  }

  if (includeProgress) {
    base.status          = lesson.status
    base.bestScore       = lesson.bestScore       ?? null
    base.lastAttemptAt   = lesson.lastAttemptAt   ?? null
  } else {
    // Reset progress — first lesson unlocked, rest locked
    base.status        = lesson.order === 0 ? 'unlocked' : 'locked'
    base.bestScore     = null
    base.lastAttemptAt = null
  }

  return base
}

/**
 * Build the package object for a course.
 *
 * @param {object} course          - Full course object from the store
 * @param {object} [opts]
 * @param {boolean} [opts.includeProgress=false]
 * @returns {object} SharedCoursePackage
 */
export function buildCoursePackage(course, opts = {}) {
  const { includeProgress = false } = opts

  const lessons = (course.lessons || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((l) => shapeLessonForExport(l, includeProgress))

  const exportCourse = {
    id:                       course.id,
    topic:                    course.topic              || '',
    goal:                     course.goal               || '',
    title:                    course.title              || 'Untitled Course',
    summary:                  course.summary            || '',
    estimatedDurationMinutes: course.estimatedDurationMinutes || 45,
    objectives:               course.objectives         || [],
    keyVocabulary:            course.keyVocabulary      || [],
    status:                   includeProgress ? (course.status || 'in_progress') : 'in_progress',
    lessons,
  }

  const pkg = {
    version:         PACKAGE_VERSION,
    exportedAt:      new Date().toISOString(),
    exportType:      PACKAGE_TYPE,
    includeProgress,
    course:          exportCourse,
  }

  if (includeProgress) {
    const lessonScores = {}
    for (const l of lessons) {
      if (l.bestScore != null) lessonScores[l.id] = l.bestScore
    }
    pkg.progress = { lessonScores }
  }

  return pkg
}

/**
 * Trigger a browser download of the JSON package.
 */
export function downloadCoursePackage(course, opts = {}) {
  const pkg      = buildCoursePackage(course, opts)
  const json     = JSON.stringify(pkg, null, 2)
  const slug     = course.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)
  const filename = `flow-academy-${slug}.json`

  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
