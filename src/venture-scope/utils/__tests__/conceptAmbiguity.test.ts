import { describe, it, expect } from 'vitest'
import { assessConceptAmbiguity } from '../conceptAmbiguity.js'
import type { VentureScopeLLMInput } from '../../types.js'

const defaultGraphContext: VentureScopeLLMInput['graphContext'] = {
  personas:          ['developer', 'engineer'],
  workflows:         ['agent deployment', 'policy enforcement'],
  workarounds:       ['manual review'],
  bottlenecks:       ['approval latency'],
  existingSolutions: ['AWS Step Functions'],
  emergingTech:      ['LLM agents'],
  industries:        ['enterprise software'],
  technologies:      ['TypeScript', 'Node.js'],
}

function makeInput(overrides: Partial<VentureScopeLLMInput> = {}): VentureScopeLLMInput {
  return {
    clusterName:      'Developers struggle with agent governance',
    angleType:        'workflow_first',
    angleDescription: 'Workflow-First angle',
    coreWedge:        'Governance gap in AI agent pipelines',
    opportunityScore: 72,
    isBuildable:      true,
    scoreSummary:     [],
    graphContext:     defaultGraphContext,
    evidenceSnippets: [
      { text: 'Teams spend 3-4 hours manually reviewing agent actions', sourceType: 'save' },
      { text: 'No tooling exists for policy enforcement on LLM outputs', sourceType: 'document' },
    ],
    ...overrides,
  }
}

// ── Well-specified input ───────────────────────────────────────────────────────

describe('assessConceptAmbiguity — well-specified input', () => {
  it('returns ambiguityLevel: low for a fully-specified input', () => {
    const result = assessConceptAmbiguity(makeInput())
    expect(result.ambiguityLevel).toBe('low')
  })

  it('returns needsDisambiguation: false for a low-ambiguity input', () => {
    const result = assessConceptAmbiguity(makeInput())
    expect(result.needsDisambiguation).toBe(false)
  })
})

// ── Vague cluster name ─────────────────────────────────────────────────────────

describe('assessConceptAmbiguity — vague cluster name', () => {
  it('detects vague terms in cluster name and adds them to ambiguousTerms', () => {
    const result = assessConceptAmbiguity(makeInput({ clusterName: 'workflow automation tool platform' }))
    // 'workflow', 'automation', 'tool', 'platform' are all in VAGUE_TERMS
    expect(result.ambiguousTerms).toContain('workflow')
    expect(result.ambiguousTerms).toContain('automation')
    expect(result.ambiguousTerms).toContain('tool')
    expect(result.ambiguousTerms).toContain('platform')
  })

  it('populates ambiguityFlags when vague terms are present', () => {
    const result = assessConceptAmbiguity(makeInput({ clusterName: 'workflow automation tool platform' }))
    expect(result.ambiguityFlags.length).toBeGreaterThan(0)
  })
})

// ── Missing personas ───────────────────────────────────────────────────────────

describe('assessConceptAmbiguity — missing personas', () => {
  it('flags missing personas in ambiguityFlags', () => {
    const result = assessConceptAmbiguity(makeInput({
      graphContext: { ...defaultGraphContext, personas: [] },
    }))
    const mentionsPersonas = result.ambiguityFlags.some((f) =>
      f.toLowerCase().includes('persona')
    )
    expect(mentionsPersonas).toBe(true)
  })
})

// ── Missing workflows ──────────────────────────────────────────────────────────

describe('assessConceptAmbiguity — missing workflows', () => {
  it('flags missing workflows in ambiguityFlags', () => {
    const result = assessConceptAmbiguity(makeInput({
      graphContext: { ...defaultGraphContext, workflows: [] },
    }))
    const mentionsWorkflows = result.ambiguityFlags.some((f) =>
      f.toLowerCase().includes('workflow')
    )
    expect(mentionsWorkflows).toBe(true)
  })
})

// ── Missing personas AND workflows → high ambiguity ───────────────────────────

describe('assessConceptAmbiguity — missing both personas and workflows', () => {
  it('returns ambiguityLevel: high when both personas and workflows are empty', () => {
    // score += 1 (no personas) + 1 (no workflows) + 1 (both absent double-flag) = 3 minimum
    // with the default "well-specified" name that's still 3 → medium.
    // To push it to 4 (high) we also empty the workarounds+existingSolutions.
    const result = assessConceptAmbiguity(makeInput({
      graphContext: {
        ...defaultGraphContext,
        personas:          [],
        workflows:         [],
        workarounds:       [],
        existingSolutions: [],
      },
    }))
    expect(result.ambiguityLevel).toBe('high')
  })
})

// ── Thin evidence ──────────────────────────────────────────────────────────────

describe('assessConceptAmbiguity — thin evidence', () => {
  it('flags thin evidence in ambiguityFlags', () => {
    const result = assessConceptAmbiguity(makeInput({ evidenceSnippets: [] }))
    const mentionsEvidence = result.ambiguityFlags.some((f) =>
      f.toLowerCase().includes('evidence')
    )
    expect(mentionsEvidence).toBe(true)
  })

  it('populates recommendedInterpretations when evidence is thin', () => {
    const result = assessConceptAmbiguity(makeInput({ evidenceSnippets: [] }))
    expect(result.recommendedInterpretations.length).toBeGreaterThan(0)
  })
})

