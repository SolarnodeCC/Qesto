// Regression coverage for issue #686 (HLT-031): boundary casts on external /
// cross-worker JSON replaced with zod validation. These exercise the DO ingress
// routes end-to-end (400 on malformed, 200 on valid) plus the AI Gateway
// response schema, so a future bare `JSON.parse(...) as T` regression is caught.
import { describe, expect, it } from 'vitest'
import { testJwtSecret } from '../helpers/test-credentials'
import { SessionRoom } from '../../functions/api/SessionRoom'
import type { Env } from '../../functions/api/types'
import { MockDurableObjectState } from '../helpers/do-mock'
import { D1Mock } from '../helpers/d1-mock'
import {
  CaptionBroadcastPayloadSchema,
} from '../../functions/api/lib/session-room-captions-handler'
import { AIGatewayRawResponseSchema } from '../../functions/api/lib/ai/ai-gateway'
import { parsePayloadQuestionCount } from '../../functions/api/lib/pulse-aggregation'
import { verifyEmbedToken } from '../../functions/api/lib/embed-token'
import { verifyFederationInvite } from '../../functions/api/lib/connect-invite'
import { hmacSign, base64UrlEncode } from '../../functions/api/lib/shared/crypto'
import { VideoGenJobSchema } from '../../functions/api/lib/marketing/video-gen'

function makeEnv(): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: testJwtSecret(),
    LIVE_ENERGIZERS_ENABLED: 'false',
    DB: new D1Mock() as unknown as D1Database,
  } as unknown as Env
}

function buildRoom(): SessionRoom {
  const state = new MockDurableObjectState()
  return new SessionRoom(state as unknown as DurableObjectState, makeEnv())
}

