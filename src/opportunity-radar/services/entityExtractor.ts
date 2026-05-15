/**
 * entityExtractor -- Schema v1 deterministic entity extraction.
 *
 * Takes a raw text string (title + body of a signal) and returns an array of
 * SignalEntity objects. All extraction is rule-based so it works offline and
 * without Ollama. No false precision: confidence tiers are explicit.
 *
 * Confidence tiers:
 *   0.90 -- entity found in a strong context phrase ("as a developer", "using Slack")
 *   0.75 -- known-list term found with weaker context
 *   0.60 -- known-list term found anywhere in text (fallback)
 */

import type { SignalEntity, EntityType } from '../types.js'
import {
  KNOWN_PERSONAS,
  KNOWN_TECHNOLOGIES,
  KNOWN_INDUSTRIES,
  PERSONA_CONTEXT_RE,
  TECH_CONTEXT_RE,
  INDUSTRY_CONTEXT_RE,
  WORKAROUND_RE,
  EXISTING_SOLUTION_RE,
  WORKFLOW_RE,
} from '../constants/entityPatterns.js'

function normalize(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function dedupe(entities) {
  const seen = new Map()
  for (const e of entities) {
    const key = e.type + '::' + e.value
    const existing = seen.get(key)
    if (!existing || e.confidence > existing.confidence) {
      seen.set(key, e)
    }
  }
  return [...seen.values()]
}

function isMeaningful(value) {
  if (value.length < 3) return false
  const STOPWORDS = new Set(['the', 'this', 'that', 'they', 'them', 'their',
    'with', 'from', 'just', 'also', 'much', 'more', 'some', 'very', 'have',
    'been', 'will', 'were', 'what', 'when', 'then', 'than', 'only', 'like'])
  return !STOPWORDS.has(normalize(value))
}

function matchKnownList(text, list, type, contextRe) {
  const lower = text.toLowerCase()
  const entities = []

  for (const re of contextRe) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(lower)) !== null) {
      const raw = (m[1] || '').trim()
      if (!isMeaningful(raw)) continue
      const matched = list.find((k) => raw.includes(k) || k.includes(raw))
      if (matched) {
        entities.push({ type, value: normalize(matched), rawText: m[1], confidence: 0.90 })
      }
    }
  }

  for (const term of list) {
    if (lower.includes(term)) {
      const alreadyHighConf = entities.some((e) => e.value === term && e.confidence >= 0.75)
      if (!alreadyHighConf) {
        entities.push({ type, value: term, rawText: term, confidence: 0.60 })
      }
    }
  }

  return entities
}

function matchWorkarounds(text) {
  const entities = []
  for (const re of WORKAROUND_RE) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      const raw = ((m[1] || m[0]) + '').trim().slice(0, 100)
      if (!isMeaningful(raw)) continue
      entities.push({ type: 'workaround', value: normalize(raw), rawText: raw, confidence: 0.90 })
    }
  }
  return entities
}

function matchExistingSolutions(text, knownTech) {
  const entities = []

  for (const re of EXISTING_SOLUTION_RE) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      const raw = (m[1] || '').trim()
      if (!isMeaningful(raw) || raw.length < 2) continue
      const lower = raw.toLowerCase()
      const isKnown   = knownTech.some((t) => lower === t || lower.includes(t))
      const looksLike = /^[A-Z]/.test(raw) && raw.length > 2
      if (isKnown || looksLike) {
        entities.push({
          type: 'existing_solution',
          value: normalize(raw),
          rawText: raw,
          confidence: isKnown ? 0.85 : 0.70,
        })
      }
    }
  }

  const lower = text.toLowerCase()
  for (const term of knownTech) {
    if (lower.includes(term)) {
      const idx = lower.indexOf(term)
      const window = text.slice(Math.max(0, idx - 30), idx + term.length + 20)
      if (/(?:use|using|tried?|switch(?:ed)? from|moved? from)/i.test(window)) {
        entities.push({ type: 'existing_solution', value: term, rawText: term, confidence: 0.80 })
      }
    }
  }

  return entities
}

function matchWorkflows(text) {
  const entities = []
  for (const re of WORKFLOW_RE) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      const raw = (m[1] || '').trim().slice(0, 80)
      if (!isMeaningful(raw) || raw.length < 5) continue
      entities.push({ type: 'workflow', value: normalize(raw), rawText: raw, confidence: 0.70 })
    }
  }
  return entities
}

export function extractEntities(text) {
  if (!text || text.length < 20) return []

  const all = [
    ...matchKnownList(text, KNOWN_PERSONAS,     'persona',           PERSONA_CONTEXT_RE),
    ...matchKnownList(text, KNOWN_TECHNOLOGIES,  'technology',        TECH_CONTEXT_RE),
    ...matchKnownList(text, KNOWN_INDUSTRIES,    'industry',          INDUSTRY_CONTEXT_RE),
    ...matchWorkarounds(text),
    ...matchExistingSolutions(text, KNOWN_TECHNOLOGIES),
    ...matchWorkflows(text),
  ]

  return dedupe(all)
}

export function hasEntitySignals(text) {
  const lower = text.toLowerCase()
  return (
    KNOWN_PERSONAS.some((p)     => lower.includes(p))  ||
    KNOWN_TECHNOLOGIES.some((t) => lower.includes(t))  ||
    KNOWN_INDUSTRIES.some((i)   => lower.includes(i))  ||
    /\b(?:workaround|manually|spreadsheet|script|copy.paste)\b/i.test(text)
  )
}
