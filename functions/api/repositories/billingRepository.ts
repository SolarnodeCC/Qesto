/**
 * Billing repository (ADR-0069).
 *
 * D1 persistence for Stripe webhook handlers and plan updates. Pure functions
 * taking `D1Database` + params — no Hono context, no Env.
 */
import type { PlanTier } from '../types'

/** Set users.plan in D1 (best-effort; callers log on failure). */
export async function setUserPlan(db: D1Database, userId: string, plan: PlanTier): Promise<void> {
  await db.prepare('UPDATE users SET plan = ?1 WHERE id = ?2').bind(plan, userId).run()
}

/** Persist stripe_customer_id on the user row when the column exists. */
export async function setStripeCustomerId(db: D1Database, userId: string, customerId: string): Promise<void> {
  await db.prepare('UPDATE users SET stripe_customer_id = ?1 WHERE id = ?2').bind(customerId, userId).run()
}

/** Write a billing audit row using the audit_events schema (#585). */
export async function insertBillingAuditEvent(
  db: D1Database,
  userId: string,
  action: string,
  subjectId: string,
  snapshot?: Record<string, unknown>,
): Promise<void> {
  await db.prepare(
    `INSERT INTO audit_events (id, ts, actor_id, action, subject_type, subject_id, after_snapshot)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT DO NOTHING`,
  )
    .bind(
      crypto.randomUUID(),
      Date.now(),
      userId,
      action,
      'subscription',
      subjectId,
      snapshot ? JSON.stringify(snapshot) : '{}',
    )
    .run()
}

/** Resolve a Stripe customer id to a Qesto user id via D1. */
export async function findUserIdByStripeCustomerId(db: D1Database, customerId: string): Promise<string | null> {
  const row = await db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?1')
    .bind(customerId)
    .first<{ id: string }>()
  return row?.id ?? null
}

/** Idempotency guard: returns true when the Stripe event was already processed. */
export async function isStripeWebhookEventProcessed(db: D1Database, eventId: string): Promise<boolean> {
  const existing = await db.prepare(
    'SELECT stripe_event_id FROM stripe_webhook_events WHERE stripe_event_id = ?1',
  )
    .bind(eventId)
    .first<{ stripe_event_id: string }>()
  return existing != null
}

/** Record a processed Stripe webhook event for idempotency. */
export async function recordStripeWebhookEvent(
  db: D1Database,
  eventId: string,
  eventType: string,
  processedAt: number,
): Promise<void> {
  await db.prepare(
    'INSERT INTO stripe_webhook_events (stripe_event_id, event_type, processed_at) VALUES (?1, ?2, ?3)',
  )
    .bind(eventId, eventType, processedAt)
    .run()
}

/** Count AI insight generations for quota display (best-effort). */
export async function countInsightsThisMonth(db: D1Database, userId: string, monthStart: number): Promise<number> {
  const row = await db.prepare(
    `SELECT COUNT(*) as n FROM audit_events WHERE action = 'insights.generate' AND actor_id = ?1 AND ts >= ?2`,
  )
    .bind(userId, monthStart)
    .first<{ n: number }>()
  return row?.n ?? 0
}
