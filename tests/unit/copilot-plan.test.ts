import { describe, expect, it } from 'vitest'
import { buildCopilotPlan, approvePlanStep, COPILOT_PLAN_STEPS } from '../../functions/api/lib/copilot-plan'
import { emptyLiveContext } from '../../functions/api/lib/copilot-live-context'

describe('copilot-plan (COPILOT-RUNTIME-01)', () => {
  it('builds a 3-step supervised plan in order', () => {
    const plan = buildCopilotPlan('sess-1', emptyLiveContext('sess-1'))
    expect(plan.steps.map((s) => s.tool)).toEqual([...COPILOT_PLAN_STEPS])
    expect(plan.steps.every((s) => s.status === 'pending')).toBe(true)
  })

  it('approves or dismisses individual steps without mutating others', () => {
    const plan = buildCopilotPlan('sess-1', emptyLiveContext('sess-1'))
    const dismissed = approvePlanStep(plan, 'step-2', 'dismissed')
    expect(dismissed.steps[1]?.status).toBe('dismissed')
    expect(dismissed.steps[0]?.status).toBe('pending')
  })
})
