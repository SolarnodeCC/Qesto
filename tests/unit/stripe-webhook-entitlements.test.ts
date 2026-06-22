import { describe, expect, it, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { mountStripeWebhookRoutes } from '../../functions/api/routes/billing'
import type { Env } from '../../functions/api/types'

// #585 — Stripe webhooks must update entitlements (users.plan) + customer mapping.

const WEBHOOK_SECRET = 'whsec_test_secret'

// Minimal in-memory D1 covering only the statements the webhook path executes.
function makeDb() {
  const users = new Map<string, { id: string; plan: string; stripe_customer_id: string | null }>()
  const processedEvents = new Set<string>()
  const auditEvents: Array<{ action: string; actor_id: string; after_snapshot: string }> = []

  function prepare(sql: string) {
    const s = sql.trim()
    let bound: unknown[] = []
    const api = {
      bind(...args: unknown[]) {
        bound = args
        return api
      },
      async first<T>(): Promise<T | null> {
        if (s.startsWith('SELECT stripe_event_id FROM stripe_webhook_events')) {
          return (processedEvents.has(String(bound[0])) ? { stripe_event_id: bound[0] } : null) as T | null
        }
        if (s.startsWith('SELECT id FROM users WHERE stripe_customer_id')) {
          for (const u of users.values()) {
            if (u.stripe_customer_id === bound[0]) return { id: u.id } as T
          }
          return null
        }
        return null
      },
      async run() {
        if (s.startsWith('INSERT INTO stripe_webhook_events')) {
          processedEvents.add(String(bound[0]))
        } else if (s.startsWith('UPDATE users SET plan')) {
          const u = users.get(String(bound[1]))
          if (u) u.plan = String(bound[0])
        } else if (s.startsWith('UPDATE users SET stripe_customer_id')) {
          const u = users.get(String(bound[1]))
          if (u) u.stripe_customer_id = String(bound[0])
        } else if (s.startsWith('INSERT INTO audit_events')) {
          auditEvents.push({
            action: String(bound[3]),
            actor_id: String(bound[2]),
            after_snapshot: String(bound[6]),
          })
        }
        return { success: true }
      },
    }
    return api
  }

  return { prepare, users, auditEvents, processedEvents }
}

function makeKv() {
  const store = new Map<string, string>()
  return {
    store,
    async get(k: string) {
      return store.get(k) ?? null
    },
    async put(k: string, v: string) {
      store.set(k, v)
    },
    async delete(k: string) {
      store.delete(k)
    },
  }
}

async function signedHeaders(body: string): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000)
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${body}`))
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return { 'stripe-signature': `t=${timestamp},v1=${hex}`, 'content-type': 'application/json' }
}

function event(type: string, object: Record<string, unknown>, id = `evt_${Math.random().toString(36).slice(2)}`) {
  return { id, type, created: Math.floor(Date.now() / 1000), data: { object } }
}

describe('Stripe webhook entitlements (#585)', () => {
  let db: ReturnType<typeof makeDb>
  let kv: ReturnType<typeof makeKv>
  let app: Hono<{ Bindings: Env; Variables: any }>
  let env: Env

  beforeEach(() => {
    db = makeDb()
    kv = makeKv()
    db.users.set('user_1', { id: 'user_1', plan: 'free', stripe_customer_id: null })
    app = new Hono<{ Bindings: Env; Variables: any }>()
    app.use('*', async (c, next) => {
      c.set('trace_id', 'trace_test')
      await next()
    })
    mountStripeWebhookRoutes(app)
    env = {
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      STRIPE_STARTER_MONTHLY_PRICE_ID: 'price_starter_m',
      STRIPE_STARTER_ANNUAL_PRICE_ID: 'price_starter_a',
      STRIPE_TEAM_ANNUAL_PRICE_ID: 'price_team_a',
      DB: db as unknown as D1Database,
      USERS_KV: kv as unknown as KVNamespace,
    } as unknown as Env
  })

  async function post(evt: unknown) {
    const body = JSON.stringify(evt)
    const headers = await signedHeaders(body)
    return app.request('/api/billing/webhook/stripe', { method: 'POST', body, headers }, env)
  }

  it('checkout.session.completed upgrades plan and records customer mapping', async () => {
    const res = await post(
      event('checkout.session.completed', {
        id: 'cs_1',
        customer: 'cus_123',
        client_reference_id: 'user_1',
        metadata: { userId: 'user_1', plan: 'starter' },
        amount_total: 2900,
      }),
    )
    expect(res.status).toBe(200)
    expect(db.users.get('user_1')!.plan).toBe('starter')
    expect(db.users.get('user_1')!.stripe_customer_id).toBe('cus_123')
    expect(kv.store.get('stripe:customer-rev:cus_123')).toBe('user_1')
    expect(db.auditEvents.some((a) => a.action === 'billing.checkout_completed')).toBe(true)
  })

  it('subscription.deleted downgrades plan to free', async () => {
    db.users.get('user_1')!.plan = 'starter'
    db.users.get('user_1')!.stripe_customer_id = 'cus_123'
    const res = await post(
      event('customer.subscription.deleted', {
        id: 'sub_1',
        customer: 'cus_123',
        status: 'canceled',
      }),
    )
    expect(res.status).toBe(200)
    expect(db.users.get('user_1')!.plan).toBe('free')
    expect(db.auditEvents.some((a) => a.action === 'billing.subscription_deleted')).toBe(true)
  })

  it('subscription.updated to active starter price upgrades plan', async () => {
    db.users.get('user_1')!.stripe_customer_id = 'cus_123'
    const res = await post(
      event('customer.subscription.updated', {
        id: 'sub_1',
        customer: 'cus_123',
        status: 'active',
        items: { data: [{ id: 'si_1', price: { id: 'price_starter_m' } }] },
      }),
    )
    expect(res.status).toBe(200)
    expect(db.users.get('user_1')!.plan).toBe('starter')
    expect(db.auditEvents.some((a) => a.action === 'billing.subscription_updated')).toBe(true)
  })

  it('invoice.payment_failed is handled and audited (no crash)', async () => {
    db.users.get('user_1')!.stripe_customer_id = 'cus_123'
    const res = await post(
      event('invoice.payment_failed', { id: 'in_1', customer: 'cus_123' }),
    )
    expect(res.status).toBe(200)
    expect(db.auditEvents.some((a) => a.action === 'billing.invoice_payment_failed')).toBe(true)
  })

  it('finds user via KV reverse index when D1 column lookup is empty', async () => {
    // No stripe_customer_id on the D1 row; only the KV reverse index is set.
    kv.store.set('stripe:customer-rev:cus_kvonly', 'user_1')
    const res = await post(
      event('customer.subscription.deleted', { id: 'sub_2', customer: 'cus_kvonly', status: 'canceled' }),
    )
    expect(res.status).toBe(200)
    expect(db.users.get('user_1')!.plan).toBe('free')
  })

  it('is idempotent: a re-delivered event does not double-process', async () => {
    const evt = event(
      'checkout.session.completed',
      { id: 'cs_dup', customer: 'cus_dup', client_reference_id: 'user_1', metadata: { userId: 'user_1', plan: 'starter' }, amount_total: 2900 },
      'evt_fixed_id',
    )
    const r1 = await post(evt)
    expect(r1.status).toBe(200)
    const auditCountAfterFirst = db.auditEvents.length
    const r2 = await post(evt)
    expect(r2.status).toBe(200)
    // Second delivery short-circuits on idempotency: no new audit rows.
    expect(db.auditEvents.length).toBe(auditCountAfterFirst)
  })
})
