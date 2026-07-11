// Audit E-1 (REST half) + E-2 — the REST energizer plane after consolidation:
//  - GET /energizers/active is host-only (it returns raw configs incl. answer
//    keys; it previously had NO access check at all),
//  - live results are read from the DO (single answer store) with a D1
//    fallback for legacy REST votes,
//  - the team-quiz REST vote no longer echoes `correct` and rejects
//    re-answers (the upsert allowed brute-forcing the answer key),
//  - host lifecycle changes (PATCH activate / POST next) are synced into the
//    SessionRoom DO so participants receive them over the WebSocket.

import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AuthVariables } from '../../functions/api/middleware/auth'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { registerEnergizerActiveRoute } from '../../functions/api/routes/energizers/active'
import { registerEnergizerVoteNextRoutes } from '../../functions/api/routes/energizers/vote-next'
import { registerEnergizerPatchRoute } from '../../functions/api/routes/energizers/patch'

type Vars = AuthVariables

type DOCall = { path: string; body: unknown }

// Minimal DO namespace fake: records /energizer-sync posts and serves a
// canned /energizer-state read.
function makeSessionRoomFake(liveState: unknown = null) {
  const calls: DOCall[] = []
  const namespace = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (url: string | URL | Request, init?: RequestInit) => {
        const path = new URL(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).pathname
        const body = init?.body ? JSON.parse(init.body as string) : undefined
        calls.push({ path, body })
        if (path === '/energizer-state') {
          return new Response(JSON.stringify({ ok: true, energizer: liveState }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ ok: true, applied: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    }),
  }
  return { namespace, calls }
}

function makeApp(userSub: string) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', async (c, next) => {
    c.set('trace_id', 'trace-test')
    c.set('user', { sub: userSub, email: `${userSub}@example.com`, iat: 1, exp: 2 })
    await next()
  })
  registerEnergizerActiveRoute(app)
  registerEnergizerVoteNextRoutes(app)
  registerEnergizerPatchRoute(app)
  return app
}

function makeEnv(db: D1Mock, sessionRoom?: unknown): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    DB: db as unknown as D1Database,
    ...(sessionRoom ? { SESSION_ROOM: sessionRoom } : {}),
  } as unknown as Env
}

function seedSession(db: D1Mock, status: 'draft' | 'energizing' | 'live' = 'energizing') {
  db.sessions.set('sess_1', {
    id: 'sess_1',
    owner_id: 'user_host',
    code: 'ABC123',
    title: 'Warm-up',
    status,
    anonymity: 'anonymous',
    created_at: 1,
    started_at: 1,
    closed_at: null,
    archived_at: null,
    team_id: null,
  })
}

function seedQuickFinger(db: D1Mock, state: 'draft' | 'active' = 'active') {
  db.energizers.set('eg_qf', {
    id: 'eg_qf',
    session_id: 'sess_1',
    kind: 'quick_finger',
    prompt: 'Fastest finger',
    options_json: '[]',
    config_json: JSON.stringify({ options: ['A', 'B'], correct_index: 1 }),
    position: 0,
    state,
    created_at: 1,
    updated_at: 5,
  })
}

function seedTeamQuiz(db: D1Mock, currentIndex = 0) {
  db.energizers.set('eg_tq', {
    id: 'eg_tq',
    session_id: 'sess_1',
    kind: 'team_quiz',
    prompt: 'Quiz time',
    options_json: '[]',
    config_json: JSON.stringify({
      questions: [
        { prompt: 'First?', options: ['A', 'B'], correct_index: 0 },
        { prompt: 'Second?', options: ['C', 'D'], correct_index: 1 },
      ],
      current_index: currentIndex,
    }),
    position: 0,
    state: 'active',
    created_at: 1,
    updated_at: 5,
  })
}

describe('GET /energizers/active — host-only (audit E-1 REST)', () => {
  it('404s for authenticated non-owners so answer keys are unreachable', async () => {
    const db = new D1Mock()
    seedSession(db)
    seedQuickFinger(db)

    const res = await makeApp('user_other').fetch(
      new Request('http://local/sessions/sess_1/energizers/active'),
      makeEnv(db),
    )
    expect(res.status).toBe(404)
  })

  it('serves the owner the full config plus DO-derived live rankings', async () => {
    const db = new D1Mock()
    seedSession(db, 'energizing')
    seedQuickFinger(db)
    const { namespace } = makeSessionRoomFake({
      id: 'eg_qf',
      kind: 'quick_finger',
      title: 'Fastest finger',
      status: 'active',
      options: ['A', 'B'],
      correctIndex: 1,
      answers: [
        { voterId: 'anon_1', value: 'B', correct: true, speedMs: 240, rank: 1 },
        { voterId: 'anon_2', value: 'A', correct: false, speedMs: 900, rank: 0 },
      ],
    })

    const res = await makeApp('user_host').fetch(
      new Request('http://local/sessions/sess_1/energizers/active'),
      makeEnv(db, namespace),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: {
        energizer: { config: { correct_index: number } }
        rankings: { voter_id: string; correct: boolean; rank: number }[]
      }
    }
    // The host still sees the answer key…
    expect(body.data.energizer.config.correct_index).toBe(1)
    // …and live results come from the DO answer store, not D1.
    expect(body.data.rankings).toMatchObject([
      { voter_id: 'anon_1', correct: true, rank: 1 },
      { voter_id: 'anon_2', correct: false, rank: -1 },
    ])
  })

  it('falls back to D1 vote aggregation when the DO has no matching energizer', async () => {
    const db = new D1Mock()
    seedSession(db, 'energizing')
    seedQuickFinger(db)
    db.energizerVotes.set('eg_qf:anon_1', {
      id: 'v1',
      energizer_id: 'eg_qf',
      session_id: 'sess_1',
      voter_id: 'anon_1',
      value: 'B',
      created_at: 105,
    })
    const { namespace } = makeSessionRoomFake(null)

    const res = await makeApp('user_host').fetch(
      new Request('http://local/sessions/sess_1/energizers/active'),
      makeEnv(db, namespace),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { rankings: { voter_id: string; correct: boolean }[] } }
    expect(body.data.rankings).toMatchObject([{ voter_id: 'anon_1', correct: true }])
  })
})

