import { describe, it, expect } from 'vitest'
import { parseVentureScopeLLMOutput, validateLLMOutput } from '../llmOutputParser.js'
import type { VentureScopeLLMInput, VentureScopeLLMOutput } from '../../types.js'

// ── Minimal fake input for validateLLMOutput ─────────────────────────────────

const fakeInput: VentureScopeLLMInput = {
  clusterName:      'Developers struggle with agent governance',
  angleType:        'workflow_first',
  angleDescription: 'Workflow-First angle',
  coreWedge:        'Governance gap in AI agent pipelines',
  opportunityScore: 72,
  isBuildable:      true,
  scoreSummary:     [],
  graphContext: {
    personas:          ['developer', 'engineer'],
    workflows:         ['agent deployment', 'policy enforcement'],
    workarounds:       ['manual review'],
    bottlenecks:       ['approval latency'],
    existingSolutions: ['AWS Step Functions'],
    emergingTech:      ['LLM agents'],
    industries:        ['enterprise software'],
    technologies:      ['TypeScript', 'Node.js'],
  },
  evidenceSnippets: [
    { text: 'Teams spend 3-4 hours manually reviewing agent actions', sourceType: 'save' },
    { text: 'No tooling exists for policy enforcement on LLM outputs', sourceType: 'document' },
  ],
}

// ── Raw output builder ────────────────────────────────────────────────────────

function makeRawOutput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'AI Agent Policy Enforcer',
    tagline: 'Automated governance for enterprise LLM pipelines',
    opportunitySummary: 'Enterprise teams have no tooling for enforcing policies on LLM agent actions before they execute.',
    problemStatement: 'Developer teams deploying LLM agents spend 3-4 hours per week manually reviewing agent decisions for compliance, with no automated enforcement layer.',
    targetUser: 'Platform engineers at enterprises running LLM agents in production',
    proposedSolution: 'A policy-as-code layer that intercepts LLM agent tool calls and evaluates them against configurable compliance rules before execution.',
    valueProp: 'Reduces manual review time by 80% while providing an audit trail for every agent action.',
    whyNow: 'LLM agents are entering production at enterprise scale but governance tooling does not exist yet.',
    buyerVsUser: 'Buyer: CISO or VP Engineering. User: Platform engineer.',
    currentAlternatives: 'Manual code review, custom scripts, or no enforcement at all.',
    existingWorkarounds: 'Engineers write custom guard functions that only cover known edge cases.',
    keyAssumptions: 'Teams are willing to add a latency layer (~50ms) in exchange for compliance guarantees.',
    successMetrics: 'Policy violations caught per week, reduction in manual review hours, audit trail completeness.',
    pricingHypothesis: '$200-400/month per team on a usage-based model tied to agent calls processed.',
    defensibility: 'Policy schema language becomes a switching cost once teams build their rule libraries.',
    goToMarketAngle: 'Target teams already using LangChain or CrewAI who are being asked by legal to add guardrails.',
    mvpScope: 'TypeScript SDK with 5 built-in policy templates. No UI in v1.',
    risks: 'Low adoption if latency overhead is unacceptable. Mitigate with async audit mode.',
    solutionModality: 'ai_native',
    aiRoleInSolution: 'AI evaluates agent tool calls against policy rules in real-time before execution.',
    chosenInterpretation: 'Platform engineers at enterprise software companies need automated policy enforcement for LLM agent tool calls before they execute.',
    alternateInterpretations: 'ML engineer | model output monitoring | analytics_monitoring; DevOps engineer | deployment pipeline guardrails | workflow_automation',
    ...overrides,
  }
}

// ── Score protection tests ─────────────────────────────────────────────────────

describe('parseVentureScopeLLMOutput — score protection', () => {
  it('strips top-level score fields returned by the LLM', () => {
    const result = parseVentureScopeLLMOutput({
      ...makeRawOutput(),
      opportunityScore: 95,
      confidenceScore: 0.8,
      painSeverity: 9,
    })
    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('opportunityScore')
    expect(result).not.toHaveProperty('confidenceScore')
    expect(result).not.toHaveProperty('painSeverity')
  })

  it('strips dimensionScores object returned by the LLM', () => {
    const result = parseVentureScopeLLMOutput({
      ...makeRawOutput(),
      dimensionScores: { painSeverity: 9, urgency: 7 },
    })
    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('dimensionScores')
  })
})

// ── Structural parsing tests ───────────────────────────────────────────────────

