import { describe, expect, it } from 'vitest'
import {
  COPILOT_L2_ALLOWED_TOOLS,
  validateL2PlanShape,
  validateL2ToolAllowed,
} from '../../functions/api/lib/agent-safety'
import { buildCopilotPlan, approvePlanStep } from '../../functions/api/lib/copilot-plan'
import { emptyLiveContext } from '../../functions/api/lib/copilot-live-context'

describe('agent-safety-eval-02 (SEC-AGENT-EVAL-02, ADR-0056)', () => {
  it('allows only whitelisted L2 tools', () => {
    for (const tool of COPILOT_L2_ALLOWED_TOOLS) {
      expect(validateL2ToolAllowed(tool).allowed).toBe(true)
    }
    expect(validateL2ToolAllowed('delete_session').allowed).toBe(false)
    expect(validateL2ToolAllowed('evil_cluster').allowed).toBe(false)
  })

  it('validates default 3-step copilot plan shape', () => {
    const plan = buildCopilotPlan('sess-1', {
      ...emptyLiveContext('sess-1'),
      isLive: true,
      connections: 12,
      participationRate: 0.4,
      optionTallies: [{ label: 'Speed', votes: 8 }],
    })
    expect(validateL2PlanShape(plan.steps)).toHaveLength(0)
    expect(plan.steps).toHaveLength(3)
  })

  it('rejects plans with blocked mutation tools', () => {
    const errors = validateL2PlanShape([{ tool: 'close_session' }])
    expect(errors.some((e) => e.includes('autonomous_mutation_blocked'))).toBe(true)
  })

  it('requires facilitator approval before step status changes from pending', () => {
    const plan = buildCopilotPlan('sess-2', emptyLiveContext('sess-2'))
    const approved = approvePlanStep(plan, 'step-1', 'approved')
    expect(approved.steps[0]?.status).toBe('approved')
    expect(approved.steps[1]?.status).toBe('pending')
  })
})