function post(path: string, body: unknown): Request {
  return new Request(`https://do.internal${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('DO /captions/broadcast validates its payload (#686)', () => {
  const valid = {
    id: 'c1',
    ts: 1234,
    isFinal: true,
    sourceLocale: 'en',
    sourceText: 'hello',
    variants: { nl: 'hallo' },
  }

  it('accepts a well-formed caption payload', async () => {
    const res = await buildRoom().fetch(post('/captions/broadcast', valid))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects an unknown source locale with 400', async () => {
    const res = await buildRoom().fetch(post('/captions/broadcast', { ...valid, sourceLocale: 'xx' }))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error.code).toBe('invalid_payload')
  })

  it('rejects a missing required field with 400', async () => {
    const { sourceText: _omit, ...missing } = valid
    const res = await buildRoom().fetch(post('/captions/broadcast', missing))
    expect(res.status).toBe(400)
  })

  it('rejects a non-string variant value with 400', async () => {
    const res = await buildRoom().fetch(
      post('/captions/broadcast', { ...valid, variants: { nl: 42 } }),
    )
    expect(res.status).toBe(400)
  })
})

describe('DO /copilot/checkpoint validates its payload (#686)', () => {
  it('accepts a well-formed checkpoint payload', async () => {
    const res = await buildRoom().fetch(
      post('/copilot/checkpoint', { stepId: 's1', tool: 'cluster', summary: 'Top theme: x' }),
    )
    expect(res.status).toBe(200)
    expect((await res.json() as any).ok).toBe(true)
  })

  it('rejects a checkpoint missing summary with 400', async () => {
    const res = await buildRoom().fetch(
      post('/copilot/checkpoint', { stepId: 's1', tool: 'cluster' }),
    )
    expect(res.status).toBe(400)
    expect((await res.json() as any).error.code).toBe('invalid_payload')
  })
})

describe('caption schema partial-variant semantics (#686)', () => {
  it('allows a subset of locales in variants', () => {
    const r = CaptionBroadcastPayloadSchema.safeParse({
      id: 'c1', ts: 1, isFinal: false, sourceLocale: 'en', sourceText: 't', variants: {},
    })
    expect(r.success).toBe(true)
  })
})

describe('AI Gateway response schema (#686)', () => {
  it('accepts the documented gateway shape and an empty body', () => {
    expect(AIGatewayRawResponseSchema.safeParse({ result: { a: 1 }, cached: true, cache_age: 5 }).success).toBe(true)
    expect(AIGatewayRawResponseSchema.safeParse({}).success).toBe(true)
  })

  it('rejects wrong-typed cache fields (would fall back to direct AI)', () => {
    expect(AIGatewayRawResponseSchema.safeParse({ cached: 'yes' }).success).toBe(false)
    expect(AIGatewayRawResponseSchema.safeParse({ cache_age: '5' }).success).toBe(false)
  })
})

// Craft a correctly-signed token over arbitrary (possibly malformed) claims, so
// we can prove signature verification passes yet claim-shape validation rejects.
async function signRawToken(secret: string, claims: unknown): Promise<string> {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims)))
  const mac = await hmacSign(secret, payload)
  return `${payload}.${mac}`
}

describe('embed token validates claim shape after signature check (#686)', () => {
  const SECRET = 'embed-widget-secret-at-least-32-bytes!!'
  const now = Math.floor(Date.now() / 1000)
  const valid = {
    v: 1, wid: 'w', sid: 's', code: 'C', tid: 't',
    ao: ['https://x.example.com'], scp: 'read', iat: now, exp: now + 3600,
  }

  it('accepts a correctly-signed valid payload', async () => {
    const res = await verifyEmbedToken(SECRET, await signRawToken(SECRET, valid))
    expect(res.ok).toBe(true)
  })

  it('rejects a signed payload with a wrong-typed field as malformed', async () => {
    const res = await verifyEmbedToken(SECRET, await signRawToken(SECRET, { ...valid, exp: 'later' }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('malformed')
  })

  it('rejects a signed payload missing a required field as malformed', async () => {
    const { wid: _drop, ...missing } = valid
    const res = await verifyEmbedToken(SECRET, await signRawToken(SECRET, missing))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('malformed')
  })

  it('still distinguishes wrong_version from malformed', async () => {
    const res = await verifyEmbedToken(SECRET, await signRawToken(SECRET, { ...valid, v: 2 }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('wrong_version')
  })
})

describe('federation invite validates claim shape after signature check (#686)', () => {
  const SECRET = 'test-connect-invite-secret'
  const now = Math.floor(Date.now() / 1000)
  const valid = {
    v: 1, jti: 'j', sid: 's', host: 'team_h', invitee: null,
    scope: 'participate', iat: now, exp: now + 3600,
  }

  it('accepts a correctly-signed valid payload', async () => {
    const res = await verifyFederationInvite(SECRET, await signRawToken(SECRET, valid))
    expect(res.ok).toBe(true)
  })

  it('rejects a signed payload with a wrong-typed field as malformed', async () => {
    const res = await verifyFederationInvite(SECRET, await signRawToken(SECRET, { ...valid, sid: 42 }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('malformed')
  })

  it('still distinguishes bad_scope from malformed', async () => {
    const res = await verifyFederationInvite(SECRET, await signRawToken(SECRET, { ...valid, scope: 'admin' }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('bad_scope')
  })
})

describe('marketing VideoGenJob schema validates KV job blobs (#686)', () => {
  const valid = {
    jobId: 'j1', model: 'm', prompt: 'p', title: 't', tags: ['a'],
    requestId: 'r', status: 'running', createdAt: 1, updatedAt: 2,
  }

  it('accepts a well-formed job', () => {
    expect(VideoGenJobSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects an unknown status and a missing required field', () => {
    expect(VideoGenJobSchema.safeParse({ ...valid, status: 'paused' }).success).toBe(false)
    const { requestId: _drop, ...missing } = valid
    expect(VideoGenJobSchema.safeParse(missing).success).toBe(false)
  })
})

describe('pulse parsePayloadQuestionCount tolerates malformed input (#686)', () => {
  it('reads a valid questionCount', () => {
    expect(parsePayloadQuestionCount(JSON.stringify({ questionCount: 7 }))).toBe(7)
  })

  it('returns 0 for malformed JSON, wrong types, or missing field', () => {
    expect(parsePayloadQuestionCount('not json')).toBe(0)
    expect(parsePayloadQuestionCount(JSON.stringify({ questionCount: 'x' }))).toBe(0)
    expect(parsePayloadQuestionCount(JSON.stringify({}))).toBe(0)
  })
})
