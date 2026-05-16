import { describe, it, expect } from 'vitest'
import { parseConceptUpdate } from '../parseConceptUpdate.js'

// ── Minimal concept fixture ───────────────────────────────────────────────────

const BASE_CONCEPT = {
  id: 'concept-test-001',
  clusterId: 'cluster-test-001',
  rank: 1,
  title: 'AI-Powered Publisher Tool for Pm\'s',
  tagline: 'Helps PMs publish AI content',
  opportunitySummary: 'Vague summary.',
  generatedBy: 'ollama',
  createdAt: '2024-01-01T00:00:00.000Z',
}

// ── Draft concept skepticism — chosenInterpretation / alternateInterpretations ─

describe('parseConceptUpdate — draft concept skepticism fields', () => {
  // Test case A: Ambiguous title, model replaces with a different interpretation.
  // Flow.AI detects the vague "Pm's" framing and re-anchors to a specific workflow.
  it('maps "Chosen Interpretation" heading to chosenInterpretation field', () => {
    const aiText = `
## Chosen Interpretation
Product managers at B2B SaaS companies publishing changelog and release notes need a structured templating layer that enforces brand voice and completeness rules before publishing.

## Problem Statement
PMs at SaaS companies manually write changelogs in Notion with no consistency, causing customer confusion and support tickets.
`.trim()

    const result = parseConceptUpdate(aiText, BASE_CONCEPT)
    expect(result.chosenInterpretation).toContain('Product managers at B2B SaaS')
    expect(result.problemStatement).toContain('PMs at SaaS companies')
    // The draft title should be preserved in the concept (FLOW.AI will update title separately)
    expect(result.generatedBy).toBe('flow_ai_enhanced')
  })

  it('maps "Alternate Interpretations" heading to alternateInterpretations field', () => {
    const aiText = `
## Chosen Interpretation
Product managers at B2B SaaS companies need structured release note tooling with brand-voice enforcement.

## Alternate Interpretations
Technical writer | developer documentation workflow | workflow_automation
Content strategist | brand content calendar | rules_based
`.trim()

    const result = parseConceptUpdate(aiText, BASE_CONCEPT)
    expect(result.chosenInterpretation).toContain('Product managers at B2B SaaS')
    expect(result.alternateInterpretations).toContain('workflow_automation')
    expect(result.alternateInterpretations).toContain('rules_based')
  })

  it('maps "Alternate Interpretation" (singular) alias to alternateInterpretations', () => {
    const aiText = `
## Alternate Interpretation
DevRel engineer | developer changelog | workflow_automation
`.trim()

    const result = parseConceptUpdate(aiText, BASE_CONCEPT)
    expect(result.alternateInterpretations).toContain('DevRel engineer')
  })

  it('maps "Alternatives Considered" alias to alternateInterpretations', () => {
    const aiText = `
## Alternatives Considered
Content ops manager | editorial workflow tool | governance_compliance
`.trim()

    const result = parseConceptUpdate(aiText, BASE_CONCEPT)
    expect(result.alternateInterpretations).toContain('Content ops manager')
  })

  // Test case B: Strong, well-formed concept — model confirms alignment.
  it('stores interpretation fields alongside existing fields when concept is well-formed', () => {
    const wellFormedConcept = {
      ...BASE_CONCEPT,
      title: 'LLM Agent Policy Enforcer',
      tagline: 'Policy-as-code layer for enterprise LLM agent tool calls',
      ambiguityLevel: 'low',
    }
    const aiText = `
## Chosen Interpretation
Chosen interpretation aligns with draft: Platform engineers need automated compliance enforcement for LLM agent tool calls before execution.

## Problem Statement
Enterprise teams deploying LLM agents have no tooling to enforce policies on agent tool calls before they execute.

## Proposed Solution
A TypeScript SDK that intercepts agent tool calls and evaluates them against configurable compliance rules.
`.trim()

    const result = parseConceptUpdate(aiText, wellFormedConcept)
    // chosenInterpretation confirms draft alignment (not a replacement)
    expect(result.chosenInterpretation).toContain('aligns with draft')
    expect(result.problemStatement).toContain('Enterprise teams deploying LLM agents')
    expect(result.proposedSolution).toContain('TypeScript SDK')
    expect(result.generatedBy).toBe('flow_ai_enhanced')
  })

  // Test case C: High ambiguity + thin evidence — model flags needsDisambiguation.
  it('preserves ambiguityLevel from existing concept when not overwritten', () => {
    const ambiguousConcept = {
      ...BASE_CONCEPT,
      ambiguityLevel: 'high',
      ambiguityFlags: ['vague cluster name', 'missing personas'],
    }
    const aiText = `
## Chosen Interpretation
Assumption: Based on limited evidence, this appears to be a publishing workflow tool for a role that could be product manager, project manager, or program manager.

## Problem Statement
Assumption: The role referenced as "Pm" likely refers to product managers who manually compile and publish release notes, though the evidence does not confirm this.
`.trim()

    const result = parseConceptUpdate(aiText, ambiguousConcept)
    // ambiguityLevel is NOT a mapped heading — it should be preserved from the original concept
    expect(result.ambiguityLevel).toBe('high')
    // The Assumption: prefix should be preserved in the text
    expect(result.chosenInterpretation).toContain('Assumption:')
    expect(result.problemStatement).toContain('Assumption:')
  })
})

// ── Field mapping correctness ─────────────────────────────────────────────────

describe('parseConceptUpdate — field mapping', () => {
  it('maps standard fields correctly alongside interpretation fields', () => {
    const aiText = `
## Chosen Interpretation
Product managers at SaaS companies need structured release note tooling.

## Problem Statement
PMs manually write changelogs with no enforcement layer.

## Solution Modality
workflow_automation

## AI Role in Solution
N/A — the core value is structured templates and brand-voice rules, not AI.
`.trim()

    const result = parseConceptUpdate(aiText, BASE_CONCEPT)
    expect(result.chosenInterpretation).toContain('Product managers at SaaS')
    expect(result.problemStatement).toContain('manually write changelogs')
    expect(result.solutionModality).toBe('workflow_automation')
    expect(result.aiRoleInSolution).toContain('N/A')
  })

  it('stores unrecognised headings in enhancementNotes', () => {
    const aiText = `
## Chosen Interpretation
Engineers need a policy layer.

## Some Unknown Section
This content should go into enhancementNotes.
`.trim()

    const result = parseConceptUpdate(aiText, BASE_CONCEPT)
    expect(result.chosenInterpretation).toContain('Engineers need a policy layer')
    // Parser lowercases heading keys, then re-capitalises only the first char
    expect(result.enhancementNotes).toContain('Some unknown section')
  })

  it('returns the original concept if aiText is empty', () => {
    const result = parseConceptUpdate('', BASE_CONCEPT)
    expect(result).toEqual(BASE_CONCEPT)
  })
})
