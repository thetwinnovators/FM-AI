/**
 * Pure scoring logic for Flow Academy quizzes. No React, no side effects.
 *
 * scoreQuiz(questions, answers) — takes the quiz question array and a map of
 * questionId -> selectedOptionIndex. Returns { score, passed, correct, total,
 * missedIndexes } where missedIndexes are the 0-based positions of wrong answers.
 *
 * computePercentComplete(course) — returns 0–100 based on how many lessons
 * have status 'passed'.
 */

/**
 * Recover the true correctIndex by cross-referencing the explanation text.
 * The AI prompt instructs it to begin every explanation with:
 *   "The correct answer is '<option text>'."
 * This catches the common case where the AI generates a plausible-looking
 * correctIndex that doesn't actually match the correct option in the array.
 *
 * @param {{ options: string[], correctIndex: number, explanation: string }} q
 * @returns {number}
 */
export function inferCorrectIndex(q) {
  const options = q.options || []
  if (!options.length) return q.correctIndex ?? 0

  const explanation = (q.explanation || '').toLowerCase()

  // Primary: match "the correct answer is '...'" or "the correct answer is "..."
  const patternMatch = explanation.match(/the correct answer is ['"“‘]([^'"”’]+)['"”’]/)
  if (patternMatch) {
    const stated = patternMatch[1].trim()
    // Exact match first
    for (let i = 0; i < options.length; i++) {
      if ((options[i] || '').toLowerCase().trim() === stated) return i
    }
    // Best substring match
    let bestIdx = q.correctIndex ?? 0
    let bestScore = 0
    for (let i = 0; i < options.length; i++) {
      const optLower = (options[i] || '').toLowerCase().trim()
      if (!optLower) continue
      const overlaps = optLower.includes(stated) || stated.includes(optLower)
      const score = overlaps
        ? Math.min(optLower.length, stated.length) / Math.max(optLower.length, stated.length)
        : 0
      if (score > bestScore) { bestScore = score; bestIdx = i }
    }
    if (bestScore > 0.5) return bestIdx
  }

  // Fallback: check stated correctIndex option appears in explanation
  const ci = q.correctIndex ?? 0
  const statedOptionText = (options[ci] || '').toLowerCase().trim()
  if (statedOptionText.length > 2 && explanation.includes(statedOptionText)) return ci

  // Last resort: find any option mentioned prominently in explanation
  for (let i = 0; i < options.length; i++) {
    const optText = (options[i] || '').toLowerCase().trim()
    if (optText.length > 3 && explanation.includes(optText)) return i
  }

  return ci
}

/**
 * @param {Array<{id:string, correctIndex:number, options:string[], explanation:string}>} questions
 * @param {Record<string, number>} answers  — { questionId: selectedIndex }
 * @returns {{ score: number, passed: boolean, correct: number, total: number, missedIndexes: number[] }}
 */
export function scoreQuiz(questions, answers) {
  if (!questions || questions.length === 0) {
    return { score: 0, passed: false, correct: 0, total: 0, missedIndexes: [] }
  }
  let correct = 0
  const missedIndexes = []
  questions.forEach((q, i) => {
    const selected = answers?.[q.id]
    // Re-derive the true correct index at scoring time — guards against
    // AI-generated data where correctIndex doesn't match the explanation.
    const trueCorrectIndex = inferCorrectIndex(q)
    if (selected !== undefined && selected === trueCorrectIndex) {
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
 * @returns {number} 0–100
 */
export function computePercentComplete(course) {
  const lessons = course?.lessons || []
  if (lessons.length === 0) return 0
  const passed = lessons.filter((l) => l.status === 'passed').length
  return Math.round((passed / lessons.length) * 100)
}
