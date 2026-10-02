/**
 * Logging helpers (#940) + integration policy gates (#942).
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  safeLogContext,
  logBestEffort,
  logExternalFailure,
  ignoreSchemaPatchError,
  detectPII,
} from '../../functions/api/lib/log'
import {
  stripePaymentsEnabled,
  redditIntegrationEnabled,
  youtubeIntegrationEnabled,
} from '../../functions/api/lib/integrations-policy'

describe('safeLogContext / helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits JSON error with route, traceId, sessionId, details, sanitized stack', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('boom user@example.com')
    err.stack = 'Error: boom user@example.com\n    at test'
    safeLogContext(err, {
      traceId: 't1',
      route: '/api/sessions/x',
      errorClass: 'TestError',
      sessionId: 'sess_1',
      teamId: 'team_1',
      operation: 'd1.query',
      details: { attempt: 2, secretish: 'sk_live_abcdefghijklmnopqrstuvwxyz' },
    })
    expect(errSpy).toHaveBeenCalledTimes(1)
    const line = JSON.parse(String(errSpy.mock.calls[0]![0]))
    expect(line.level).toBe('error')
    expect(line.traceId).toBe('t1')
    expect(line.route).toBe('/api/sessions/x')
    expect(line.sessionId).toBe('sess_1')
    expect(line.teamId).toBe('team_1')
    expect(line.operation).toBe('d1.query')
    expect(line.errorMessage).not.toContain('@')
    expect(line.details.secretish).toContain('[REDACTED]')
    expect(line.stack).toBeTruthy()
  })

  it('logBestEffort uses warn + bestEffort flag', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logBestEffort(new Error('kv miss'), {
      traceId: 't2',
      route: 'kv.cleanup',
      errorClass: 'KvBestEffortError',
      reason: 'cleanup_non_blocking',
    })
    const line = JSON.parse(String(warnSpy.mock.calls[0]![0]))
    expect(line.level).toBe('warn')
    expect(line.details.bestEffort).toBe(true)
    expect(line.details.reason).toBe('cleanup_non_blocking')
  })

  it('logExternalFailure records provider/status/attempt', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logExternalFailure(new Error('upstream'), {
      traceId: 't3',
      route: 'webhooks.deliver',
      errorClass: 'WebhookError',
      provider: 'outbound_webhook',
      httpStatus: 502,
      attempt: 3,
      retrying: false,
      duration: 42,
      outcome: 'exhausted',
    })
    const line = JSON.parse(String(warnSpy.mock.calls[0]![0]))
    expect(line.details.provider).toBe('outbound_webhook')
    expect(line.details.httpStatus).toBe(502)
    expect(line.details.attempt).toBe(3)
    expect(line.duration).toBe(42)
  })

  it('ignoreSchemaPatchError stays silent for duplicate column', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ignoreSchemaPatchError(new Error('duplicate column name: team_id'), 'sessions.patch')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('detectPII still flags emails', () => {
    expect(detectPII('hello a@b.co')).toContain('email')
  })
})

describe('integrations-policy (#942)', () => {
  it('defaults Stripe/Reddit/YouTube off', () => {
    expect(stripePaymentsEnabled({})).toBe(false)
    expect(redditIntegrationEnabled({})).toBe(false)
    expect(youtubeIntegrationEnabled({})).toBe(false)
  })

  it('opts in when env is true', () => {
    expect(stripePaymentsEnabled({ STRIPE_PAYMENTS_ENABLED: 'true' })).toBe(true)
    expect(redditIntegrationEnabled({ REDDIT_INTEGRATION_ENABLED: 'true' })).toBe(true)
    expect(youtubeIntegrationEnabled({ YOUTUBE_INTEGRATION_ENABLED: 'true' })).toBe(true)
  })

  it('treats any non-true value as disabled', () => {
    expect(stripePaymentsEnabled({ STRIPE_PAYMENTS_ENABLED: 'false' })).toBe(false)
    expect(stripePaymentsEnabled({ STRIPE_PAYMENTS_ENABLED: '1' })).toBe(false)
  })
})