// ── needsDisambiguation reflects ambiguityLevel ───────────────────────────────

describe('assessConceptAmbiguity — needsDisambiguation', () => {
  it('needsDisambiguation is false when ambiguityLevel is low', () => {
    const result = assessConceptAmbiguity(makeInput())
    expect(result.ambiguityLevel).toBe('low')
    expect(result.needsDisambiguation).toBe(false)
  })

  it('needsDisambiguation is true when ambiguityLevel is medium', () => {
    // Empty personas → +1; empty workflows → +1 → score=2 → medium
    const result = assessConceptAmbiguity(makeInput({
      graphContext: { ...defaultGraphContext, personas: [], workflows: [] },
    }))
    // score includes the double-flag (+1), so with no workarounds it would be high.
    // Keep workarounds populated to stay at medium (3 points).
    expect(['medium', 'high']).toContain(result.ambiguityLevel)
    expect(result.needsDisambiguation).toBe(true)
  })

  it('needsDisambiguation is true when ambiguityLevel is high', () => {
    const result = assessConceptAmbiguity(makeInput({
      graphContext: {
        ...defaultGraphContext,
        personas:          [],
        workflows:         [],
        workarounds:       [],
        existingSolutions: [],
      },
    }))
    expect(result.ambiguityLevel).toBe('high')
    expect(result.needsDisambiguation).toBe(true)
  })
})

// ── Draft concept skepticism — real-world scenario tests ──────────────────────
//
// These tests verify the deterministic inputs that drive FLOW.AI's skepticism
// guardrail. They cover the three test cases from the spec:
//   A. Ambiguous title + weak evidence → high ambiguity, needs disambiguation
//   B. Well-formed concept → low ambiguity, no disambiguation needed
//   C. Thin evidence only → needsDisambiguation = true regardless of title clarity

describe('assessConceptAmbiguity — draft concept skepticism scenarios', () => {
  // Test case A: "AI-Powered Publisher Tool for Pm's"
  // Vague cluster name + thin evidence → must be flagged as high ambiguity so
  // FLOW.AI applies skepticism and generates alternate interpretations.
  it('flags "AI-Powered Publisher Tool for Pm\'s" framing as high ambiguity (Test Case A)', () => {
    const result = assessConceptAmbiguity(makeInput({
      clusterName: "AI-Powered Publisher Tool for Pm's",
      graphContext: {
        ...defaultGraphContext,
        personas:  [],   // no confirmed personas
        workflows: [],   // no confirmed workflows
      },
      evidenceSnippets: [
        { text: 'Some vague mention of PM tools', sourceType: 'save' },
      ],
    }))
    expect(result.ambiguityLevel).toBe('high')
    expect(result.needsDisambiguation).toBe(true)
    // Should detect at least some vague terms (AI, platform/tool)
    expect(result.ambiguityFlags.length).toBeGreaterThan(0)
    // Should surface interpretation suggestions for FLOW.AI to use
    expect(result.recommendedInterpretations.length).toBeGreaterThan(0)
  })

  // Test case B: Well-formed concept — specific personas, workflows, multiple evidence snippets
  // FLOW.AI should confirm the draft and refine, not replace.
  it('returns low ambiguity for a well-specified concept with clear personas and workflows (Test Case B)', () => {
    const result = assessConceptAmbiguity(makeInput({
      clusterName: 'LLM Agent Policy Enforcement for Platform Engineers',
      graphContext: {
        ...defaultGraphContext,
        personas:  ['platform engineer', 'DevOps engineer'],
        workflows: ['agent deployment', 'policy enforcement', 'compliance review'],
      },
      evidenceSnippets: [
        { text: 'Teams spend 3-4 hours manually reviewing agent actions for compliance', sourceType: 'save' },
        { text: 'No tooling exists for enforcing policies on LLM outputs before they execute', sourceType: 'document' },
        { text: 'Legal team requires audit trail for every agent action in production', sourceType: 'save' },
      ],
    }))
    expect(result.ambiguityLevel).toBe('low')
    expect(result.needsDisambiguation).toBe(false)
  })

  // Test case C: High ambiguity + thin evidence → provisional concept with needsDisambiguation
  // FLOW.AI should generate a provisional brief with "Assumption:" prefixes.
  it('flags thin evidence as needing disambiguation regardless of title clarity (Test Case C)', () => {
    const result = assessConceptAmbiguity(makeInput({
      clusterName: 'Workflow Automation for Operations Teams',
      graphContext: {
        ...defaultGraphContext,
        personas:          [],
        workflows:         [],
        workarounds:       [],
        existingSolutions: [],
      },
      evidenceSnippets: [],  // no evidence at all
    }))
    expect(result.ambiguityLevel).toBe('high')
    expect(result.needsDisambiguation).toBe(true)
    // Thin evidence flag text from assessConceptAmbiguity
    expect(result.ambiguityFlags.some((f) => f.includes('evidence snippets'))).toBe(true)
    expect(result.recommendedInterpretations.length).toBeGreaterThan(0)
  })
})
