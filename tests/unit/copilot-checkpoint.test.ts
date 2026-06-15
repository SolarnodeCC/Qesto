import { describe, expect, it } from 'vitest'
import {
  shouldBroadcastStep,
  summarizeStepOutput,
  buildCheckpointBroadcast,
} from '../../functions/api/lib/copilot-checkpoint'
import type { CopilotPlanStep } from '../../functions/api/lib/copilot-plan'

function step(partial: Partial<CopilotPlanStep>): CopilotPlanStep {
  return {
    id: 'step-1',
    tool: 'cluster_themes',
    status: 'pending',
    output: { themes: [{ label: 'Pricing', votes: 4, share: 0.5 }] },
    ...partial,
  }
}

describe('COPILOT-CHECKPOINT-01', () => {
  it('only broadcasts approved steps', () => {
    expect(shouldBroadcastStep({ status: 'approved' })).toBe(true)
    expect(shouldBroadcastStep({ status: 'pending' })).toBe(false)
    expect(shouldBroadcastStep({ status: 'dismissed' })).toBe(false)
  })

  it('summarizes the top theme', () => {
    expect(summarizeStepOutput(step({}))).toBe('Top theme: Pricing')
  })

  it('summarizes an anomaly', () => {
    const s = step({ tool: 'detect_anomaly', output: { summary: 'Participation dropped' } })
    expect(summarizeStepOutput(s)).toBe('Participation dropped')
  })

  it('returns null for a non-approved step (no broadcast)', () => {
    expect(buildCheckpointBroadcast(step({ status: 'pending' }))).toBeNull()
    expect(buildCheckpointBroadcast(step({ status: 'dismissed' }))).toBeNull()
  })

  it('builds a checkpoint frame for an approved step', () => {
    const frame = buildCheckpointBroadcast(step({ status: 'approved' }), 1234)
    expect(frame).not.toBeNull()
    expect(frame?.type).toBe('copilot_checkpoint')
    expect(frame?.data.stepId).toBe('step-1')
    expect(frame?.data.tool).toBe('cluster_themes')
    expect(frame?.data.summary).toBe('Top theme: Pricing')
    expect(frame?.timestamp).toBe(1234)
  })

  it('suppresses a frame whose summary would leak PII', () => {
    const s = step({ status: 'approved', tool: 'detect_anomaly', output: { summary: 'concern from voter-7 (a@b.com)' } })
    expect(buildCheckpointBroadcast(s)).toBeNull()
  })
})
