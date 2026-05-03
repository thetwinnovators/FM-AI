import { beforeEach, describe, expect, it } from 'vitest'
import {
  createTaskPlan,
  startStep,
  completeStep,
  refreshRecitation,
  recitationToPromptSection,
  savePlan,
  loadPlan,
  listPlans,
} from '../taskRecitationService.js'
import type { AgentTaskPlan } from '../../types.js'

const PLANS_KEY = 'flowmap.mcp.taskPlans'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(overrides: Partial<Parameters<typeof createTaskPlan>[1]> = []): AgentTaskPlan {
  return createTaskPlan('Research quantum computing', [
    { title: 'Search web', toolName: 'web_search' },
    { title: 'Summarise results', toolName: 'llm_summarise' },
    { title: 'Save to document', toolName: 'doc_write' },
  ])
}

beforeEach(() => {
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// 1. createTaskPlan
// ---------------------------------------------------------------------------

describe('createTaskPlan', () => {
  it('returns a plan with the correct goal', () => {
    const plan = createTaskPlan('My goal', [{ title: 'Do thing' }])
    expect(plan.goal).toBe('My goal')
  })

  it('id starts with plan_', () => {
    const plan = createTaskPlan('goal', [])
    expect(plan.id).toMatch(/^plan_/)
  })

  it('status is planned', () => {
    const plan = createTaskPlan('goal', [{ title: 'step 1' }])
    expect(plan.status).toBe('planned')
  })

  it('currentStep is undefined', () => {
    const plan = createTaskPlan('goal', [{ title: 'step 1' }])
    expect(plan.currentStep).toBeUndefined()
  })

  it('all steps have status pending', () => {
    const plan = createTaskPlan('goal', [
      { title: 'A' },
      { title: 'B' },
      { title: 'C' },
    ])
    for (const step of plan.steps) {
      expect(step.status).toBe('pending')
    }
  })

  it('steps carry toolName when provided', () => {
    const plan = createTaskPlan('goal', [{ title: 'Search', toolName: 'web_search' }])
    expect(plan.steps[0].toolName).toBe('web_search')
  })

  it('transcript defaults to empty array', () => {
    const plan = createTaskPlan('goal', [])
    expect(plan.transcript).toEqual([])
  })

  it('contextFiles defaults to empty array', () => {
    const plan = createTaskPlan('goal', [])
    expect(plan.contextFiles).toEqual([])
  })

  it('recitationSummary contains the goal', () => {
    const plan = createTaskPlan('Understand LLMs', [{ title: 'Read paper' }])
    expect(plan.recitationSummary).toContain('Understand LLMs')
  })

  it('generates unique ids for separate plans', () => {
    const a = createTaskPlan('goal A', [])
    const b = createTaskPlan('goal B', [])
    expect(a.id).not.toBe(b.id)
  })
})

// ---------------------------------------------------------------------------
// 2. startStep
// ---------------------------------------------------------------------------

describe('startStep', () => {
  it('sets the target step status to running', () => {
    const plan = makePlan()
    const stepId = plan.steps[0].id
    const updated = startStep(plan, stepId)
    const step = updated.steps.find((s) => s.id === stepId)!
    expect(step.status).toBe('running')
  })

  it('sets plan status to running', () => {
    const plan = makePlan()
    const updated = startStep(plan, plan.steps[0].id)
    expect(updated.status).toBe('running')
  })

  it('sets plan.currentStep to the given stepId', () => {
    const plan = makePlan()
    const stepId = plan.steps[1].id
    const updated = startStep(plan, stepId)
    expect(updated.currentStep).toBe(stepId)
  })

  it('appends a note transcript entry', () => {
    const plan = makePlan()
    const updated = startStep(plan, plan.steps[0].id)
    expect(updated.transcript).toHaveLength(1)
    expect(updated.transcript![0].type).toBe('note')
  })

  it('note content includes the step title', () => {
    const plan = makePlan()
    const stepId = plan.steps[0].id
    const updated = startStep(plan, stepId)
    expect(updated.transcript![0].content).toContain('Search web')
  })

  it('recitationSummary is updated', () => {
    const plan = makePlan()
    const updated = startStep(plan, plan.steps[0].id)
    expect(updated.recitationSummary).toContain('running')
  })

  it('does not mutate the original plan', () => {
    const plan = makePlan()
    const originalStatus = plan.status
    startStep(plan, plan.steps[0].id)
    expect(plan.status).toBe(originalStatus)
  })

  it('returns original plan unchanged when stepId not found', () => {
    const plan = makePlan()
    const updated = startStep(plan, 'nonexistent_id')
    expect(updated).toBe(plan)
  })
})

// ---------------------------------------------------------------------------
// 3. completeStep — success path
// ---------------------------------------------------------------------------

describe('completeStep (success)', () => {
  it('sets the step status to completed', () => {
    const plan = makePlan()
    let updated = startStep(plan, plan.steps[0].id)
    updated = completeStep(updated, plan.steps[0].id, { success: true })
    const step = updated.steps.find((s) => s.id === plan.steps[0].id)!
    expect(step.status).toBe('completed')
  })

  it('plan status remains running when not all steps done', () => {
    const plan = makePlan()
    let updated = startStep(plan, plan.steps[0].id)
    updated = completeStep(updated, plan.steps[0].id, { success: true })
    expect(updated.status).toBe('running')
  })

  it('plan status becomes completed when all steps done', () => {
    let plan = makePlan()
    for (const step of plan.steps) {
      plan = startStep(plan, step.id)
      plan = completeStep(plan, step.id, { success: true })
    }
    expect(plan.status).toBe('completed')
  })

  it('currentStep becomes undefined after all steps complete', () => {
    let plan = makePlan()
    for (const step of plan.steps) {
      plan = startStep(plan, step.id)
      plan = completeStep(plan, step.id, { success: true })
    }
    expect(plan.currentStep).toBeUndefined()
  })

  it('appends a tool_result transcript entry', () => {
    const plan = makePlan()
    let updated = startStep(plan, plan.steps[0].id)
    updated = completeStep(updated, plan.steps[0].id, {
      success: true,
      outputSummary: 'Found 10 results',
    })
    const toolResults = updated.transcript!.filter((e) => e.type === 'tool_result')
    expect(toolResults).toHaveLength(1)
    expect(toolResults[0].status).toBe('success')
  })

  it('transcript entry includes outputSummary as content', () => {
    const plan = makePlan()
    let updated = startStep(plan, plan.steps[0].id)
    updated = completeStep(updated, plan.steps[0].id, {
      success: true,
      outputSummary: 'Found 10 results',
    })
    const entry = updated.transcript!.find((e) => e.type === 'tool_result')!
    expect(entry.content).toBe('Found 10 results')
  })
})

// ---------------------------------------------------------------------------
// 4. completeStep — failure path
// ---------------------------------------------------------------------------

describe('completeStep (failure)', () => {
  it('sets the step status to failed', () => {
    const plan = makePlan()
    let updated = startStep(plan, plan.steps[0].id)
    updated = completeStep(updated, plan.steps[0].id, {
      success: false,
      errorReason: 'network timeout',
    })
    const step = updated.steps.find((s) => s.id === plan.steps[0].id)!
    expect(step.status).toBe('failed')
  })

  it('plan status becomes blocked', () => {
    const plan = makePlan()
    let updated = startStep(plan, plan.steps[0].id)
    updated = completeStep(updated, plan.steps[0].id, {
      success: false,
      errorReason: 'network timeout',
    })
    expect(updated.status).toBe('blocked')
  })

  it('transcript entry has status failed', () => {
    const plan = makePlan()
    let updated = startStep(plan, plan.steps[0].id)
    updated = completeStep(updated, plan.steps[0].id, {
      success: false,
      errorReason: 'permission denied',
    })
    const entry = updated.transcript!.find((e) => e.type === 'tool_result')!
    expect(entry.status).toBe('failed')
  })

  it('transcript entry includes errorReason', () => {
    const plan = makePlan()
    let updated = startStep(plan, plan.steps[0].id)
    updated = completeStep(updated, plan.steps[0].id, {
      success: false,
      errorReason: 'permission denied',
    })
    const entry = updated.transcript!.find((e) => e.type === 'tool_result')!
    expect(entry.errorReason).toBe('permission denied')
  })

  it('recitationSummary includes the error reason in Blockers', () => {
    const plan = makePlan()
    let updated = startStep(plan, plan.steps[0].id)
    updated = completeStep(updated, plan.steps[0].id, {
      success: false,
      errorReason: 'rate limit hit',
    })
    expect(updated.recitationSummary).toContain('rate limit hit')
  })
})

// ---------------------------------------------------------------------------
// 5. refreshRecitation
// ---------------------------------------------------------------------------

describe('refreshRecitation', () => {
  it('contains a Goal line', () => {
    const plan = makePlan()
    expect(refreshRecitation(plan)).toContain('Goal:')
  })

  it('contains a Status line', () => {
    const plan = makePlan()
    expect(refreshRecitation(plan)).toContain('Status:')
  })

  it('contains a Progress line', () => {
    const plan = makePlan()
    expect(refreshRecitation(plan)).toContain('Progress:')
  })

  it('contains a Completed line', () => {
    const plan = makePlan()
    expect(refreshRecitation(plan)).toContain('Completed:')
  })

  it('contains a Remaining line', () => {
    const plan = makePlan()
    expect(refreshRecitation(plan)).toContain('Remaining:')
  })

  it('contains a Blockers line', () => {
    const plan = makePlan()
    expect(refreshRecitation(plan)).toContain('Blockers:')
  })

  it('contains a Next line', () => {
    const plan = makePlan()
    expect(refreshRecitation(plan)).toContain('Next:')
  })

  it('reflects the correct progress count', () => {
    let plan = makePlan()
    plan = startStep(plan, plan.steps[0].id)
    plan = completeStep(plan, plan.steps[0].id, { success: true })
    expect(refreshRecitation(plan)).toContain('1 of 3 steps completed')
  })

  it('Completed lists completed step titles', () => {
    let plan = makePlan()
    plan = startStep(plan, plan.steps[0].id)
    plan = completeStep(plan, plan.steps[0].id, { success: true })
    const recitation = refreshRecitation(plan)
    expect(recitation).toContain('Search web')
  })

  it('Next shows "all steps complete" when done', () => {
    let plan = makePlan()
    for (const step of plan.steps) {
      plan = startStep(plan, step.id)
      plan = completeStep(plan, step.id, { success: true })
    }
    expect(refreshRecitation(plan)).toContain('all steps complete')
  })

  it('Blockers is "none" when no failures', () => {
    const plan = makePlan()
    expect(refreshRecitation(plan)).toContain('Blockers: none')
  })
})

// ---------------------------------------------------------------------------
// 6. recitationToPromptSection
// ---------------------------------------------------------------------------

describe('recitationToPromptSection', () => {
  it('tag is "[TASK]"', () => {
    const plan = makePlan()
    const section = recitationToPromptSection(plan)
    expect(section.tag).toBe('[TASK]')
  })

  it('body matches recitationSummary', () => {
    const plan = makePlan()
    const section = recitationToPromptSection(plan)
    expect(section.body).toBe(plan.recitationSummary)
  })

  it('body contains the goal', () => {
    const plan = createTaskPlan('Learn TypeScript', [{ title: 'Read docs' }])
    const section = recitationToPromptSection(plan)
    expect(section.body).toContain('Learn TypeScript')
  })
})

// ---------------------------------------------------------------------------
// 7. savePlan / loadPlan / listPlans
// ---------------------------------------------------------------------------

describe('savePlan / loadPlan / listPlans', () => {
  it('loadPlan returns null when no plans have been saved', () => {
    expect(loadPlan('plan_nonexistent')).toBeNull()
  })

  it('savePlan then loadPlan round-trips the plan', () => {
    const plan = makePlan()
    savePlan(plan)
    const loaded = loadPlan(plan.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe(plan.id)
    expect(loaded!.goal).toBe(plan.goal)
  })

  it('loaded plan has all steps', () => {
    const plan = makePlan()
    savePlan(plan)
    const loaded = loadPlan(plan.id)!
    expect(loaded.steps).toHaveLength(plan.steps.length)
  })

  it('loaded plan preserves recitationSummary', () => {
    const plan = makePlan()
    savePlan(plan)
    const loaded = loadPlan(plan.id)!
    expect(loaded.recitationSummary).toBe(plan.recitationSummary)
  })

  it('listPlans returns an empty array when no plans saved', () => {
    expect(listPlans()).toEqual([])
  })

  it('listPlans returns all saved plans', () => {
    const a = createTaskPlan('Goal A', [{ title: 'Step 1' }])
    const b = createTaskPlan('Goal B', [{ title: 'Step 2' }])
    savePlan(a)
    savePlan(b)
    const plans = listPlans()
    expect(plans).toHaveLength(2)
    const ids = plans.map((p) => p.id)
    expect(ids).toContain(a.id)
    expect(ids).toContain(b.id)
  })

  it('saving an updated plan overwrites the previous version', () => {
    const plan = makePlan()
    savePlan(plan)

    const updated = startStep(plan, plan.steps[0].id)
    savePlan(updated)

    const loaded = loadPlan(plan.id)!
    expect(loaded.status).toBe('running')
  })

  it('localStorage key is flowmap.mcp.taskPlans', () => {
    const plan = makePlan()
    savePlan(plan)
    const raw = localStorage.getItem(PLANS_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toHaveProperty(plan.id)
  })

  it('saving multiple plans does not overwrite earlier ones', () => {
    const a = createTaskPlan('Goal A', [])
    const b = createTaskPlan('Goal B', [])
    savePlan(a)
    savePlan(b)
    expect(loadPlan(a.id)).not.toBeNull()
    expect(loadPlan(b.id)).not.toBeNull()
  })
})
