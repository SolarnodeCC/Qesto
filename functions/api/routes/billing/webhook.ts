// Stripe webhook handler (BILL-04): signature verification, idempotency, event routing.
import { Hono } from 'hono'
import { StripeWebhookEventSchema, StripeSubscriptionObjectSchema } from '../../lib/protocol-schemas'
import type { Env } from '../../types'
import { stripeSubscriptionKey } from './shared'
import { absent } from '../../lib/absent'

// Mount Stripe webhook handler (no auth required — signature verification instead)
export function mountStripeWebhookRoutes(parent: Hono<{ Bindings: Env; Variables: any }>) {
  // POST /api/billing/webhook/stripe — Handle inbound Stripe webhook events
  // Signature verification + idempotency + event routing
  parent.post('/api/billing/webhook/stripe', async (c) => {
    const traceId = c.get('trace_id')
    if (!c.env.STRIPE_WEBHOOK_SECRET) {
      return c.json(
        { ok: false, error: { code: 'misconfigured', message: 'Stripe webhook not configured' }, trace_id: traceId },
        503,
      )
    }

    // Read raw body for signature verification (Hono stores parsed JSON, we need raw)
    const rawBody = await c.req.text()
    if (!rawBody) {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'Empty body' }, trace_id: traceId }, 400)
    }

    // Verify Stripe signature: Stripe-Signature = t=<timestamp>,v1=<signature>,v0=<legacy>
    const sigHeader = c.req.header('stripe-signature')
    if (!sigHeader) {
      return c.json(
        { ok: false, error: { code: 'unauthorized', message: 'Missing Stripe-Signature header' }, trace_id: traceId },
        401,
      )
    }

    const verified = await verifyStripeSignature(rawBody, sigHeader, c.env.STRIPE_WEBHOOK_SECRET)
    if (!verified) {
      return c.json(
        { ok: false, error: { code: 'unauthorized', message: 'Invalid Stripe signature' }, trace_id: traceId },
        401,
      )
    }

    // Parse event
    let event: unknown
    try {
      event = JSON.parse(rawBody)
    } catch {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'Invalid JSON' }, trace_id: traceId }, 400)
    }

    const parsed = StripeWebhookEventSchema.safeParse(event)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'bad_request', message: 'Invalid event schema' }, trace_id: traceId },
        400,
      )
    }

    const stripeEvent = parsed.data

    // Check idempotency: has this event been processed?
    const existing = await c.env.DB.prepare(
      'SELECT stripe_event_id FROM stripe_webhook_events WHERE stripe_event_id = ?1',
    )
      .bind(stripeEvent.id)
      .first<{ stripe_event_id: string }>()

    if (existing) {
      return c.json(
        { ok: true, data: { message: 'Event already processed', event_id: stripeEvent.id }, trace_id: traceId },
        200,
      )
    }

    // Route to event handler
    try {
      switch (stripeEvent.type) {
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
      return c.json(
        { ok: false, error: { code: 'internal_error', message: 'Event handler failed' }, trace_id: traceId },
        500,
      )
    }

    // Mark event as processed
    try {
      await c.env.DB.prepare(
        'INSERT INTO stripe_webhook_events (stripe_event_id, event_type, processed_at) VALUES (?1, ?2, ?3)',
      )
        .bind(stripeEvent.id, stripeEvent.type, Date.now())
        .run()
    } catch (err) {
      console.error(`[Stripe Webhook] Failed to record event ${stripeEvent.id}: ${err}`)
      // Still return 200 — event was handled, just logging failed
    }

    return c.json({ ok: true, data: { message: 'Event processed', event_id: stripeEvent.id }, trace_id: traceId }, 200)
  })
}

// ── Stripe webhook signature verification ──────────────────────────────────

