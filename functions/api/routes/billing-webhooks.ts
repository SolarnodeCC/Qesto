// Stripe webhook plane, split out of billing.ts (issue #687): signature
// verification, idempotency, and event handlers. Mounts onto the same parent app
// as the REST routes, so routing behaviour is unchanged.

// Billing API routes (BILL-04): plan management, quota tracking.
//
// Routes (all mounted under `/api`):
//   GET  /api/plans/catalog          public `PLAN_QUOTAS` snapshot (WS6 / F-04)
//   GET  /api/plans/:userId/usage    quota usage for authenticated user
//   POST /api/billing/portal         Stripe billing portal session
//   GET  /api/billing/invoices       Stripe invoice history
//   POST /api/billing/subscription   Stripe subscription management

import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { readKvText, writeKvJson, deleteKv } from '../lib/kv'
import { type AuthVariables } from '../middleware/auth'
import { type PlanVariables } from '../middleware/plan'
import { StripeWebhookEventSchema, StripeSubscriptionObjectSchema, type ValidStripeWebhookEvent } from '../lib/protocol-schemas'
import { type Env, type PlanTier } from '../types'
import {
  findUserIdByStripeCustomerId,
  isStripeWebhookEventProcessed,
  recordStripeWebhookEvent,
} from '../repositories/billingRepository'

type Vars = AuthVariables & PlanVariables
import * as shared from './billing-shared'