describe('POST /energizers/:id/vote — team quiz (audit E-1 REST)', () => {
  it('does not echo correctness and rejects re-answers', async () => {
    const db = new D1Mock()
    seedSession(db)
    seedTeamQuiz(db)
    const env = makeEnv(db)
    const app = makeApp('user_voter')

    const vote = (value: string) =>
      app.fetch(
        new Request('http://local/sessions/sess_1/energizers/eg_tq/vote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ value }),
        }),
        env,
      )

    const first = await vote('B')
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as { data: Record<string, unknown> }
    expect(firstBody.data).toEqual({ voted: 'B' })
    expect('correct' in firstBody.data).toBe(false)

    // Re-answering (the brute-force vector) is now rejected.
    const second = await vote('A')
    expect(second.status).toBe(409)
    const secondBody = (await second.json()) as { error: { code: string } }
    expect(secondBody.error.code).toBe('duplicate')

    // The stored response kept the first (wrong) answer.
    expect(db.teamQuizResponses.get('eg_tq:user_voter:0')).toMatchObject({ value: 'B', correct: 0 })
  })

  it('rejects values outside the question options', async () => {
    const db = new D1Mock()
    seedSession(db)
    seedTeamQuiz(db)

    const res = await makeApp('user_voter').fetch(
      new Request('http://local/sessions/sess_1/energizers/eg_tq/vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: 'Z' }),
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(400)
  })
})

describe('REST→DO lifecycle sync (audit E-2)', () => {
  it('PATCH state=active posts the projected energizer to /energizer-sync', async () => {
    const db = new D1Mock()
    seedSession(db, 'energizing')
    seedQuickFinger(db, 'draft')
    const { namespace, calls } = makeSessionRoomFake()

    const res = await makeApp('user_host').fetch(
      new Request('http://local/sessions/sess_1/energizers/eg_qf', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: 'active' }),
      }),
      makeEnv(db, namespace),
    )
    expect(res.status).toBe(200)

    const sync = calls.find((c) => c.path === '/energizer-sync')
    expect(sync?.body).toMatchObject({
      action: 'activate',
      energizer: {
        id: 'eg_qf',
        kind: 'quick_finger',
        options: ['A', 'B'],
        correctIndex: 1,
        status: 'active',
      },
    })
  })

  it('PATCH does not sync while the session is still draft (DO does not exist)', async () => {
    const db = new D1Mock()
    seedSession(db, 'draft')
    seedQuickFinger(db, 'draft')
    const { namespace, calls } = makeSessionRoomFake()

    const res = await makeApp('user_host').fetch(
      new Request('http://local/sessions/sess_1/energizers/eg_qf', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: 'active' }),
      }),
      makeEnv(db, namespace),
    )
    expect(res.status).toBe(200)
    expect(calls.filter((c) => c.path === '/energizer-sync')).toHaveLength(0)
  })

  it('POST /next posts an advance sync with the new index and completion flag', async () => {
    const db = new D1Mock()
    seedSession(db, 'energizing')
    seedTeamQuiz(db, 0)
    const { namespace, calls } = makeSessionRoomFake()
    const env = makeEnv(db, namespace)
    const app = makeApp('user_host')

    const next = () =>
      app.fetch(
        new Request('http://local/sessions/sess_1/energizers/eg_tq/next', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        }),
        env,
      )

    const first = await next()
    expect(first.status).toBe(200)
    expect(calls.find((c) => c.path === '/energizer-sync')?.body).toMatchObject({
      action: 'advance',
      energizerId: 'eg_tq',
      currentIndex: 1,
      completed: false,
    })

    const second = await next()
    expect(second.status).toBe(200)
    expect(calls.filter((c) => c.path === '/energizer-sync').at(-1)?.body).toMatchObject({
      action: 'advance',
      currentIndex: 2,
      completed: true,
    })
  })

  it('a DO sync failure never fails the host action', async () => {
    const db = new D1Mock()
    seedSession(db, 'energizing')
    seedQuickFinger(db, 'draft')
    const failingNamespace = {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async () => {
          throw new Error('DO unreachable')
        },
      }),
    }

    const res = await makeApp('user_host').fetch(
      new Request('http://local/sessions/sess_1/energizers/eg_qf', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: 'active' }),
      }),
      makeEnv(db, failingNamespace),
    )
    expect(res.status).toBe(200)
    expect(db.energizers.get('eg_qf')?.state).toBe('active')
  })
})
