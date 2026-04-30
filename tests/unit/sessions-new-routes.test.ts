// Tests for S18-prerequisite routes added to sessions.ts:
//   GET  /api/sessions/:id/preflight
//   POST /api/sessions/:id/ai/refine
//   GET  /api/sessions/:id/insights/themes

import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'
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
    JWT_SECRET: SECRET,
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
  const token = await signJwt({ sub: userId, email: `${userId}@example.com` }, SECRET, 3600)
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

function seedQuestion(
  db: D1Mock,
  overrides: Partial<{
    id: string
    session_id: string
    kind: 'poll' | 'ranking' | 'consent' | 'open'
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
    seedSession(db, { status: 'archived' })
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/insights/themes', {
        headers: { cookie: await cookieFor(USER_ID) },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
  })
})