// Mount Stripe webhook handler (no auth required — signature verification instead)
export function mountStripeWebhookRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  // POST /api/billing/webhook/stripe — Handle inbound Stripe webhook events
  // Signature verification + idempotency + event routing
  parent.post('/api/billing/webhook/stripe', async (c) => {
    const traceId = c.get('trace_id')
    if (!c.env.STRIPE_WEBHOOK_SECRET) {
      return errorResponse(c, 503, 'misconfigured','Stripe webhook not configured')
    }

    // Read raw body for signature verification (Hono stores parsed JSON, we need raw)
    const rawBody = await c.req.text()
    if (!rawBody) {
      return errorResponse(c, 400, 'bad_request','Empty body')
    }

    // Verify Stripe signature: Stripe-Signature = t=<timestamp>, v1=<signature>, v0=<legacy>
    const sigHeader = c.req.header('stripe-signature')
    if (!sigHeader) {
      return errorResponse(c, 401, 'unauthorized','Missing Stripe-Signature header')
    }

    const verified = await verifyStripeSignature(rawBody, sigHeader, c.env.STRIPE_WEBHOOK_SECRET)
    if (!verified) {
      return errorResponse(c, 401, 'unauthorized','Invalid Stripe signature')
    }

    // Parse event
    let event: unknown
    try {
      event = JSON.parse(rawBody)
    } catch {
      return errorResponse(c, 400, 'bad_request','Invalid JSON')
    }

    const parsed = StripeWebhookEventSchema.safeParse(event)
    if (!parsed.success) {
      return errorResponse(c, 400, 'bad_request','Invalid event schema')
    }

    const stripeEvent = parsed.data

    // Check idempotency: has this event been processed?
    const existing = await isStripeWebhookEventProcessed(c.env.DB, stripeEvent.id)

    if (existing) {
      return c.json(
        { ok: true, data: { message: 'Event already processed', event_id: stripeEvent.id }, trace_id: traceId },
        200,
      )
    }

    // Route to event handler
    try {
      switch (stripeEvent.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(c, stripeEvent)
          break
        case 'customer.subscription.created':
          await handleSubscriptionCreated(c, stripeEvent)
          break
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(c, stripeEvent)
          break
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(c, stripeEvent)
          break
        case 'customer.subscription.trial_will_end':
          await handleSubscriptionTrialWillEnd(c, stripeEvent)
          break
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(c, stripeEvent)
          break
        default:
          // Ignore unhandled event types (Stripe adds new ones regularly)
          break
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[Stripe Webhook] Event ${stripeEvent.id} handler failed: ${errorMsg}`)
      // Record failure but don't mark as processed
      return errorResponse(c, 500, 'internal_error','Event handler failed')
    }

    // Mark event as processed
    try {
      await recordStripeWebhookEvent(c.env.DB, stripeEvent.id, stripeEvent.type, Date.now())
    } catch (err) {
      console.error(`[Stripe Webhook] Failed to record event ${stripeEvent.id}: ${err}`)
      // Still return 200 — event was handled, just logging failed
    }

    return c.json({ ok: true, data: { message: 'Event processed', event_id: stripeEvent.id }, trace_id: traceId }, 200)
  })
}


// ── Stripe webhook signature verification ──────────────────────────────────

// Stripe's official libraries reject events whose timestamp is outside a
// tolerance window (default 5 min) to bound replay of a captured payload +
// signature. Event-id idempotency (stripe_webhook_events) is the primary replay
// defence; this is defense-in-depth matching Stripe's own behaviour (CWE-294).
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300

async function verifyStripeSignature(body: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    // Parse Stripe-Signature header: t=<timestamp>, v1=<signature>, v0=<legacy>.
    // During secret rotation Stripe sends MULTIPLE v1 signatures (one per active
    // secret), so collect them all rather than keeping only the last.
    let timestamp: string | undefined
    const v1Signatures: string[] = []
    for (const part of sigHeader.split(',')) {
      const idx = part.indexOf('=')
      if (idx === -1) continue
      const k = part.slice(0, idx).trim()
      const v = part.slice(idx + 1).trim()
      if (k === 't') timestamp = v
      else if (k === 'v1') v1Signatures.push(v)
    }
    if (!timestamp || v1Signatures.length === 0) return false

    // Replay-window guard: reject timestamps outside the tolerance in either
    // direction (stale captures and implausible future timestamps alike).
    const tsSeconds = Number(timestamp)
    if (!Number.isFinite(tsSeconds)) return false
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (Math.abs(nowSeconds - tsSeconds) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) return false

    // Reconstruct signed content: <timestamp>.<body>
    const signedContent = `${timestamp}.${body}`

    // Compute HMAC-SHA256
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const contentData = encoder.encode(signedContent)

    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const computed = await crypto.subtle.sign('HMAC', key, contentData)

    // Convert to hex
    const computedHex = Array.from(new Uint8Array(computed))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Constant-time comparison against every offered v1 signature.
    return v1Signatures.some((sig) => constantTimeCompare(computedHex, sig))
  } catch {
    return false
  }
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// ── Event handlers ─────────────────────────────────────────────────────────

/**
 * checkout.session.completed (#585): the source of truth that a user has paid.
 * Records the Stripe customer ↔ user mapping and upgrades users.plan to the
 * purchased tier. The tier is taken from session metadata (set at checkout) and
 * cross-checked against the configured price ids.
 */
async function handleCheckoutSessionCompleted(
  c: { env: Pick<Env, 'DB' | 'USERS_KV'> },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const session = event.data.object as Record<string, unknown>
  const customerId = typeof session.customer === 'string' ? session.customer : undefined
  const metadata = (session.metadata as Record<string, unknown> | undefined) ?? {}
  const userId =
    (typeof session.client_reference_id === 'string' ? session.client_reference_id : undefined) ??
    (typeof metadata.userId === 'string' ? metadata.userId : undefined)

  if (!userId) {
    console.warn('[Stripe] checkout.session.completed without resolvable userId')
    return
  }

  if (customerId) {
    await shared.recordCustomerMapping(c.env, userId, customerId)
  }

  // Determine the purchased tier: trust metadata.plan but only if it's a valid
  // paid tier; otherwise fall back to a price-id lookup if present on the session.
  let plan: PlanTier | null = shared.validTier(metadata.plan) && metadata.plan !== 'free' ? metadata.plan : null
  if (!plan && typeof session.amount_total === 'number' && session.amount_total > 0) {
    // No usable metadata but money changed hands — default to the entry paid tier.
    plan = 'starter'
  }
  if (!plan) {
    console.warn(`[Stripe] checkout.session.completed for ${userId} with no resolvable paid plan`)
    return
  }

  await shared.setUserPlan(c.env, userId, plan)
  await shared.writeBillingAudit(c.env, userId, 'billing.checkout_completed', String(session.id ?? customerId ?? userId), {
    plan,
    customerId: customerId ?? null,
  })
}

async function handleSubscriptionCreated(
  c: { env: Env },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env, customerId)
  if (!userId) {
    console.warn(`[Stripe] Subscription ${sub.id} created for unknown customer ${customerId}`)
    return
  }

  // Store subscription record in KV
  await writeKvJson(
    c.env.USERS_KV,
    shared.stripeSubscriptionKey(userId),
    { subscriptionId: sub.id },
    { expirationTtl: 86400 * 365 },
  )

  // Upgrade plan to the tier implied by the subscription's price.
  const tier = shared.tierFromPriceId(c.env, sub.items?.data?.[0]?.price?.id)
  if (tier && sub.status === 'active') {
    await shared.setUserPlan(c.env, userId, tier)
  }

  await shared.writeBillingAudit(c.env, userId, 'billing.subscription_created', sub.id, {
    status: sub.status,
    plan: tier,
  })
}

async function handleSubscriptionUpdated(
  c: { env: Env },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env, customerId)
  if (!userId) return

  // Update subscription record (status may have changed)
  await writeKvJson(
    c.env.USERS_KV,
    shared.stripeSubscriptionKey(userId),
    { subscriptionId: sub.id },
    { expirationTtl: 86400 * 365 },
  )

  // Reconcile plan with subscription status + price.
  const tier = shared.tierFromPriceId(c.env, sub.items?.data?.[0]?.price?.id)
  const activeStatuses = new Set(['active','trialing','past_due'])
  let appliedPlan: PlanTier
  if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
    appliedPlan = 'free'
  } else if (tier && activeStatuses.has(sub.status)) {
    appliedPlan = tier
  } else {
    appliedPlan = tier ?? 'free'
  }
  await shared.setUserPlan(c.env, userId, appliedPlan)

  await shared.writeBillingAudit(c.env, userId, 'billing.subscription_updated', sub.id, {
    status: sub.status,
    plan: appliedPlan,
  })
}

async function handleSubscriptionDeleted(
  c: { env: Env },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env, customerId)
  if (!userId) return

  // Remove subscription record from KV and downgrade to free.
  await deleteKv(c.env.USERS_KV, shared.stripeSubscriptionKey(userId))
  await shared.setUserPlan(c.env, userId, 'free')

  await shared.writeBillingAudit(c.env, userId, 'billing.subscription_deleted', sub.id, { plan: 'free' })
}

async function handleSubscriptionTrialWillEnd(
  c: { env: Env },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env, customerId)
  if (!userId) return

  await shared.writeBillingAudit(c.env, userId, 'billing.subscription_trial_will_end', sub.id, {
    status: sub.status,
  })
}

async function handleInvoicePaymentFailed(
  c: { env: Env },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const invoice = event.data.object as Record<string, unknown>
  const customerId = invoice.customer as string | undefined
  if (!customerId) return

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env, customerId)
  if (!userId) return

  // A failed payment does not immediately revoke access (Stripe will retry and
  // emit subscription.updated → past_due, then deleted on final failure); we
  // record the failure so dunning + support have an audit trail.
  await shared.writeBillingAudit(c.env, userId, 'billing.invoice_payment_failed', String(invoice.id ?? customerId), {
    customerId,
  })
}

// ── Helper: Look up user by Stripe customer ID ────────────────────────────

/**
 * Resolve a Stripe customer id to a Qesto user id (#585). Prefers the D1
 * `users.stripe_customer_id` column; falls back to the KV reverse index written
 * at checkout. Returns null when no mapping exists (handlers then no-op).
 */
async function findUserByCustomerId(env: Env, customerId: string): Promise<string | null> {
  try {
    const fromDb = await findUserIdByStripeCustomerId(env.DB, customerId)
    if (fromDb) return fromDb
  } catch {
    // Column may not exist in some environments; fall through to KV.
  }

  const fromKv = await readKvText(env.USERS_KV, shared.stripeCustomerReverseKey(customerId))
  return fromKv ?? null
}
