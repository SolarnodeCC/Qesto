/**
 * COPILOT-TOOLS-01 (ADR-0056) — sandboxed copilot tools with Zod-validated outputs.
 * Aggregate-only inputs; no cross-session reads; no session mutations.
 */
import { z } from 'zod'
import type { CopilotLiveContext } from './copilot-live-context'

export const COPILOT_L2_TOOLS = [
  'cluster_themes',
  'detect_anomaly',
  'participation_alert',
  'recommend_followup',
  'suggest_followup',
  'draft_poll',
  'disengagement_alert',
  'pacing_hint',
] as const
export type CopilotL2Tool = (typeof COPILOT_L2_TOOLS)[number]

export const ClusterThemesOutputSchema = z.object({
  themes: z.array(
    z.object({
      label: z.string().trim().min(1).max(120),
      votes: z.number().int().nonnegative(),
      share: z.number().min(0).max(1),
    }),
  ),
})
export type ClusterThemesOutput = z.infer<typeof ClusterThemesOutputSchema>

export const AnomalyOutputSchema = z.object({
  detected: z.boolean(),
  kind: z.enum(['participation_drop', 'mood_concerning', 'none']),
  summary: z.string().trim().max(400),
})
export type AnomalyOutput = z.infer<typeof AnomalyOutputSchema>

export const ParticipationAlertOutputSchema = z.object({
  alert: z.boolean(),
  participationRate: z.number().min(0).max(1),
  connected: z.number().int().nonnegative(),
  message: z.string().trim().max(400),
})
export type ParticipationAlertOutput = z.infer<typeof ParticipationAlertOutputSchema>

export const FollowupOutputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(600),
  intent: z.string().trim().max(280).optional(),
})
export type FollowupOutput = z.infer<typeof FollowupOutputSchema>

/** Cluster live option tallies into ranked themes (deterministic, no AI). */
export function clusterThemes(context: CopilotLiveContext): ClusterThemesOutput {
  const entries = (context.optionTallies ?? [])
    .map((e) => ({ label: e.label, votes: e.votes }))
    .filter((e) => e.votes > 0)
    .sort((a, b) => b.votes - a.votes)
  const total = entries.reduce((s, e) => s + e.votes, 0) || 1
  return ClusterThemesOutputSchema.parse({
    themes: entries.slice(0, 5).map((e) => ({
      label: e.label,
      votes: e.votes,
      share: Math.round((e.votes / total) * 1000) / 1000,
    })),
  })
}

/** Detect aggregate anomalies from live snapshot. */
export function detectAnomaly(context: CopilotLiveContext): AnomalyOutput {
  if (context.mood === 'concerning' && context.moodSampleSize >= 5) {
    return AnomalyOutputSchema.parse({
      detected: true,
      kind: 'mood_concerning',
      summary: `Room mood is concerning across ${context.moodSampleSize} sampled responses.`,
    })
  }
  if (
    context.connections >= 5 &&
    context.participationRate < 0.25
  ) {
    return AnomalyOutputSchema.parse({
      detected: true,
      kind: 'participation_drop',
      summary: `Participation rate is ${Math.round(context.participationRate * 100)}% with ${context.connections} connected.`,
    })
  }
  return AnomalyOutputSchema.parse({
    detected: false,
    kind: 'none',
    summary: 'No aggregate anomaly detected.',
  })
}

/** Participation alert tool (ZK-safe — uses counts only). */
export function participationAlert(context: CopilotLiveContext): ParticipationAlertOutput {
  const alert =
    context.connections >= 5 && context.participationRate < 0.25
  return ParticipationAlertOutputSchema.parse({
    alert,
    participationRate: context.participationRate,
    connected: context.connections,
    message: alert
      ? 'Participation is below 25% — consider a pacing check or simpler question.'
      : 'Participation looks healthy for the current room size.',
  })
}

/** Recommend a follow-up from clustered themes. */
export function recommendFollowup(clusters: ClusterThemesOutput): FollowupOutput {
  const top = clusters.themes[0]
  if (!top) {
    return FollowupOutputSchema.parse({
      title: 'Ask an open check-in',
      body: 'Not enough votes yet to cluster themes. Try a short open question to warm up the room.',
    })
  }
  return FollowupOutputSchema.parse({
    title: `Follow up on “${top.label}”`,
    body: `“${top.label}” leads with ${Math.round(top.share * 100)}% of responses. Ask what is driving that choice or what would change minds.`,
    intent: `Follow-up on ${top.label}`,
  })
}

export function invokeCopilotTool(
  tool: CopilotL2Tool,
  context: CopilotLiveContext,
  prior?: { clusters?: ClusterThemesOutput },
): unknown {
  switch (tool) {
    case 'cluster_themes':
      return clusterThemes(context)
    case 'detect_anomaly':
      return detectAnomaly(context)
    case 'participation_alert':
      return participationAlert(context)
    case 'recommend_followup':
      return recommendFollowup(prior?.clusters ?? clusterThemes(context))
    default:
      return { note: 'tool_deferred_to_l1', tool }
  }
}