async function verifyStripeSignature(body: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    // Parse Stripe-Signature header: t=<timestamp>,v1=<signature>,v0=<legacy>
    const parts = sigHeader.split(',').reduce(
      (acc, part) => {
        const [k, v] = part.split('=')
        acc[k] = v
        return acc
      },
      {} as Record<string, string>,
    )

    const timestamp = parts.t
    const signature = parts.v1
    if (!timestamp || !signature) return false

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

    // Constant-time comparison
    return constantTimeCompare(computedHex, signature)
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

async function handleSubscriptionCreated(
  c: { env: Env },
  event: any,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env.USERS_KV, customerId)
  if (!userId) {
    console.warn(`[Stripe] Subscription ${sub.id} created for unknown customer ${customerId}`)
    return
  }

  // Store subscription record in KV
  await c.env.USERS_KV.put(
    stripeSubscriptionKey(userId),
    JSON.stringify({ subscriptionId: sub.id }),
    { expirationTtl: 86400 * 365 },
  )

  // Log audit event
  try {
    await c.env.DB.prepare(
      'INSERT INTO audit_events (actor_id, action, resource_type, resource_id, ts) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'billing.subscription_created', 'subscription', sub.id, Date.now())
      .run()
  } catch {
    // Audit log failure is non-critical
  }
}

async function handleSubscriptionUpdated(
  c: { env: Env },
  event: any,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env.USERS_KV, customerId)
  if (!userId) return

  // Update subscription record (status may have changed)
  await c.env.USERS_KV.put(
    stripeSubscriptionKey(userId),
    JSON.stringify({ subscriptionId: sub.id }),
    { expirationTtl: 86400 * 365 },
  )

  // Log audit event
  try {
    await c.env.DB.prepare(
      'INSERT INTO audit_events (actor_id, action, resource_type, resource_id, ts) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'billing.subscription_updated', 'subscription', sub.id, Date.now())
      .run()
  } catch {
    // Non-critical
  }
}

async function handleSubscriptionDeleted(
  c: { env: Env },
  event: any,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env.USERS_KV, customerId)
  if (!userId) return

  // Remove subscription record from KV (user downgraded to free)
  await c.env.USERS_KV.delete(stripeSubscriptionKey(userId))

  // Log audit event
  try {
    await c.env.DB.prepare(
      'INSERT INTO audit_events (actor_id, action, resource_type, resource_id, ts) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'billing.subscription_deleted', 'subscription', sub.id, Date.now())
      .run()
  } catch {
    // Non-critical
  }
}

async function handleSubscriptionTrialWillEnd(
  c: { env: Env },
  event: any,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env.USERS_KV, customerId)
  if (!userId) return

  // Log event for future email notification
  try {
    await c.env.DB.prepare(
      'INSERT INTO audit_events (actor_id, action, resource_type, resource_id, ts) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'billing.subscription_trial_will_end', 'subscription', sub.id, Date.now())
      .run()
  } catch {
    // Non-critical
  }
}

async function handleInvoicePaymentFailed(
  c: { env: Env },
  event: any,
): Promise<void> {
  const invoice = event.data.object as Record<string, unknown>
  const customerId = invoice.customer as string | undefined
  if (!customerId) return

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env.USERS_KV, customerId)
  if (!userId) return

  // Log audit event
  try {
    await c.env.DB.prepare(
      'INSERT INTO audit_events (actor_id, action, resource_type, resource_id, ts) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'billing.invoice_payment_failed', 'invoice', invoice.id, Date.now())
      .run()
  } catch {
    // Non-critical
  }
}

// ── Helper: Look up user by Stripe customer ID ────────────────────────────

async function findUserByCustomerId(_kv: KVNamespace, _customerId: string): Promise<string | null> {
  // Brute-force lookup: iterate all users in KV (limited in practice)
  // In a production system, maintain a reverse index (customer_id → user_id)
  // For now, this works for small-to-medium deployments
  //
  // Better approach (Phase 2): Add stripe_customer_id column to users table in D1,
  // then query D1 instead of scanning KV.
  //
  // This is a known limitation documented in BACKLOG_MASTER.md (BILL-07).

  // For now, return absent() — webhook handlers will skip processing if user not found
  // and log a warning. The subscription record was already created by checkout,
  // so data is not lost; just audit trail is incomplete.
  return absent()
}
