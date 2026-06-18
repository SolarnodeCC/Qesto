// Span tracing helper — wraps async operations (DO calls, D1 queries, KV ops)
// with latency + error bookkeeping and trace_id propagation.
//
// Design principles:
//   1. Fail open — a metrics failure never breaks the wrapped operation.
//   2. Zero PII — span names are compile-time strings, trace_id/user_id are
//      opaque identifiers. Do NOT embed emails, raw IPs or JWT tokens.
//   3. Cheap — latency is measured with `Date.now()` (millisecond granular
//      is sufficient; the workerd runtime clamps sub-ms anyway).
//
// Consumers:
//   • `loggerMiddleware` emits one span per HTTP request.
//   • `do-tracing.ts` wraps DO `fetch` calls.
//   • Route handlers can call `recordSpan('d1.sessions.select', () => ...)`.
//   • `writeEvent()` writes application events to Analytics Engine.

import { recordMetric } from './metrics-kv'
import type { PlanTier } from '../types'

export type SpanContext = {
  trace_id: string
  user_id?: string
  kv?: KVNamespace
}

export type SpanResult<T> = {
  ok: true
  value: T
  latency_ms: number
} | {
  ok: false
  error: Error
  latency_ms: number
}

/**
 * Run `operation`, record latency + error metrics to the given KV, and re-throw
 * any error so the caller still sees it. The metric write is best-effort and
 * never blocks failure propagation.
 */
export async function recordSpan<T>(
  name: string,
  operation: () => Promise<T>,
  ctx: SpanContext,
): Promise<T> {
  const start = Date.now()
  try {
    const value = await operation()
    const latency_ms = Date.now() - start
    // Fire-and-forget metric; failures are swallowed (metrics are ancillary).
    safeRecord(ctx.kv, name, latency_ms, 200, ctx.user_id, ctx.trace_id)
    return value
  } catch (err) {
    const latency_ms = Date.now() - start
    safeRecord(ctx.kv, name, latency_ms, 500, ctx.user_id, ctx.trace_id)
    throw err
  }
}

/**
 * Non-throwing variant — useful when the caller wants to branch on the result
 * without try/catch (e.g. DO fetch with a user-facing default response).
 */
export async function recordSpanSafe<T>(
  name: string,
  operation: () => Promise<T>,
  ctx: SpanContext,
): Promise<SpanResult<T>> {
  const start = Date.now()
  try {
    const value = await operation()
    const latency_ms = Date.now() - start
    safeRecord(ctx.kv, name, latency_ms, 200, ctx.user_id, ctx.trace_id)
    return { ok: true, value, latency_ms }
  } catch (err) {
    const latency_ms = Date.now() - start
    safeRecord(ctx.kv, name, latency_ms, 500, ctx.user_id, ctx.trace_id)
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(String(err)),
      latency_ms,
    }
  }
}

function safeRecord(
  kv: KVNamespace | undefined,
  route: string,
  latency_ms: number,
  status: number,
  user_id: string | undefined,
  trace_id: string,
): void {
  if (!kv) return
  // Intentionally not awaited — metric writes never block the hot path.
  void recordMetric(kv, route, latency_ms, status, user_id, trace_id).catch(() => {
    // Swallow: metrics are best-effort, and we never log PII.
  })
}

