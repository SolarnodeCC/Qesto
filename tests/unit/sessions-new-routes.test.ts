// Tests for S18-prerequisite routes added to sessions.ts:
//   GET  /api/sessions/:id/preflight
//   POST /api/sessions/:id/ai/refine
//   GET  /api/sessions/:id/insights/themes

import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import type { AnalyticsEngineDataset } from '@cloudflare/workers-types'
import { testJwtSecret } from '../helpers/test-credentials'

const jwtFixture = testJwtSecret()
const USER_ID = 'user_host_1'
const OTHER_USER = 'user_other_99'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(db: D1Mock, aiOverride?: Partial<Ai>): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: jwtFixture,
    DB: db as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    AI: {
      run: async () => ({ response: '{"questions":[]}' }),
      ...aiOverride,
    } as unknown as Ai,
  } as unknown as Env
}

async function cookieFor(userId: string): Promise<string> {
  const token = await signJwt({ sub: userId, email: `${userId}@example.com` }, jwtFixture, 3600)
  return `qesto_session=${token}`
}

function seedSession(
  db: D1Mock,
  overrides: Partial<{
    id: string
    owner_id: string
    status: 'draft' | 'live' | 'closed' | 'archived'
    title: string
  }> = {},
) {
  const sess = {
    id: 'sess_1',
    owner_id: USER_ID,
    code: 'ABC123',
    title: 'Sprint Retro',
    status: 'draft' as const,
    anonymity: 'anonymous' as const,
    created_at: Date.now(),
    started_at: null,
    closed_at: null,
    archived_at: null,
    ...overrides,
  }
  db.sessions.set(sess.id, sess)
  return sess
}

function seedUser(db: D1Mock, plan: 'free' | 'starter' | 'team' = 'team') {
  db.users.set(USER_ID, {
    id: USER_ID,
    email: `${USER_ID}@example.com`,
    display_name: 'Host',
    created_at: Date.now(),
    last_login_at: null,
    plan,
  })
}

