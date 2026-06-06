import { ulid } from './ulid'
import { writeEvent } from './observability'
import type { Env, PlanTier } from '../types'

export type Sprint19JourneyEvent =
  | 'wizard.opened'
  | 'wizard.completed'
  | 'ai.suggestions_resolved'
  | 'launchpad.opened'
  | 'launchpad.launch_attempt'
  | 'launchpad.launch_success'
  | 'launchpad.launch_failed'
  | 'preflight.checked'
  | 'preflight.failed'

export async function recordSprint19JourneyEvent(
  env: Env,
  event: {
    name: Sprint19JourneyEvent
    userId: string
    sessionId?: string | undefined
    teamId?: string | null | undefined
    plan?: PlanTier | undefined
    count?: number | undefined
    value?: number | undefined
    durationMs?: number | undefined
    traceId: string
  },
): Promise<void> {
  writeEvent(env.METRICS_AE, {
    name: event.name,
    userId: event.userId,
    sessionId: event.sessionId,
    teamId: event.teamId ?? undefined,
    plan: event.plan,
    count: event.count,
    value: event.value,
    durationMs: event.durationMs,
    traceId: event.traceId,
  })
  await env.DB
    .prepare(
      `INSERT INTO sprint19_events
       (id, event_name, user_id, session_id, team_id, plan, count, value, duration_ms, created_at, trace_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
    .bind(
      ulid(),
      event.name,
      event.userId,
      event.sessionId ?? null,
      event.teamId ?? null,
      event.plan ?? null,
      event.count ?? 0,
      event.value ?? 0,
      event.durationMs ?? 0,
      Date.now(),
      event.traceId,
    )
    .run()
    .catch(() => {
      // Measurement must fail open; missing local migrations should not break the product path.
    })
}
