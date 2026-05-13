/**
 * Flow Academy Sharing — shared constants and schema docs.
 *
 * SharedCoursePackage schema:
 * {
 *   version:         string            // '1.0'
 *   exportedAt:      string            // ISO timestamp
 *   exportType:      'flow-academy-package'
 *   includeProgress: boolean
 *   course:          LearningCourse    // full course with lessons inline
 *   progress?:       { lessonScores: { lessonId: number } }
 * }
 */

export const PACKAGE_VERSION = '1.0'
export const PACKAGE_TYPE    = 'flow-academy-package'

export const VIEWER_MODES = /** @type {const} */ ({
  READ_ONLY: 'read_only',
  GUIDED:    'guided',
})

export const EXPORT_MODES = /** @type {const} */ ({
  HTML: 'html',
  JSON: 'json',
  BOTH: 'both',
})
