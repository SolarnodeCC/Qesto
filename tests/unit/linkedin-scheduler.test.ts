import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runScheduled, type SchedulerEnv } from '../../workers/linkedin-scheduler/index'
import { createEncryptedTokenStore } from '../../functions/api/lib/integrations/token-store'
import {
  clampPost,
  buildPostPrompt,
  MAX_POST_LENGTH,
  LINKEDIN_TEAM_SCOPE,
  LINKEDIN_SERVICE,
  KV_ORG_URN,
  KV_TOPIC_INDEX,
} from '../../functions/api/lib/linkedin'

const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const UGC_URL = 'https://api.linkedin.com/v2/ugcPosts'

interface Harness {
  env: SchedulerEnv
  kv: Map<string, string>
  inserts: Array<{ id: string; content: string; posted_at: number; status: string }>
}

function makeHarness(overrides: Partial<SchedulerEnv> = {}): Harness {
  const kv = new Map<string, string>()
  const kvNs = {
    get: async (k: string) => kv.get(k) ?? null,
    put: async (k: string, v: string) => {
      kv.set(k, v)
    },
    delete: async (k: string) => {
      kv.delete(k)
    },
  } as unknown as KVNamespace

  const inserts: Harness['inserts'] = []
  const DB = {
    prepare: (_sql: string) => ({
      bind: (id: string, content: string, posted_at: number, status: string) => ({
        run: async () => {
          inserts.push({ id, content, posted_at, status })
        },
      }),
    }),
  } as unknown as D1Database

  const AI = {
    run: vi.fn().mockResolvedValue({ response: 'Boost team engagement with live Qesto polls. #teams' }),
  } as unknown as Ai

  const env: SchedulerEnv = {
    ENV: 'dev',
    AI,
    DB,
    LINKEDIN_KV: kvNs,
    OAUTH_TOKEN_MEK: 'test-mek-linkedin',
    LINKEDIN_CLIENT_ID: 'cid',
    LINKEDIN_CLIENT_SECRET: 'sec',
    ...overrides,
  }
  return { env, kv, inserts }
}

async function seedToken(env: SchedulerEnv, opts: { expires_in?: number; refresh_token?: string } = {}) {
  const store = createEncryptedTokenStore(env.LINKEDIN_KV, env)
  await store.storeToken(LINKEDIN_TEAM_SCOPE, LINKEDIN_SERVICE, {
    access_token: 'access-1',
    refresh_token: opts.refresh_token ?? 'refresh-1',
    expires_in: opts.expires_in ?? 60 * 24 * 3600, // ~60 days, well outside refresh window
  })
}

let ugcStatus = 201
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  ugcStatus = 201
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const u = String(input)
    if (u.startsWith(TOKEN_URL)) {
      return new Response(
        JSON.stringify({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 5184000 }),
        { status: 200 },
      )
    }
    if (u.startsWith(UGC_URL)) return new Response('{}', { status: ugcStatus })
    return new Response('nope', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('clampPost', () => {
  it('leaves short posts untouched and trims long ones to <= MAX_POST_LENGTH', () => {
    expect(clampPost('  hello  ')).toBe('hello')
    const long = 'word '.repeat(400) // 2000 chars
    const out = clampPost(long)
    expect(out.length).toBeLessThanOrEqual(MAX_POST_LENGTH)
  })
})

describe('buildPostPrompt', () => {
  it('defaults to English and maps language codes', () => {
    expect(buildPostPrompt('remote meetings', 'en').system).toContain('English')
    expect(buildPostPrompt('remote meetings', 'nl').system).toContain('Dutch')
    expect(buildPostPrompt('quiz tools for HR', 'en').user).toContain('quiz tools for HR')
  })
})

describe('runScheduled', () => {
  it('publishes and advances the topic index on success', async () => {
    const h = makeHarness()
    await seedToken(h.env)
    await h.env.LINKEDIN_KV.put(KV_ORG_URN, 'urn:li:organization:123')

    await runScheduled(h.env)

    const ugcCalls = fetchMock.mock.calls.filter((c) => String(c[0]).startsWith(UGC_URL))
    expect(ugcCalls).toHaveLength(1)
    expect(h.inserts).toHaveLength(1)
    expect(h.inserts[0]!.status).toBe('posted')
    expect(h.inserts[0]!.content.length).toBeLessThanOrEqual(MAX_POST_LENGTH)
    // index advanced 0 -> 1
    expect(h.kv.get(KV_TOPIC_INDEX)).toBe('1')
  })

  it('logs an error and does NOT retry or advance on non-2xx', async () => {
    ugcStatus = 500
    const h = makeHarness()
    await seedToken(h.env)
    await h.env.LINKEDIN_KV.put(KV_ORG_URN, 'urn:li:organization:123')

    await runScheduled(h.env)

    const ugcCalls = fetchMock.mock.calls.filter((c) => String(c[0]).startsWith(UGC_URL))
    expect(ugcCalls).toHaveLength(1) // single attempt, no retry
    expect(h.inserts).toHaveLength(1)
    expect(h.inserts[0]!.status).toBe('error')
    expect(h.inserts[0]!.content).toContain('HTTP 500')
    expect(h.kv.get(KV_TOPIC_INDEX)).toBeUndefined() // not advanced
  })

  it('refreshes the access token when near expiry, then posts with the new token', async () => {
    const h = makeHarness()
    await seedToken(h.env, { expires_in: 100 }) // expires_at within the 7-day window
    await h.env.LINKEDIN_KV.put(KV_ORG_URN, 'urn:li:organization:123')

    await runScheduled(h.env)

    const tokenCalls = fetchMock.mock.calls.filter((c) => String(c[0]).startsWith(TOKEN_URL))
    expect(tokenCalls).toHaveLength(1) // refresh happened
    const ugcCall = fetchMock.mock.calls.find((c) => String(c[0]).startsWith(UGC_URL))!
    const authHeader = (ugcCall[1] as RequestInit).headers as Record<string, string>
    expect(authHeader.Authorization).toBe('Bearer access-2') // refreshed token used
    expect(h.inserts[0]!.status).toBe('posted')
  })

  it('logs an error when not connected (no token)', async () => {
    const h = makeHarness()
    await h.env.LINKEDIN_KV.put(KV_ORG_URN, 'urn:li:organization:123')

    await runScheduled(h.env)

    // No token → returns early without posting and without a D1 row.
    expect(h.inserts).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logs an error when org URN is missing', async () => {
    const h = makeHarness()
    await seedToken(h.env)

    await runScheduled(h.env)

    expect(h.inserts).toHaveLength(1)
    expect(h.inserts[0]!.status).toBe('error')
    expect(h.inserts[0]!.content).toContain('org_urn')
  })
})