describe('parseVentureScopeLLMOutput — structural validation', () => {
  it('parses a valid complete output successfully', () => {
    const result = parseVentureScopeLLMOutput(makeRawOutput())
    expect(result).not.toBeNull()
  })

  it('returns null when a core field is empty', () => {
    const result = parseVentureScopeLLMOutput({ ...makeRawOutput(), title: '' })
    expect(result).toBeNull()
  })

  it('returns null when a core field is missing entirely', () => {
    const raw = makeRawOutput()
    delete raw['targetUser']
    const result = parseVentureScopeLLMOutput(raw)
    expect(result).toBeNull()
  })

  it('uses "other" fallback when solutionModality is empty', () => {
    const result = parseVentureScopeLLMOutput({ ...makeRawOutput(), solutionModality: '' })
    expect(result).not.toBeNull()
    expect((result as VentureScopeLLMOutput).solutionModality).toBe('other')
  })
})

// ── Content-level validation tests ────────────────────────────────────────────

describe('validateLLMOutput — solutionModality validation', () => {
  it('returns a warning containing "solutionModality" for an invalid modality value', () => {
    const parsed = parseVentureScopeLLMOutput(makeRawOutput()) as VentureScopeLLMOutput
    // Directly override the parsed result with an invalid modality
    const invalidOutput: VentureScopeLLMOutput = {
      ...parsed,
      solutionModality: 'robot' as VentureScopeLLMOutput['solutionModality'],
    }
    const warnings = validateLLMOutput(invalidOutput, fakeInput)
    const modalityWarning = warnings.some((w) => w.includes('solutionModality'))
    expect(modalityWarning).toBe(true)
  })

  it('returns no solutionModality warning for a valid modality', () => {
    const parsed = parseVentureScopeLLMOutput(makeRawOutput()) as VentureScopeLLMOutput
    const warnings = validateLLMOutput(parsed, fakeInput)
    const modalityWarning = warnings.some((w) => w.includes('solutionModality'))
    expect(modalityWarning).toBe(false)
  })
})

// ── Draft concept skepticism — interpretation field tests ─────────────────────
//
// These tests verify the parser correctly handles chosenInterpretation and
// alternateInterpretations — the fields that implement draft concept skepticism.
// They are supplementary fields: present when the model does interpretation reasoning,
// filled with '—' fallback when the model omits them.

describe('parseVentureScopeLLMOutput — interpretation fields', () => {
  it('parses chosenInterpretation when present', () => {
    const raw = makeRawOutput({
      chosenInterpretation: 'Platform engineers at fintech firms need a policy-as-code layer for LLM agent tool calls before execution.',
    })
    const result = parseVentureScopeLLMOutput(raw) as VentureScopeLLMOutput
    expect(result).not.toBeNull()
    expect(result.chosenInterpretation).toBe(
      'Platform engineers at fintech firms need a policy-as-code layer for LLM agent tool calls before execution.',
    )
  })

  it('parses alternateInterpretations when present', () => {
    const raw = makeRawOutput({
      alternateInterpretations: 'ML engineer | output monitoring dashboard | analytics_monitoring; Security engineer | compliance logging | governance_compliance',
    })
    const result = parseVentureScopeLLMOutput(raw) as VentureScopeLLMOutput
    expect(result).not.toBeNull()
    expect(result.alternateInterpretations).toContain('analytics_monitoring')
  })

  it('falls back to "—" when chosenInterpretation is absent (supplementary field)', () => {
    const raw = makeRawOutput()
    // Remove interpretation fields from the raw fixture to simulate a model that skipped them
    delete (raw as Record<string, unknown>)['chosenInterpretation']
    delete (raw as Record<string, unknown>)['alternateInterpretations']
    const result = parseVentureScopeLLMOutput(raw) as VentureScopeLLMOutput
    expect(result).not.toBeNull()
    // Supplementary fallback '—' is applied
    expect(result.chosenInterpretation).toBe('—')
    expect(result.alternateInterpretations).toBe('—')
  })

  it('accepts a full output with all interpretation fields populated', () => {
    // Simulates a model that correctly completes the full draft-skepticism reasoning
    const result = parseVentureScopeLLMOutput(makeRawOutput()) as VentureScopeLLMOutput
    expect(result).not.toBeNull()
    expect(typeof result.chosenInterpretation).toBe('string')
    expect(typeof result.alternateInterpretations).toBe('string')
    expect(result.chosenInterpretation!.length).toBeGreaterThan(0)
  })
})
