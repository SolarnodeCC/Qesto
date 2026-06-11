// AI-GATEWAY-01 (ADR-042 Phase 1.1) — env-driven gateway wiring.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __internal,
  runThroughAIGateway,
  type AIGatewayRequest,
} from '../../functions/api/lib/ai/ai-gateway'
import { PromptSanitizationError } from '../../functions/api/lib/ai/prompt-sanitize'
import type { Env } from '../../functions/api/types'
import type { SessionAIContext } from '../../functions/api/lib/ai/session-context'

const CTX: SessionAIContext = {
  sessionId: 'sess-1',
  teamId: null,
  plan: 'team',
  anonymity: 'full',
  locale: 'en',
  model: '@cf/mistral/mistral-7b-instruct-v0.2',
  promptVersion: 'v1',
}

const INPUT: AIGatewayRequest = {
  model: '@cf/mistral/mistral-7b-instruct-v0.2',
  messages: [{ role: 'user', content: 'hello' }],
}

function mockEnv(overrides: Partial<Env> = {}, aiResult: unknown = { response: 'direct' }): Env {
  return {
    AI: { run: vi.fn(async () => aiResult) },
    ...overrides,
  } as unknown as Env
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('resolveGatewayConfig', () => {
  it('returns null gateway id/token when secrets are unset', () => {
    const config = __internal.resolveGatewayConfig(mockEnv())
    expect(config.gatewayId).toBeNull()
    expect(config.token).toBeNull()
    expect(config.accountId).toBe(__internal.DEFAULT_ACCOUNT_ID)
  })

  it('reads gateway id, token and account override from env', () => {
    const config = __internal.resolveGatewayConfig(
      mockEnv({
        CLOUDFLARE_AI_GATEWAY_ID: 'gw-123',
        CLOUDFLARE_AI_GATEWAY_TOKEN: 'tok-abc',
        CLOUDFLARE_ACCOUNT_ID: 'acct-override',
      }),
    )
    expect(config).toEqual({ gatewayId: 'gw-123', token: 'tok-abc', accountId: 'acct-override' })
  })
})

describe('buildGatewayUrl / buildGatewayHeaders', () => {
  it('builds the canonical gateway URL preserving model path segments', () => {
    const url = __internal.buildGatewayUrl(
      { gatewayId: 'gw-123', token: 'tok', accountId: 'acct-1' },
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    )
    expect(url).toBe(
      'https://gateway.ai.cloudflare.com/v1/acct-1/gw-123/workers-ai/%40cf/meta/llama-3.3-70b-instruct-fp8-fast',
    )
  })

  it('adds the bearer token header when a token is configured', () => {
    const headers = __internal.buildGatewayHeaders(
      { gatewayId: 'gw-123', token: 'tok-abc', accountId: 'acct-1' },
      'team',
    )
    expect(headers['Authorization']).toBe('Bearer tok-abc')
    expect(headers['X-Qesto-Plan']).toBe('team')
  })
})

describe('runThroughAIGateway', () => {
  it('bypasses to direct env.AI.run when secrets are unset', async () => {
    const env = mockEnv()
    const res = await runThroughAIGateway(env, CTX, CTX.model, INPUT)
    expect(res.cached).toBe(false)
    expect(res.result).toEqual({ response: 'direct' })
    expect(env.AI.run).toHaveBeenCalledTimes(1)
  })

  it('bypasses when only the gateway id is set (token missing)', async () => {
    const env = mockEnv({ CLOUDFLARE_AI_GATEWAY_ID: 'gw-123' })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await runThroughAIGateway(env, CTX, CTX.model, INPUT)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(env.AI.run).toHaveBeenCalledTimes(1)
  })

  it('routes through the gateway and reports cache hits when configured', async () => {
    const env = mockEnv({
      CLOUDFLARE_AI_GATEWAY_ID: 'gw-123',
      CLOUDFLARE_AI_GATEWAY_TOKEN: 'tok-abc',
    })
    const fetchSpy = vi.fn(async (url: string, init: RequestInit) => {
      expect(String(url)).toContain('gateway.ai.cloudflare.com/v1/')
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-abc')
      return new Response(
        JSON.stringify({ result: { response: 'from-gateway' }, cached: true, cache_age: 42 }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await runThroughAIGateway(env, CTX, CTX.model, INPUT)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(res.cached).toBe(true)
    expect(res.cacheAge).toBe(42)
    expect(res.result).toEqual({ response: 'from-gateway' })
    expect(env.AI.run).not.toHaveBeenCalled()
  })

  it('falls back to direct env.AI.run on gateway 5xx', async () => {
    const env = mockEnv({
      CLOUDFLARE_AI_GATEWAY_ID: 'gw-123',
      CLOUDFLARE_AI_GATEWAY_TOKEN: 'tok-abc',
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream down', { status: 503 })))

    const res = await runThroughAIGateway(env, CTX, CTX.model, INPUT)
    expect(res.cached).toBe(false)
    expect(res.result).toEqual({ response: 'direct' })
    expect(env.AI.run).toHaveBeenCalledTimes(1)
  })

  it('still rejects requests with no usable content after sanitization', async () => {
    const env = mockEnv()
    await expect(
      runThroughAIGateway(env, CTX, CTX.model, {
        model: CTX.model,
        messages: [{ role: 'user', content: String.fromCharCode(0x200b) + ' ' }],
      }),
    ).rejects.toThrow(PromptSanitizationError)
  })
})
