import { describe, it, expect } from 'vitest'
import { extractEntities, hasEntitySignals } from '../entityExtractor.js'
import type { SignalEntity, EntityType } from '../../types.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function ofType(entities: SignalEntity[], type: EntityType): SignalEntity[] {
  return entities.filter((e) => e.type === type)
}
function values(entities: SignalEntity[]): string[] {
  return entities.map((e) => e.value)
}

// ── extractEntities ───────────────────────────────────────────────────────────

describe('extractEntities', () => {
  it('returns [] for empty string', () => {
    expect(extractEntities('')).toEqual([])
  })

  it('returns [] for text shorter than 20 characters', () => {
    expect(extractEntities('too short')).toEqual([])
  })

  it('returns [] for text with no entity signals', () => {
    const result = extractEntities('the weather is nice today and everything is fine')
    expect(result).toEqual([])
  })

  // ── Persona extraction ──────────────────────────────────────────────────────

  it('extracts persona from known list (bare match, confidence 0.60)', () => {
    const result = extractEntities('I am a developer and I hate how slow the build process is every single day')
    const personas = ofType(result, 'persona')
    expect(values(personas)).toContain('developer')
  })

  it('extracts persona via context phrase (confidence 0.90)', () => {
    const result = extractEntities('As a product manager, I spend hours every week manually creating reports')
    const personas = ofType(result, 'persona')
    expect(values(personas)).toContain('product manager')
    const pm = personas.find((e) => e.value === 'product manager')
    expect(pm?.confidence).toBe(0.90)
  })

  it('extracts multiple personas when text mentions several roles', () => {
    const result = extractEntities(
      'Both the designer and the developer struggle with this workflow every single day',
    )
    const personas = ofType(result, 'persona')
    expect(values(personas)).toContain('developer')
    // designer is in KNOWN_PERSONAS
    expect(values(personas)).toContain('designer')
  })

  // ── Workaround extraction ───────────────────────────────────────────────────

  it('extracts workaround from "I built a script" pattern', () => {
    const result = extractEntities(
      'I built a script to manually export the data because our tool does not support it',
    )
    const workarounds = ofType(result, 'workaround')
    expect(workarounds.length).toBeGreaterThan(0)
    expect(workarounds[0].confidence).toBe(0.90)
  })

  it('extracts workaround from "manually [verb]" pattern', () => {
    const result = extractEntities(
      'We are manually copying data between systems every morning — very tedious',
    )
    const workarounds = ofType(result, 'workaround')
    expect(workarounds.length).toBeGreaterThan(0)
  })

  it('extracts workaround from "copy-paste" pattern', () => {
    const result = extractEntities(
      'I copy-paste between spreadsheets every day because nothing integrates properly',
    )
    const workarounds = ofType(result, 'workaround')
    expect(workarounds.length).toBeGreaterThan(0)
  })

  it('extracts workaround from explicit workaround vocabulary', () => {
    const result = extractEntities(
      'This is a total kludge but we resort to using a bash script as a workaround',
    )
    const workarounds = ofType(result, 'workaround')
    expect(workarounds.length).toBeGreaterThan(0)
  })

  // ── Technology extraction ───────────────────────────────────────────────────

  it('extracts technology from known list (Jira)', () => {
    const result = extractEntities(
      'Every time I open Jira the page freezes for 30 seconds — it is absolutely terrible',
    )
    const techs = ofType(result, 'technology')
    expect(values(techs)).toContain('jira')
  })

  it('extracts multiple technologies mentioned in the same signal', () => {
    const result = extractEntities(
      'We use Slack and GitHub and deploy via Docker — each has a different login',
    )
    const techs = ofType(result, 'technology')
    expect(values(techs)).toContain('slack')
    expect(values(techs)).toContain('github')
    expect(values(techs)).toContain('docker')
  })

  it('extracts technology context with higher confidence when preceded by "using"', () => {
    // If context regex is working, confidence should be 0.90; otherwise 0.60 from bare match
    const result = extractEntities(
      'I am using Jira for project management but it is far too slow for our needs',
    )
    const jira = ofType(result, 'technology').find((e) => e.value === 'jira')
    expect(jira).toBeDefined()
    // Context match from TECH_CONTEXT_RE gives 0.90; bare match gives 0.60
    expect(jira!.confidence).toBe(0.90)
  })

  // ── Existing solution extraction ────────────────────────────────────────────

  it('extracts existing_solution from "tried X but" pattern', () => {
    const result = extractEntities(
      'I tried Notion but it crashed every time I opened a large database',
    )
    const solutions = ofType(result, 'existing_solution')
    expect(solutions.length).toBeGreaterThan(0)
  })

  it('extracts existing_solution from "switched from X" pattern', () => {
    const result = extractEntities(
      'We switched from Linear to Jira but regretted it immediately',
    )
    const solutions = ofType(result, 'existing_solution')
    expect(solutions.length).toBeGreaterThan(0)
  })

  it('extracts existing_solution from "[Tool] does not have" pattern', () => {
    const result = extractEntities(
      'Notion does not have proper database relationships so we have to export manually',
    )
    const solutions = ofType(result, 'existing_solution')
    expect(solutions.length).toBeGreaterThan(0)
  })

  // ── Industry extraction ─────────────────────────────────────────────────────

  it('extracts industry from "in the [industry] space" pattern', () => {
    const result = extractEntities(
      'Working in the fintech space means compliance requirements make everything twice as hard',
    )
    const industries = ofType(result, 'industry')
    expect(values(industries)).toContain('fintech')
  })

  it('extracts industry from bare known-list match (healthcare)', () => {
    const result = extractEntities(
      'In healthcare, we deal with patient data constantly and the tools are completely outdated',
    )
    const industries = ofType(result, 'industry')
    expect(values(industries)).toContain('healthcare')
  })

  // ── Workflow extraction ─────────────────────────────────────────────────────

  it('extracts workflow from gerund phrase', () => {
    const result = extractEntities(
      'The process of onboarding new customers takes us two weeks — it should take two days',
    )
    const workflows = ofType(result, 'workflow')
    expect(workflows.length).toBeGreaterThan(0)
  })

  // ── Confidence and deduplication ────────────────────────────────────────────

  it('does not return duplicate entities with same type+value', () => {
    const result = extractEntities(
      'As a developer, our developer team struggles with Jira — the developer tooling is terrible',
    )
    const personas = ofType(result, 'persona')
    const devPersonas = personas.filter((e) => e.value === 'developer')
    expect(devPersonas.length).toBe(1)
  })

  it('keeps higher confidence when deduplicating', () => {
    // Context match (0.90) should win over bare match (0.60)
    const result = extractEntities(
      'As a product manager, I hate how product manager tasks pile up without proper tooling',
    )
    const pm = ofType(result, 'persona').find((e) => e.value === 'product manager')
    expect(pm?.confidence).toBe(0.90)
  })

  it('all confidence values are between 0 and 1', () => {
    const result = extractEntities(
      'As a developer, I built a script to manually export data from Jira every day in the fintech industry',
    )
    for (const entity of result) {
      expect(entity.confidence).toBeGreaterThan(0)
      expect(entity.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('multi-entity text returns all entity types', () => {
    const result = extractEntities(
      'As a product manager in the fintech space, I built a spreadsheet workaround ' +
      'because Jira does not support bulk export. We switched from Linear but that was worse.',
    )
    const types = new Set(result.map((e) => e.type))
    expect(types.has('persona')).toBe(true)
    expect(types.has('industry')).toBe(true)
    expect(types.has('workaround')).toBe(true)
    expect(types.has('technology')).toBe(true)
    expect(types.has('existing_solution')).toBe(true)
  })
})

// ── hasEntitySignals ──────────────────────────────────────────────────────────

describe('hasEntitySignals', () => {
  it('returns true for text containing a known persona', () => {
    expect(hasEntitySignals('I am a developer and I hate this tool so much')).toBe(true)
  })

  it('returns true for text containing a known technology', () => {
    expect(hasEntitySignals('Jira is incredibly slow and crashes constantly')).toBe(true)
  })

  it('returns true for text containing workaround keywords', () => {
    expect(hasEntitySignals('I manually export this every single morning')).toBe(true)
  })

  it('returns true for copy-paste keyword', () => {
    expect(hasEntitySignals('I copy-paste data between systems every day')).toBe(true)
  })

  it('returns false for text with no entity signals', () => {
    expect(hasEntitySignals('The sky is blue and the sun is warm today outside')).toBe(false)
  })
})
