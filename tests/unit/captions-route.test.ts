// CAPTIONS-PIPELINE-01 (ADR-0051) — ingest route: plan-gating, ASR->broadcast,
// MT fan-out bounded by the DO active-locale set, no-persistence. `c.env.AI.run`
// and the SESSION_ROOM DO are mocked; nothing reaches Workers AI or a real DO.

import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { CircuitBreakers } from '../../functions/api/lib/resilience/circuit-breaker'

const SECRET = 'integration-test-secret-at-least-32-bytes!'
const USER_ID = 'user_host_1'
const kv = () => new KVMock() as unknown as KVNamespace

// Records every internal DO fetch so we can assert broadcast payloads + that the
// route reads the active-locale set. Returns a configurable distinct-locale set.
function makeRoomNamespace(activeLocales: string[]) {
  const broadcasts: Array<Record<string, unknown>> = []
  const namespace = {
    idFromName: (name: string) => ({ name }),
    get: () => ({
      async fetch(input: string | Request, init?: RequestInit) {
        const req = input instanceof Request ? input : new Request(input, init)
        const url = new URL(req.url)
        if (url.pathname === '/captions/active-locales') {
          return new Response(JSON.stringify({ active: true, sourceLocale: 'en', locales: activeLocales }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        if (url.pathname === '/captions/broadcast') {
          broadcasts.push((await req.json()) as Record<string, unknown>)
          return new Response(JSON.stringify({ ok: true }), { status: 200 })
        }
        return new Response('not found', { status: 404 })
      },
    }),
  }
  return { namespace, broadcasts }
}

function makeEnv(db: D1Mock, room: ReturnType<typeof makeRoomNamespace>['namespace'], ai: Env['AI']): Env {
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
    SESSION_ROOM: room as unknown as DurableObjectNamespace,
    AI: ai,
  } as unknown as Env
}

function mockAi(asr: string, mtByTarget: Record<string, string> = {}): Env['AI'] {
  const run = vi.fn(async (model: string, input: Record<string, unknown>) => {
    if (model === '@cf/openai/whisper') return { text: asr }
    if (model === '@cf/meta/m2m100-1.2b') {
      return { translated_text: mtByTarget[input.target_lang as string] ?? '' }
    }
    throw new Error(`unexpected model ${model}`)
  })
  return { run } as unknown as Env['AI']
}

async function cookie(userId = USER_ID): Promise<string> {
  return `qesto_session=${await signJwt({ sub: userId, email: `${userId}@example.com` }, SECRET, 3600)}`
}

function seed(db: D1Mock, plan: 'free' | 'starter' | 'team') {
  db.users.set(USER_ID, {
    id: USER_ID,
    email: `${USER_ID}@example.com`,
    display_name: 'Host',
    plan,
    created_at: Date.now(),
    last_login_at: null,
  } as never)
  db.sessions.set('sess_1', {
    id: 'sess_1',
    owner_id: USER_ID,
    code: 'ABC123',
    title: 'All Hands',
    status: 'live',
    anonymity: 'full',
    vote_policy: 'once',
    session_mode: 'reflection',
    created_at: 1000,
    started_at: Date.now(),
    closed_at: null,
    archived_at: null,
  } as never)
}

function ingest(
  env: Env,
  c: string | null,
  query: Record<string, string>,
  audio: Uint8Array = new Uint8Array([1, 2, 3, 4]),
) {
  const qs = new URLSearchParams(query).toString()
  return createApp().fetch(
    new Request(`http://local/api/sessions/sess_1/captions/ingest?${qs}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', ...(c ? { cookie: c } : {}) },
      body: audio as unknown as BodyInit,
    }),
    env,
  )
}

describe('POST /api/sessions/:id/captions/ingest — plan gating', () => {
  it('denies the free plan with feature_not_available (liveCaptions)', async () => {
    CircuitBreakers.ai.reset()
    const db = new D1Mock()
    seed(db, 'free')
    const { namespace } = makeRoomNamespace([])
    const res = await ingest(makeEnv(db, namespace, mockAi('hi')), await cookie(), { sourceLocale: 'en', seq: '0' })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { details: { feature: string } } }
    expect(body.error.details.feature).toBe('liveCaptions')
  })

  it('denies the starter plan', async () => {
    CircuitBreakers.ai.reset()
    const db = new D1Mock()
    seed(db, 'starter')
    const { namespace } = makeRoomNamespace([])
    const res = await ingest(makeEnv(db, namespace, mockAi('hi')), await cookie(), { sourceLocale: 'en', seq: '0' })
    expect(res.status).toBe(403)
  })

  it('allows the team plan', async () => {
    CircuitBreakers.ai.reset()
    const db = new D1Mock()
    seed(db, 'team')
    const { namespace } = makeRoomNamespace([])
    const res = await ingest(makeEnv(db, namespace, mockAi('hello everyone')), await cookie(), {
      sourceLocale: 'en',
      seq: '0',
      final: 'true',
    })
    expect(res.status).toBe(202)
    const body = (await res.json()) as { ok: boolean; data: { id: string; isFinal: boolean } }
    expect(body.ok).toBe(true)
    expect(body.data.isFinal).toBe(true)
  })
})

describe('ingest — ASR -> broadcast caption_segment', () => {
  it('produces a broadcast payload with the source transcript', async () => {
    CircuitBreakers.ai.reset()
    const db = new D1Mock()
    seed(db, 'team')
    const { namespace, broadcasts } = makeRoomNamespace([])
    await ingest(makeEnv(db, namespace, mockAi('hello everyone')), await cookie(), {
      sourceLocale: 'en',
      seq: '0',
      final: 'true',
    })
    expect(broadcasts).toHaveLength(1)
    expect(broadcasts[0]).toMatchObject({ sourceLocale: 'en', sourceText: 'hello everyone', isFinal: true })
  })

  it('translates ONCE per distinct active locale (fan-out bounded by the DO set)', async () => {
    CircuitBreakers.ai.reset()
    const db = new D1Mock()
    seed(db, 'team')
    const { namespace, broadcasts } = makeRoomNamespace(['nl', 'es'])
    const ai = mockAi('hello everyone', { nl: 'hallo iedereen', es: 'hola a todos' })
    await ingest(makeEnv(db, namespace, ai), await cookie(), { sourceLocale: 'en', seq: '0', final: 'true' })
    // 1 ASR + exactly 2 MT calls (nl, es) — not per participant.
    expect((ai.run as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[0] === '@cf/meta/m2m100-1.2b')).toHaveLength(2)
    expect(broadcasts[0].variants).toEqual({ nl: 'hallo iedereen', es: 'hola a todos' })
  })

  it('skips MT entirely for a partial (isFinal:false) — source-only, low latency', async () => {
    CircuitBreakers.ai.reset()
    const db = new D1Mock()
    seed(db, 'team')
    const { namespace, broadcasts } = makeRoomNamespace(['nl'])
    const ai = mockAi('hello', { nl: 'hallo' })
    await ingest(makeEnv(db, namespace, ai), await cookie(), { sourceLocale: 'en', seq: '0', final: 'false' })
    expect((ai.run as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[0] === '@cf/meta/m2m100-1.2b')).toHaveLength(0)
    expect(broadcasts[0].variants).toEqual({})
    expect(broadcasts[0].isFinal).toBe(false)
  })

  it('degrades to "captions paused" (202 paused) when ASR is unavailable', async () => {
    CircuitBreakers.ai.reset()
    const db = new D1Mock()
    seed(db, 'team')
    const { namespace, broadcasts } = makeRoomNamespace([])
    // ASR returns empty text -> transcribeAudio returns null -> paused.
    const res = await ingest(makeEnv(db, namespace, mockAi('')), await cookie(), {
      sourceLocale: 'en',
      seq: '0',
      final: 'true',
    })
    expect(res.status).toBe(202)
    const body = (await res.json()) as { data: { paused?: boolean } }
    expect(body.data.paused).toBe(true)
    expect(broadcasts).toHaveLength(0) // nothing broadcast
  })
})

describe('ingest — no persistence (privacy moat)', () => {
  it('writes NOTHING to D1 (no audio/transcript persisted)', async () => {
    CircuitBreakers.ai.reset()
    const db = new D1Mock()
    seed(db, 'team')
    const writes: string[] = []
    const realPrepare = db.prepare.bind(db)
    // Spy on any write-shaped statement (INSERT/UPDATE/DELETE) executed via the route.
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (/^\s*(insert|update|delete)/i.test(sql)) writes.push(sql)
      return realPrepare(sql)
    })
    await ingest(makeEnv(db, makeRoomNamespace(['nl']).namespace, mockAi('hello', { nl: 'hallo' })), await cookie(), {
      sourceLocale: 'en',
      seq: '0',
      final: 'true',
    })
    expect(writes).toEqual([])
  })

  it('rejects an empty audio chunk', async () => {
    CircuitBreakers.ai.reset()
    const db = new D1Mock()
    seed(db, 'team')
    const res = await ingest(
      makeEnv(db, makeRoomNamespace([]).namespace, mockAi('hi')),
      await cookie(),
      { sourceLocale: 'en', seq: '0' },
      new Uint8Array([]),
    )
    expect(res.status).toBe(400)
  })

  it('404s when a different (team-plan) user tries to ingest a session they do not own', async () => {
    CircuitBreakers.ai.reset()
    const db = new D1Mock()
    seed(db, 'team')
    // A second team-plan user clears the plan gate but not ownership (fetchSession
    // scopes by owner_id) -> 404, never another host's audio entry point.
    db.users.set('user_other', {
      id: 'user_other',
      email: 'user_other@example.com',
      display_name: 'Other',
      plan: 'team',
      created_at: Date.now(),
      last_login_at: null,
    } as never)
    const res = await ingest(
      makeEnv(db, makeRoomNamespace([]).namespace, mockAi('hi')),
      await cookie('user_other'),
      { sourceLocale: 'en', seq: '0' },
    )
    expect(res.status).toBe(404)
  })
})
