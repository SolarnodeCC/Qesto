import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { PLAN_QUOTAS } from '../../functions/api/types'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    DB: new D1Mock() as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    COMMIT_SHA: 'test',
  } as unknown as Env
}

describe('GET /api/plans/catalog (WS6)', () => {
  it('returns authoritative PLAN_QUOTAS rows without auth', async () => {
    const app = createApp()
    const res = await app.fetch(new Request('http://local/api/plans/catalog'), makeEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: {
        free: { max_sessions_per_month: number; max_participants_per_session: number }
      }
    }
    expect(body.ok).toBe(true)
    expect(body.data.free.max_sessions_per_month).toBe(PLAN_QUOTAS.free.maxSessionsPerMonth)
    expect(body.data.free.max_participants_per_session).toBe(PLAN_QUOTAS.free.maxParticipantsPerSession)
  })

  it('surfaces non-secret Stripe price metadata when configured', async () => {
    const app = createApp()
    const env = {
      ...makeEnv(),
      STRIPE_STARTER_MONTHLY_PRICE_ID: 'price_monthly_123',
      STRIPE_STARTER_ANNUAL_PRICE_ID: 'price_annual_123',
      STARTER_MONTHLY_EUR_CENTS: '3100',
      STARTER_ANNUAL_EUR_CENTS: '2600',
    } as Env
    const res = await app.fetch(new Request('http://local/api/plans/catalog'), env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: {
        pricing: {
          starter: {
            currency: string
            monthly_cents: number
            annual_cents: number
            monthly_price_id: string | null
            annual_price_id: string | null
          }
        }
      }
    }
    expect(body.data.pricing.starter.currency).toBe('EUR')
    expect(body.data.pricing.starter.monthly_cents).toBe(3100)
    expect(body.data.pricing.starter.annual_cents).toBe(2600)
    expect(body.data.pricing.starter.monthly_price_id).toBe('price_monthly_123')
    expect(body.data.pricing.starter.annual_price_id).toBe('price_annual_123')
  })
})
