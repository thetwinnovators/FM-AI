import type { AgentTaskPlan, AgentTaskStep, AgentTaskPlanStatus } from '../types.js'
import { appendTranscriptEntry } from './kvCacheContextService.js'

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const PLANS_KEY = 'flowmap.mcp.taskPlans'

interface PlansStore {
  [planId: string]: AgentTaskPlan
}

function readPlansStore(): PlansStore {
  try {
    const raw = localStorage.getItem(PLANS_KEY)
    return raw ? (JSON.parse(raw) as PlansStore) : {}
  } catch {
    return {}
  }
}

function writePlansStore(store: PlansStore): void {
  localStorage.setItem(PLANS_KEY, JSON.stringify(store))
}

export function savePlan(plan: AgentTaskPlan): void {
  const store = readPlansStore()
  store[plan.id] = plan
  writePlansStore(store)
}

export function loadPlan(planId: string): AgentTaskPlan | null {
  const store = readPlansStore()
  return store[planId] ?? null
}

export function listPlans(): AgentTaskPlan[] {
  const store = readPlansStore()
  return Object.values(store)
}

// ---------------------------------------------------------------------------
// Recitation
// ---------------------------------------------------------------------------

/**
 * Builds the human+model-readable recitation paragraph from the current plan state.
 */
export function refreshRecitation(plan: AgentTaskPlan): string {
  const total = plan.steps.length
  const completed = plan.steps.filter((s) => s.status === 'completed')
  const remaining = plan.steps.filter(
    (s) => s.status === 'pending' || s.status === 'running',
  )
  const failed = plan.steps.filter((s) => s.status === 'failed')

  const completedTitles =
    completed.length > 0 ? completed.map((s) => s.title).join(', ') : 'none'

  const remainingTitles =
    remaining.length > 0 ? remaining.map((s) => s.title).join(', ') : 'none'

  const blockers =
    failed.length > 0
      ? failed.map((s) => s.notes ?? 'unknown error').join(', ')
      : 'none'

  const firstPending = plan.steps.find((s) => s.status === 'pending')
  const next = firstPending ? firstPending.title : 'all steps complete'

  return [
    `Goal: ${plan.goal}`,
    `Status: ${plan.status}`,
    `Progress: ${completed.length} of ${total} steps completed`,
    `Completed: ${completedTitles}`,
    `Remaining: ${remainingTitles}`,
    `Blockers: ${blockers}`,
    `Next: ${next}`,
  ].join('\n')
}

/**
 * Serialises the plan's recitationSummary for injection into the next model prompt.
 */
export function recitationToPromptSection(plan: AgentTaskPlan): {
  tag: string
  body: string
} {
  return { tag: '[TASK]', body: plan.recitationSummary }
}

// ---------------------------------------------------------------------------
// Plan lifecycle
// ---------------------------------------------------------------------------

/**
 * Creates a new AgentTaskPlan for a goal with a list of steps.
 */
export function createTaskPlan(
  goal: string,
  steps: Array<{ title: string; toolName?: string }>,
): AgentTaskPlan {
  const random = Math.random().toString(36).slice(2, 8)
  const id = `plan_${Date.now().toString(36)}_${random}`
  const now = new Date().toISOString()

  const planSteps: AgentTaskStep[] = steps.map((s, i) => ({
    id: `step_${i}_${Math.random().toString(36).slice(2, 6)}`,
    title: s.title,
    toolName: s.toolName,
    status: 'pending',
  }))

  const partial: Omit<AgentTaskPlan, 'recitationSummary'> = {
    id,
    goal,
    status: 'planned',
    currentStep: undefined,
    steps: planSteps,
    createdAt: now,
    updatedAt: now,
    contextFiles: [],
    transcript: [],
  }

  // Build recitation with a fully typed plan (cast is safe — we fill the field immediately)
  const plan = partial as AgentTaskPlan
  plan.recitationSummary = refreshRecitation(plan)

  return plan
}

/**
 * Marks a step as started. Returns an updated plan (immutable — new object).
 */
export function startStep(plan: AgentTaskPlan, stepId: string): AgentTaskPlan {
  const step = plan.steps.find((s) => s.id === stepId)
  if (!step) return plan

  const updatedSteps: AgentTaskStep[] = plan.steps.map((s) =>
    s.id === stepId ? { ...s, status: 'running' as const } : s,
  )

  const updatedTranscript = appendTranscriptEntry(plan.transcript ?? [], {
    type: 'note',
    content: `Starting step: ${step.title}`,
  })

  const updated: AgentTaskPlan = {
    ...plan,
    status: 'running' as AgentTaskPlanStatus,
    currentStep: stepId,
    steps: updatedSteps,
    transcript: updatedTranscript,
    updatedAt: new Date().toISOString(),
    recitationSummary: '',
  }

  updated.recitationSummary = refreshRecitation(updated)
  return updated
}

/**
 * Marks a step as completed or failed. Returns an updated plan.
 */
export function completeStep(
  plan: AgentTaskPlan,
  stepId: string,
  result: {
    success: boolean
    toolName?: string
    outputSummary?: string
    errorReason?: string
  },
): AgentTaskPlan {
  const step = plan.steps.find((s) => s.id === stepId)
  if (!step) return plan

  const stepStatus = result.success ? 'completed' : 'failed'

  const updatedSteps: AgentTaskStep[] = plan.steps.map((s) => {
    if (s.id !== stepId) return s
    return {
      ...s,
      status: stepStatus as const,
      notes: result.errorReason,
    }
  })

  const transcriptEntry: Parameters<typeof appendTranscriptEntry>[1] = {
    type: 'tool_result',
    toolName: result.toolName,
    content: result.outputSummary ?? (result.success ? 'Step completed.' : 'Step failed.'),
    status: result.success ? 'success' : 'failed',
    errorReason: result.errorReason,
  }

  const updatedTranscript = appendTranscriptEntry(
    plan.transcript ?? [],
    transcriptEntry,
  )

  const allCompleted = updatedSteps.every((s) => s.status === 'completed')
  let newPlanStatus: AgentTaskPlanStatus

  if (result.success) {
    newPlanStatus = allCompleted ? 'completed' : 'running'
  } else {
    newPlanStatus = 'blocked'
  }

  const updated: AgentTaskPlan = {
    ...plan,
    status: newPlanStatus,
    currentStep: allCompleted ? undefined : plan.currentStep,
    steps: updatedSteps,
    transcript: updatedTranscript,
    updatedAt: new Date().toISOString(),
    recitationSummary: '',
  }

  updated.recitationSummary = refreshRecitation(updated)
  return updated
}