export type QestoEvent = {
  name:
    | 'signup'
    | 'team_created'
    | 'first_session_started'
    | 'first_paid'
    | 'session.started'
    | 'session.closed'
    | 'ws.voter_joined'
    | 'ws.voter_disconnected'
    | 'ws.capacity_exceeded'
    | 'integration.connected'
    | 'export.initiated'
    | 'export.completed'
    | 'api.request'
    | 'webhook.delivery_attempted'
    | 'ai.sentiment_analysis'
    | 'ai.sentiment_analysis_failed'
    | 'ai.sentiment_retry_exhausted'
    | 'gdpr.deletion_requested'
    | 'gdpr.deletion_completed'
    | 'ws.token_bucket_contention'
    | 'ws.energizer_activated'
    | 'ws.energizer_activation_denied'
    | 'ws.energizer_advance_denied'
    | 'ws.energizer_answered'
    | 'ws.energizer_advanced'
    | 'ws.energizer_completed'
    | 'ws.energizer_timeout'
    | 'ai.inference'
    | 'ai.cache_hit'
    | 'ai.cache_miss'
    | 'ai.gateway_latency'
    | 'wizard.opened'
    | 'wizard.completed'
    | 'ai.suggestions_resolved'
    | 'launchpad.opened'
    | 'launchpad.launch_attempt'
    | 'launchpad.launch_success'
    | 'launchpad.launch_failed'
    | 'preflight.checked'
    | 'preflight.failed'
    | 'ai.rate_limited'
    | 'rate_limit.hit'
    | 'error.api'
    | 'error.ai_timeout'
    | 'ws.vote_submitted'
    | 'do.storage_fault'
    | 'multi_region.write_routed'
    | 'multi_region.failover_triggered'
    | 'webhook.delivered'
    | 'webhook.failed'
    | 'webhook.retried'
    | 'tournament.started'
    | 'tournament.completed'
    | 'kb_rag.query'
    | 'kb_rag.result_returned'
    | 'coaching.suggestion_accepted'
    | 'coaching.suggestion_dismissed'
    | 'coaching.export_emailed'
    | 'compliance.pentest_started'
    | 'compliance.audit_prep'
    | 'compliance.soc2_type2_completed'
    | 'compliance.pentest_resolved'
    | 'partner.secret_rotated'
    | 'partner.marketplace_viewed'
    | 'partner.account_created'
    | 'partner.payout_initiated'
    | 'kb_rag.similar_sessions'
    | 'insight.aggregated'
    | 'insight.trends_viewed'
    | 'insight.scorecard_viewed'
    | 'insight.export_viewed'
    | 'copilot.suggestion_emitted'
    | 'copilot.suggestion_accepted'
    | 'copilot.poll_drafted'
    | 'copilot.plan_created'
    | 'copilot.plan_step_reviewed'
    // COPILOT-CHECKPOINT-01 (ADR-0056): facilitator-approved step fan-out.
    | 'copilot.checkpoint_broadcast'
    // LEARN (ADR-0058): LTI 1.1 launch outcomes — no PII, context id only.
    | 'learn.lti_launched'
    | 'learn.lti_rejected'
    // LEARN (ADR-0058, S94): LMS grade passback outcome — no student PII.
    | 'learn.grade_passback_success'
    | 'learn.grade_passback_failed'
    // SOVEREIGN+ (ADR-0058, S94): signed audit export — entry count only.
    | 'sovereign.audit_exported'
    | 'realtime.v2_negotiated'
    | 'federation.link_created'
    | 'federation.consent_granted'
    // Phase 2.1: Queues observability (ADR-042)
    | 'queue.message_enqueued'
    | 'queue.message_acked'
    | 'queue.message_failed'
    | 'queue.dlq_size'
    // Phase 2.2: DO vote buffering observability (ADR-042)
    | 'do.vote_buffer_depth'
    | 'do.vote_buffer_flush'
    | 'do.recovery_from_snapshot'
    | 'do.recovery_failed'
    | 'do.flush_votes_failed'
    // Phase 2.3: R2 snapshots observability (ADR-042)
    | 'r2.snapshot_uploaded'
    | 'r2.snapshot_read_on_recovery'
    | 'r2.snapshot_stale'
    | 'r2.snapshot_corrupted'
    // Phase 1.2: WAF observability (ADR-042)
    | 'waf.rule_triggered'
    | 'waf.challenge_served'
    | 'waf.false_positive_suspected'
    // CAPTIONS (ADR-0051): trace + timing + fan-out width only — never transcript text.
    | 'captions.segment'
    | 'captions.asr_unavailable'
    // REACTIONS (ADR-0055): timing + volume only — never emoji payload text at scale.
    | 'reaction.submitted'
    | 'reaction.broadcast_latency'
    // PULSE (ADR-0057): dashboard reads — no cohort PII.
    | 'pulse.summary_viewed'
    | 'pulse.trends_viewed'
    // LEARN (ADR-0058, S95): instructor analytics export — ids only, no PII.
    | 'learn.instructor_export'
    // CONNECT (ADR-0062, S95): federation invite mint — jti/timing only.
    | 'connect.invite_minted'
    // CONNECT (ADR-0062, S96): federated join lifecycle — counts/timing, no PII.
    | 'connect.session_joined'
    | 'connect.join_denied'
    | 'connect.invite_revoked'
    // STUDIO (ADR-0060, S96): authoring co-pilot usage — counts/timing, no content.
    | 'studio.copilot_used'
    | 'studio.theme_applied'
    // STUDIO-SUGGEST-01 (ADR-0060, S97): next-question suggestion usage — count/source, no content.
    | 'studio.suggest_used'
    // STUDIO-LIBRARY-01 (ADR-0060, S97): content library lifecycle — ids/source, no content.
    | 'studio.library_saved'
    | 'studio.library_forked'
    | 'studio.library_deleted'
    // XR (ADR-0066): avatar-sync fan-out latency — aggregate only. double1=durationMs,
    // double2=batch avatar count, blob2=sessionId, blob3=teamId. NEVER carries avatarId,
    // voterId, or coordinates.
    | 'xr.avatar_sync_latency'
  // Optional fields accept `undefined` explicitly so callers using `x ?? undefined`
  // (common pattern when normalising `null` to optional) satisfy `exactOptionalPropertyTypes`.
  userId?: string | undefined
  sessionId?: string | undefined
  teamId?: string | undefined
  plan?: PlanTier | undefined
  durationMs?: number | undefined
  count?: number | undefined
  value?: number | undefined
  traceId?: string | undefined
  /** blob6 — integration type, export format, model id, webhook id, cache hit/miss, etc. */
  detail?: string | undefined
  /** AI Gateway cache age (seconds) — populated for ai.cache_hit events */
  cacheAge?: number | undefined
  /** Gateway request latency (ms) — populated for ai.gateway_latency events */
  gatewayMs?: number | undefined
}

/**
 * Write an application event to Analytics Engine.
 * Schema: blob1=eventName, blob2=userId|sessionId, blob3=teamId, blob4=plan, blob5=traceId, blob6=detail
 *         double1=durationMs, double2=count, double3=value(EUR), double4=cacheAge(s), double5=gatewayMs
 * Fire-and-forget: failures are swallowed (events are ancillary).
 */
export function writeEvent(ae: AnalyticsEngineDataset | undefined, event: QestoEvent): void {
  if (!ae) return
  const blobs: string[] = [
    event.name,
    event.userId || event.sessionId || '',
    event.teamId || '',
    event.plan || '',
    event.traceId || '',
    ...(event.detail ? [event.detail] : []),
  ]
  const doubles: number[] = [
    event.durationMs ?? 0,
    event.count ?? 0,
    event.value ?? 0,
    event.cacheAge ?? 0,
    event.gatewayMs ?? 0,
  ]
  try {
    ae.writeDataPoint({ blobs, doubles })
  } catch {
    // Swallow: events are best-effort observability.
  }
}
