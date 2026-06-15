/**
 * COPILOT-CHECKPOINT-01 (ADR-0056) — facilitator approval → broadcast.
 *
 * An L2 plan step is NEVER pushed to participants on generation. It is broadcast
 * to the room only after the facilitator explicitly approves it (the PATCH
 * approval route). Dismissed/pending steps are never broadcast. This module is the
 * pure decision + message builder; the DO `/copilot/checkpoint` route fans it out.
 */
import type { CopilotPlanStep } from './copilot-plan'
import { assertNoPiiInOutput } from './copilot-sandbox'

export type CopilotCheckpointBroadcast = {
  type: 'copilot_checkpoint'
  data: { stepId: string; tool: string; summary: string }
  timestamp: number
}

/** Only an explicitly `approved` step may broadcast (the checkpoint gate). */
export function shouldBroadcastStep(step: Pick<CopilotPlanStep, 'status'>): boolean {
  return step.status === 'approved'
}

/** Derive a short, PII-safe facilitator-facing summary from a step's aggregate output. */
export function summarizeStepOutput(step: Pick<CopilotPlanStep, 'tool' | 'output'>): string {
  const out = step.output as Record<string, unknown> | null | undefined
  switch (step.tool) {
    case 'cluster_themes': {
      const themes = (out?.['themes'] as Array<{ label?: string }> | undefined) ?? []
      const top = themes[0]?.label
      return top ? `Top theme: ${top}` : 'Themes clustered.'
    }
    case 'detect_anomaly': {
      const summary = typeof out?.['summary'] === 'string' ? (out['summary'] as string) : ''
      return summary || 'Anomaly check complete.'
    }
    case 'recommend_followup': {
      const title = typeof out?.['title'] === 'string' ? (out['title'] as string) : ''
      return title || 'Follow-up recommended.'
    }
    default:
      return 'Copilot step approved.'
  }
}

/**
 * Build the broadcast frame for an approved step. Returns `null` when the step is
 * not approved (no broadcast) or when the summary fails the PII guard
 * (defence-in-depth — never leak a voter-derived string to the room).
 */
export function buildCheckpointBroadcast(
  step: Pick<CopilotPlanStep, 'id' | 'tool' | 'status' | 'output'>,
  now: number = Date.now(),
): CopilotCheckpointBroadcast | null {
  if (!shouldBroadcastStep(step)) return null
  const summary = summarizeStepOutput(step).slice(0, 280)
  if (!assertNoPiiInOutput(summary).ok) return null
  return {
    type: 'copilot_checkpoint',
    data: { stepId: step.id, tool: step.tool, summary },
    timestamp: now,
  }
}