function seedQuestion(
  db: D1Mock,
  overrides: Partial<{
    id: string
    session_id: string
    kind: 'poll' | 'ranking' | 'consent' | 'open' | 'multi_select' | 'likert' | 'upvote' | 'word_cloud' | 'slider'
    options_json: string
  }> = {},
) {
  const q = {
    id: 'q_1',
    session_id: 'sess_1',
    position: 0,
    kind: 'poll' as const,
    prompt: 'What went well?',
    options_json: JSON.stringify([
      { id: 'a', label: 'Teamwork' },
      { id: 'b', label: 'Delivery' },
    ]),
    created_at: Date.now(),
    ...overrides,
  }
  db.questions.set(q.id, q)
  return q
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sessions/:id/preflight
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/sessions/:id/preflight', () => {
  it('returns 401 without auth cookie', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1/preflight'),
      makeEnv(new D1Mock()),
    )
    expect(res.status).toBe(401)
  })

  it('returns 404 when session not owned by caller', async () => {
    const db = new D1Mock()
    seedSession(db, { owner_id: OTHER_USER })
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 when session is not DRAFT', async () => {
    const db = new D1Mock()
    seedSession(db, { status: 'live' })
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(409)
  })

  it('ready:true when all checks pass (title + ≥1 valid question, no AI)', async () => {
    const db = new D1Mock()
    seedSession(db)
    seedQuestion(db)
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: { ready: boolean; checks: Array<{ id: string; pass: boolean }> }
    }
    expect(body.ok).toBe(true)
    expect(body.data.ready).toBe(true)
    expect(body.data.checks.every((c) => c.pass)).toBe(true)
    expect(body.data.checks.find((c) => c.id === 'has_questions')?.pass).toBe(true)
    expect(body.data.checks.find((c) => c.id === 'ai_consent')?.pass).toBe(true)
  })

  it('has_questions fails with no questions', async () => {
    const db = new D1Mock()
    seedSession(db)
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    const body = (await res.json()) as {
      data: { ready: boolean; checks: Array<{ id: string; pass: boolean }> }
    }
    expect(body.data.ready).toBe(false)
    expect(body.data.checks.find((c) => c.id === 'has_questions')?.pass).toBe(false)
  })

  it('questions_valid fails when poll question has only 1 option', async () => {
    const db = new D1Mock()
    seedSession(db)
    seedQuestion(db, { options_json: JSON.stringify([{ id: 'a', label: 'Only one' }]) })
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    const body = (await res.json()) as {
      data: { ready: boolean; checks: Array<{ id: string; pass: boolean }> }
    }
    expect(body.data.ready).toBe(false)
    expect(body.data.checks.find((c) => c.id === 'questions_valid')?.pass).toBe(false)
  })

  it('questions_valid passes for open-type with no options', async () => {
    const db = new D1Mock()
    seedSession(db)
    seedQuestion(db, { kind: 'open', options_json: '[]' })
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    const body = (await res.json()) as {
      data: { ready: boolean; checks: Array<{ id: string; pass: boolean }> }
    }
    expect(body.data.checks.find((c) => c.id === 'questions_valid')?.pass).toBe(true)
  })

  it('questions_valid passes for word_cloud with no options', async () => {
    const db = new D1Mock()
    seedSession(db)
    seedQuestion(db, { kind: 'word_cloud', options_json: '[]' })
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    const body = (await res.json()) as {
      data: { ready: boolean; checks: Array<{ id: string; pass: boolean }> }
    }
    expect(body.data.ready).toBe(true)
    expect(body.data.checks.find((c) => c.id === 'questions_valid')?.pass).toBe(true)
  })

  it('title_set fails when title is empty', async () => {
    const db = new D1Mock()
    seedSession(db, { title: '' })
    seedQuestion(db)
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    const body = (await res.json()) as {
      data: { ready: boolean; checks: Array<{ id: string; pass: boolean }> }
    }
    expect(body.data.ready).toBe(false)
    expect(body.data.checks.find((c) => c.id === 'title_set')?.pass).toBe(false)
  })

  it('requires consent when session is marked AI-generated', async () => {
    const db = new D1Mock()
    seedSession(db, { title: 'AI Retro' })
    const row = db.sessions.get('sess_1') as { ai_generated?: number; ai_consent_at?: number | null }
    row.ai_generated = 1
    row.ai_consent_at = null
    seedQuestion(db)
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    const body = (await res.json()) as {
      data: { ready: boolean; checks: Array<{ id: string; pass: boolean }> }
    }
    expect(body.data.ready).toBe(false)
    expect(body.data.checks.find((c) => c.id === 'ai_consent')?.pass).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/sessions/:id AI provenance
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/sessions/:id AI provenance', () => {
  it('persists AI provenance so preflight consent passes', async () => {
    const db = new D1Mock()
    seedSession(db, { title: 'AI Retro' })
    seedQuestion(db)
    const app = createApp()
    const cookie = await cookieFor(USER_ID)
    const consentAt = Date.now()

    const patchRes = await app.fetch(
      new Request('http://local/api/sessions/sess_1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          ai_generated: true,
          ai_consent_at: consentAt,
          ai_grounding_hash: 'abc123',
        }),
      }),
      makeEnv(db),
    )
    expect(patchRes.status).toBe(200)

    const preflightRes = await app.fetch(
      new Request('http://local/api/sessions/sess_1/preflight', { headers: { cookie } }),
      makeEnv(db),
    )
    const body = (await preflightRes.json()) as {
      data: { ready: boolean; checks: Array<{ id: string; pass: boolean }> }
    }
    expect(body.data.ready).toBe(true)
    expect(body.data.checks.find((c) => c.id === 'ai_consent')?.pass).toBe(true)
    expect(db.sessions.get('sess_1')?.ai_generated).toBe(1)
    expect(db.sessions.get('sess_1')?.ai_consent_at).toBe(consentAt)
    expect(db.sessions.get('sess_1')?.ai_grounding_hash).toBe('abc123')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sessions/:id/ai/generate
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/sessions/:id/ai/generate', () => {
  const aiResponse = JSON.stringify({
    questions: Array.from({ length: 5 }, (_, i) => ({
      kind: i === 4 ? 'word_cloud' : 'poll',
      prompt: `Question ${i + 1}?`,
      options: i === 4 ? [] : [
        { label: 'One' },
        { label: 'Two' },
      ],
    })),
  })

  it('streams ready and questions events for a DRAFT session', async () => {
    const db = new D1Mock()
    seedSession(db)
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/ai/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await cookieFor(USER_ID) },
        body: JSON.stringify({ sessionTitle: 'Sprint Retro', sessionGoal: 'Improve planning' }),
      }),
      makeEnv(db, { run: (async () => ({ response: aiResponse })) as unknown as Ai['run'] }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const text = await res.text()
    expect(text).toContain('event: ready')
    expect(text).toContain('event: questions')
    expect(text).toContain('event: done')
    expect(text).toContain('groundingHash')
    expect(text).toContain('word_cloud')
  })

  it('repairs common AI JSON variants instead of failing the wizard', async () => {
    const db = new D1Mock()
    seedSession(db)
    const repairedResponse = JSON.stringify([
      { type: 'poll', question: 'Which risk needs attention first?', options: ['Scope', 'Timing'] },
      { kind: 'consent', prompt: 'Are we aligned on the next step?', options: [] },
      { kind: 'open', text: 'What context should we add before deciding?', options: [] },
    ])
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/ai/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await cookieFor(USER_ID) },
        body: JSON.stringify({ sessionTitle: 'Sprint Retro', sessionGoal: 'Improve planning' }),
      }),
      makeEnv(db, { run: (async () => ({ response: repairedResponse })) as unknown as Ai['run'] }),
    )

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('event: questions')
    expect(text).toContain('Which risk needs attention first?')
    expect(text).toContain('Scope')
    expect(text).toContain('Agree')
  })

  it('returns 409 for non-DRAFT sessions before opening the stream', async () => {
    const db = new D1Mock()
    seedSession(db, { status: 'live' })
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/ai/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await cookieFor(USER_ID) },
        body: JSON.stringify({ sessionTitle: 'Sprint Retro', sessionGoal: 'Improve planning' }),
      }),
      makeEnv(db, { run: (async () => ({ response: aiResponse })) as unknown as Ai['run'] }),
    )
    expect(res.status).toBe(409)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sessions/:id/ai/refine
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/sessions/:id/ai/refine', () => {
  it('returns 401 without auth', async () => {
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/ai/refine', { method: 'POST' }),
      makeEnv(new D1Mock()),
    )
    expect(res.status).toBe(401)
  })

  it('returns 404 when session not found', async () => {
    const db = new D1Mock()
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/ai/refine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await cookieFor(USER_ID) },
        body: JSON.stringify({ grounding: 'team values', feedback: 'more specific' }),
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 when session is LIVE', async () => {
    const db = new D1Mock()
    seedSession(db, { status: 'live' })
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/ai/refine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await cookieFor(USER_ID) },
        body: JSON.stringify({ grounding: 'team values', feedback: 'more specific' }),
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(409)
  })

  it('returns 400 when grounding is missing', async () => {
    const db = new D1Mock()
    seedSession(db)
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/ai/refine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await cookieFor(USER_ID) },
        body: JSON.stringify({ feedback: 'more specific' }),
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('validation')
  })

  it('returns 400 when feedback is missing', async () => {
    const db = new D1Mock()
    seedSession(db)
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/ai/refine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await cookieFor(USER_ID) },
        body: JSON.stringify({ grounding: 'team values' }),
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sessions/:id/insights/themes
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/sessions/:id/insights/themes', () => {
  it('returns 401 without auth', async () => {
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/insights/themes'),
      makeEnv(new D1Mock()),
    )
    expect(res.status).toBe(401)
  })

  it('returns 409 when session is DRAFT (not closed)', async () => {
    const db = new D1Mock()
    seedUser(db)
    seedSession(db, { status: 'draft' })
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/insights/themes', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('conflict')
  })

  it('returns empty themes when insights_daily has no rows', async () => {
    const db = new D1Mock()
    seedUser(db)
    seedSession(db, { status: 'closed' })
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/insights/themes', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: { themes: unknown[]; trend: unknown[]; window: string }
    }
    expect(body.ok).toBe(true)
    expect(body.data.themes).toEqual([])
    expect(body.data.trend).toEqual([])
    expect(body.data.window).toBe('30d')
  })

  it('returns themes and trend rows from insights_daily', async () => {
    const db = new D1Mock()
    seedUser(db)
    seedSession(db, { status: 'closed' })
    const themes = [{ label: 'Collaboration', count: 12 }]
    db.insightsDaily.set('row_1', {
      id: 'row_1',
      session_id: 'sess_1',
      day: '2026-04-29',
      themes_json: JSON.stringify(themes),
      confidence: 0.85,
      n_votes: 42,
      computed_at: Date.now(),
    })
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/insights/themes?window=7d', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: {
        themes: Array<{ label: string; count: number }>
        trend: Array<{ day: string; confidence: number; n_votes: number }>
        window: string
      }
    }
    expect(body.data.themes).toEqual(themes)
    expect(body.data.trend).toHaveLength(1)
    expect(body.data.trend[0].day).toBe('2026-04-29')
    expect(body.data.trend[0].confidence).toBe(0.85)
    expect(body.data.window).toBe('7d')
  })

  it('accepts archived status', async () => {
    const db = new D1Mock()
    seedUser(db)
    seedSession(db, { status: 'archived' })
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/insights/themes', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
  })

  it('returns 403 for free plan', async () => {
    const db = new D1Mock()
    seedUser(db, 'free')
    seedSession(db, { status: 'closed' })
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/insights/themes', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('feature_not_available')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// OBS-02: preflight.checked Analytics Engine event
// ─────────────────────────────────────────────────────────────────────────────

describe('preflight emits preflight.checked AE event', () => {
  function makeEnvWithAe(db: D1Mock) {
    const mockAe = { writeDataPoint: vi.fn() }
    const env = { ...makeEnv(db), METRICS_AE: mockAe as unknown as AnalyticsEngineDataset }
    return { env, mockAe }
  }

  it('emits event with count=0 when all checks pass', async () => {
    const db = new D1Mock()
    seedSession(db)
    seedQuestion(db)
    const { env, mockAe } = makeEnvWithAe(db)
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { ready: boolean } }
    expect(body.data.ready).toBe(true)
    expect(mockAe.writeDataPoint).toHaveBeenCalledOnce()
    const dp = mockAe.writeDataPoint.mock.calls[0][0] as { blobs: string[]; doubles: number[] }
    expect(dp.blobs[0]).toBe('preflight.checked')
    expect(dp.doubles[1]).toBe(0)
  })

  it('emits event with count=1 when title_set fails', async () => {
    const db = new D1Mock()
    seedSession(db, { title: '' })
    seedQuestion(db)
    const { env, mockAe } = makeEnvWithAe(db)
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { ready: boolean } }
    expect(body.data.ready).toBe(false)
    expect(mockAe.writeDataPoint).toHaveBeenCalledTimes(2)
    const checked = mockAe.writeDataPoint.mock.calls[0][0] as { blobs: string[]; doubles: number[] }
    expect(checked.blobs[0]).toBe('preflight.checked')
    expect(checked.doubles[1]).toBeGreaterThan(0)
    const failed = mockAe.writeDataPoint.mock.calls[1][0] as { blobs: string[]; doubles: number[] }
    expect(failed.blobs[0]).toBe('preflight.failed')
    expect(failed.doubles[1]).toBeGreaterThan(0)
  })

  it('is still 200 even when METRICS_AE is absent (fail-open)', async () => {
    const db = new D1Mock()
    seedSession(db)
    seedQuestion(db)
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/preflight', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// OBS-02: ai.rate_limited Analytics Engine event
// ─────────────────────────────────────────────────────────────────────────────

describe('AI generate emits ai.rate_limited AE event when rate limit is exceeded', () => {
  it('returns 429 and emits ai.rate_limited for /ai/generate', async () => {
    const db = new D1Mock()
    seedSession(db)
    const kvMock = new KVMock()
    const resetAt = Date.now() + 3600 * 1000
    await kvMock.put('rl:ai-wizard:user_host_1', JSON.stringify({ count: 20, resetAt }))
    const mockAe = { writeDataPoint: vi.fn() }
    const env = {
      ...makeEnv(db),
      ACTIONS_KV: kvMock as unknown as KVNamespace,
      METRICS_AE: mockAe as unknown as AnalyticsEngineDataset,
    }
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/ai/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await cookieFor(USER_ID) },
        body: JSON.stringify({ sessionTitle: 'Test', sessionGoal: 'Test goal' }),
      }),
      env,
    )
    expect(res.status).toBe(429)
    expect(mockAe.writeDataPoint).toHaveBeenCalledOnce()
    const dp = mockAe.writeDataPoint.mock.calls[0][0] as { blobs: string[] }
    expect(dp.blobs[0]).toBe('ai.rate_limited')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// S19-MEASURE-01: PATCH ai_accepted_count / ai_dismissed_count
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/sessions/:id accepts ai_accepted_count and ai_dismissed_count', () => {
  it('persists acceptance counts alongside AI provenance', async () => {
    const db = new D1Mock()
    seedSession(db, { title: 'AI Retro' })
    const cookie = await cookieFor(USER_ID)
    const consentAt = Date.now()

    const patchRes = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          ai_generated: true,
          ai_consent_at: consentAt,
          ai_accepted_count: 4,
          ai_dismissed_count: 1,
        }),
      }),
      makeEnv(db),
    )
    expect(patchRes.status).toBe(200)
    expect(db.sessions.get('sess_1')?.ai_accepted_count).toBe(4)
    expect(db.sessions.get('sess_1')?.ai_dismissed_count).toBe(1)
  })

  it('rejects negative acceptance counts', async () => {
    const db = new D1Mock()
    seedSession(db)
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: await cookieFor(USER_ID) },
        body: JSON.stringify({ ai_accepted_count: -1 }),
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(400)
  })

  it('ai_accepted_count alone satisfies the at-least-one-field refine', async () => {
    const db = new D1Mock()
    seedSession(db)
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: await cookieFor(USER_ID) },
        body: JSON.stringify({ ai_accepted_count: 0 }),
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
    expect(db.sessions.get('sess_1')?.ai_accepted_count).toBe(0)
  })
})
