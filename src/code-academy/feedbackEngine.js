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
