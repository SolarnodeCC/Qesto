import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthVariables } from '../../functions/api/middleware/auth'
import type { PlanVariables } from '../../functions/api/middleware/plan'
import { registerCoachingRoute } from '../../functions/api/routes/ai-insights/register-coaching'
import { PLAN_QUOTAS, type Env } from '../../functions/api/types'
import { generateFacilitatorCoaching } from '../../functions/api/lib/ai/coaching'
import { queryDecisionGrounding } from '../../functions/api/lib/agent-grounding'
import { sendEmail } from '../../functions/api/lib/email'
import { KVMock } from '../helpers/kv-mock'

vi.mock('../../functions/api/lib/ai/coaching', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../functions/api/lib/ai/coaching')>()
  return {
    ...actual,
    generateFacilitatorCoaching: vi.fn(),
  }
})

vi.mock('../../functions/api/lib/agent-grounding', () => ({
  queryDecisionGrounding: vi.fn(),
}))

vi.mock('../../functions/api/lib/email', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('../../functions/api/lib/observability', () => ({
  writeEvent: vi.fn(),
}))

type Vars = AuthVariables & PlanVariables

type CoachingSession = {
  id: string
  title: string
  owner_id: string
  team_id: string | null
  anonymity: 'full' | 'partial' | 'none' | 'zero_knowledge'
}

type MockQuestion = {
  id: string
  session_id: string
  position: number
  kind: 'poll' | 'open'
  prompt: string
  options_json: string
  created_at: number
}

function makeDb({
  session = {
    id: 'sess_1',
    title: 'Coaching retro',
    owner_id: 'user_host',
    team_id: 'team_1',
    anonymity: 'full',
  },
  voteCount = 0,
  questions = [
    {
      id: 'q_1',
      session_id: 'sess_1',
      position: 0,
      kind: 'open',
      prompt: 'What should we improve?',
      options_json: '[]',
      created_at: 1,
    },
  ],
}: {
  session?: CoachingSession
  voteCount?: number
  questions?: MockQuestion[]
} = {}): D1Database {
  return {
    prepare(sql: string) {
      let args: unknown[] = []
      return {
        bind(...next: unknown[]) {
          args = next
          return this
        },
        async first<T>() {
          if (sql.includes('FROM sessions WHERE id = ?1 AND owner_id = ?2')) {
            const [sessionId, ownerId] = args
            return (session.id === sessionId && session.owner_id === ownerId ? session : null) as T | null
          }
          if (sql.includes('COUNT(*)') && sql.includes('FROM votes WHERE session_id = ?1')) {
            return { n: voteCount } as T
          }
          throw new Error(`Unexpected D1 first() query: ${sql}`)
        },
        async all<T>() {
          if (sql.includes('FROM questions') && sql.includes('WHERE session_id = ?1')) {
            const [sessionId] = args
            const results = questions
              .filter((question) => question.session_id === sessionId)
              .sort((a, b) => a.position - b.position)
            return { results: results as T[] }
          }
          throw new Error(`Unexpected D1 all() query: ${sql}`)
        },
      }
    },
  } as unknown as D1Database
}

function makeApp() {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', async (c, next) => {
    c.set('trace_id', 'trace-test')
    c.set('user', {
      sub: 'user_host',
      email: 'host@example.com',
      iat: 1,
      exp: 2,
    })
    c.set('session_token', 'test-session-token')
    c.set('plan', 'team')
    c.set('planQuotas', PLAN_QUOTAS.team)
    await next()
  })
  registerCoachingRoute(app)
  return app
}

function makeEnv({
  db = makeDb(),
  actionsKv = new KVMock(),
  sessionsKv = new KVMock(),
  usersKv = new KVMock(),
}: {
  db?: D1Database
  actionsKv?: KVMock
  sessionsKv?: KVMock
  usersKv?: KVMock
} = {}): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    RESEND_API_KEY: 'resend-test-key',
    DB: db,
    ACTIONS_KV: actionsKv as unknown as KVNamespace,
    SESSIONS_KV: sessionsKv as unknown as KVNamespace,
    USERS_KV: usersKv as unknown as KVNamespace,
  } as unknown as Env
}

async function seedRateLimit(kv: KVMock, prefix: string, count: number) {
  await kv.put(
    `rl:${prefix}:user_host`,
    JSON.stringify({ count, resetAt: Date.now() + 60_000 }),
    { expirationTtl: 60 },
  )
}

describe('coaching routes audit controls', () => {
  beforeEach(() => {
    vi.mocked(generateFacilitatorCoaching).mockResolvedValue({
      headline: 'Try a clearer next step',
      bullets: ['Ask one owner to summarize the action.'],
      model: 'test-model',
    })
    vi.mocked(queryDecisionGrounding).mockResolvedValue([])
    vi.mocked(sendEmail).mockResolvedValue({ delivered: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects coaching generation after the hourly AI limit before RAG or model work starts', async () => {
    const actionsKv = new KVMock()
    await seedRateLimit(actionsKv, 'ai-coaching', 10)

    const res = await makeApp().fetch(
      new Request('http://local/sessions/sess_1/coaching', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      makeEnv({ actionsKv }),
    )

    expect(res.status).toBe(429)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('rate_limited')
    expect(queryDecisionGrounding).not.toHaveBeenCalled()
    expect(generateFacilitatorCoaching).not.toHaveBeenCalled()
  })

  it('escapes session title and coaching turns before sending the HTML email export', async () => {
    const sessionsKv = new KVMock()
    await sessionsKv.put(
      'coaching:history:sess_1',
      JSON.stringify([
        {
          role: 'assistant',
          content: 'Great\n<img src=x onerror=alert(1)> "quoted" & done',
          at: 1,
        },
      ]),
    )
    const db = makeDb({
      session: {
        id: 'sess_1',
        title: 'Retro <script>alert("x")</script> & cleanup',
        owner_id: 'user_host',
        team_id: 'team_1',
        anonymity: 'full',
      },
      voteCount: 3,
    })

    const res = await makeApp().fetch(
      new Request('http://local/sessions/sess_1/coaching/email-export', {
        method: 'POST',
      }),
      makeEnv({ db, sessionsKv }),
    )

    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledOnce()
    const [, email] = vi.mocked(sendEmail).mock.calls[0]
    expect(email.html).toContain(
      '<strong>Retro &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; cleanup</strong>',
    )
    expect(email.html).toContain(
      'Great<br>&lt;img src=x onerror=alert(1)&gt; &quot;quoted&quot; &amp; done',
    )
    expect(email.html).not.toContain('<script')
    expect(email.html).not.toContain('<img')
  })

  it('rejects email exports after the daily send limit without calling Resend', async () => {
    const actionsKv = new KVMock()
    await seedRateLimit(actionsKv, 'ai-coaching-email', 5)

    const res = await makeApp().fetch(
      new Request('http://local/sessions/sess_1/coaching/email-export', {
        method: 'POST',
      }),
      makeEnv({ actionsKv }),
    )

    expect(res.status).toBe(429)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('rate_limited')
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
