import { PHRASE_SYNONYMS, TOKEN_SYNONYMS } from '../constants/synonyms.js'

const STOPWORDS = new Set([
  'the','a','an','is','for','with','that','it','we','they','this','those',
  'them','its','their','and','or','but','in','on','at','to','of','be','are',
  'was','were','have','has','had','do','does','did','will','would','could',
  'should','not','no','my','me','i','you','he','she','our','your','his','her',
  'as','up','so','if','by','from','than','then','when','there','what','how',
])

/**
 * Two-pass normalisation:
 * 1. Replace PHRASE_SYNONYMS in raw lowercased text
 * 2. Tokenise, strip stopwords, apply TOKEN_SYNONYMS
 * Returns space-joined normalised string.
 */
export function normalizeText(raw: string): string {
  // Pass 1: phrase substitution on raw text
  let text = raw.toLowerCase()
  for (const [phrase, canonical] of Object.entries(PHRASE_SYNONYMS)) {
    text = text.split(phrase).join(canonical)
  }

  // Pass 2: tokenise, strip stopwords, apply token synonyms
  const tokens = text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t))
    .map((t) => TOKEN_SYNONYMS[t] ?? t)

  return tokens.join(' ')
}

/**
 * Extract deduped key terms (length >= 4) from a normalised text string.
 */
export function extractKeyTerms(normalised: string): string[] {
  if (!normalised.trim()) return []
  const seen = new Set<string>()
  const terms: string[] = []
  for (const token of normalised.split(/\s+/).filter(Boolean)) {
    if (token.length >= 4 && !seen.has(token)) {
      seen.add(token)
      terms.push(token)
    }
  }
  return terms
}
