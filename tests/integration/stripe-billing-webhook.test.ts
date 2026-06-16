// #541 — coverage for the revenue-critical Stripe webhook contract:
// signature verification, idempotency, schema validation, and event routing.
//
// Note: plan up/downgrade assertions are intentionally NOT covered here because
// findUserByCustomerId() in billing.ts is currently a documented stub that always
// returns null (BILL-07), so the subscription handlers no-op on the user mapping.
// These tests pin the security + idempotency behaviour that protects revenue.

import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const WEBHOOK_SECRET = 'whsec_test_secret_value'

function makeEnv(db: D1Mock, overrides: Partial<Env> = {}): Env {
  const kv = () => new KVMock() as unknown as KVNamespace
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    DB: db as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    COMMIT_SHA: 'test',
    ...overrides,
  } as unknown as Env
}

async function stripeSignature(body: string, secret: string, ts = Math.floor(Date.now() / 1000)): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${body}`))
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `t=${ts},v1=${hex}`
}

function subscriptionEvent(id: string, type = 'customer.subscription.updated') {
  return {
    id,
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: 'sub_123', customer: 'cus_123', status: 'active' } },
  }
}

async function postWebhook(env: Env, body: string, sig: string | null) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (sig !== null) headers['stripe-signature'] = sig
  return createApp().fetch(
    new Request('http://local/api/billing/webhook/stripe', { method: 'POST', headers, body }),
    env,
  )
}

describe('Stripe billing webhook (#541)', () => {
  it('accepts a correctly-signed event and records it as processed', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    const body = JSON.stringify(subscriptionEvent('evt_ok_1'))
    const res = await postWebhook(env, body, await stripeSignature(body, WEBHOOK_SECRET))
    expect(res.status).toBe(200)
    expect(db.stripeWebhookEvents.has('evt_ok_1')).toBe(true)
  })

  it('rejects an invalid signature with 401 and does not record the event', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    const body = JSON.stringify(subscriptionEvent('evt_bad_sig'))
    const res = await postWebhook(env, body, 't=123,v1=deadbeef')
    expect(res.status).toBe(401)
    expect(db.stripeWebhookEvents.has('evt_bad_sig')).toBe(false)
  })

  it('rejects a missing signature header with 401', async () => {
    const env = makeEnv(new D1Mock())
    const body = JSON.stringify(subscriptionEvent('evt_no_sig'))
    const res = await postWebhook(env, body, null)
    expect(res.status).toBe(401)
  })

  it('is idempotent — a duplicate delivery is not reprocessed', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    const body = JSON.stringify(subscriptionEvent('evt_dup'))
    const sig = await stripeSignature(body, WEBHOOK_SECRET)

    const first = await postWebhook(env, body, sig)
    expect(first.status).toBe(200)

    const second = await postWebhook(env, body, sig)
    expect(second.status).toBe(200)
    const secondBody = (await second.json()) as { data: { message: string } }
    expect(secondBody.data.message).toMatch(/already processed/i)
    expect(db.stripeWebhookEvents.size).toBe(1)
  })

  it('returns 503 when the webhook secret is not configured', async () => {
    const env = makeEnv(new D1Mock())
    ;(env as Record<string, unknown>).STRIPE_WEBHOOK_SECRET = undefined
    const body = JSON.stringify(subscriptionEvent('evt_misconfig'))
    const res = await postWebhook(env, body, await stripeSignature(body, WEBHOOK_SECRET))
    expect(res.status).toBe(503)
  })

  it('rejects a correctly-signed but malformed event with 400', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    const body = JSON.stringify({ not: 'a stripe event' })
    const res = await postWebhook(env, body, await stripeSignature(body, WEBHOOK_SECRET))
    expect(res.status).toBe(400)
  })

  it('accepts an unhandled event type (200) without error', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    const body = JSON.stringify(subscriptionEvent('evt_unhandled', 'charge.refunded'))
    const res = await postWebhook(env, body, await stripeSignature(body, WEBHOOK_SECRET))
    expect(res.status).toBe(200)
    expect(db.stripeWebhookEvents.has('evt_unhandled')).toBe(true)
  })

  it('rejects an empty body with 400', async () => {
    const env = makeEnv(new D1Mock())
    const res = await postWebhook(env, '', await stripeSignature('', WEBHOOK_SECRET))
    expect(res.status).toBe(400)
  })
})
