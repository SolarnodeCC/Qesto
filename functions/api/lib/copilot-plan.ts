/**
 * COPILOT-RUNTIME-01 (ADR-0056) — supervised multi-step copilot plans.
 */
import { z } from 'zod'
import type { CopilotLiveContext } from './copilot-live-context'
import {
  type ClusterThemesOutput,
  invokeCopilotTool,
  type CopilotL2Tool,
} from './copilot-tools'

export const COPILOT_PLAN_STEPS: CopilotL2Tool[] = [
  'cluster_themes',
  'detect_anomaly',
  'recommend_followup',
]

export const CopilotPlanStepSchema = z.object({
  id: z.string(),
  tool: z.string(),
  status: z.enum(['pending', 'approved', 'dismissed']),
  output: z.unknown(),
})
export type CopilotPlanStep = z.infer<typeof CopilotPlanStepSchema>

export const CopilotPlanSchema = z.object({
  sessionId: z.string(),
  createdAt: z.number(),
  steps: z.array(CopilotPlanStepSchema).min(1).max(5),
})
export type CopilotPlan = z.infer<typeof CopilotPlanSchema>

export function copilotPlanKvKey(sessionId: string): string {
  return `copilot:plan:${sessionId}`
}

/** Build a fresh 3-step supervised plan from live context. */
export function buildCopilotPlan(sessionId: string, context: CopilotLiveContext): CopilotPlan {
  let clusters: ClusterThemesOutput | undefined
  const steps: CopilotPlanStep[] = COPILOT_PLAN_STEPS.map((tool, i) => {
    const output =
      tool === 'recommend_followup'
        ? invokeCopilotTool(tool, context, clusters ? { clusters } : undefined)
        : invokeCopilotTool(tool, context)
    if (tool === 'cluster_themes') clusters = output as ClusterThemesOutput
    return {
      id: `step-${i + 1}`,
      tool,
      status: 'pending' as const,
      output,
    }
  })
  return CopilotPlanSchema.parse({
    sessionId,
    createdAt: Date.now(),
    steps,
  })
}

export function approvePlanStep(
  plan: CopilotPlan,
  stepId: string,
  status: 'approved' | 'dismissed',
): CopilotPlan {
  return CopilotPlanSchema.parse({
    ...plan,
    steps: plan.steps.map((s) => (s.id === stepId ? { ...s, status } : s)),
  })
}
