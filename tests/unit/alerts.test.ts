/**
 * Requirement: ADR-0030 (SLOs & error budgets) — alert threshold detection + paging.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkAlert,
  criticalAlert,
  dispatchAlert,
  alertFingerprint,
  parseSentryDsn,
  parseGitHubAlertRepo,
  ALERT_THRESHOLDS,
  GITHUB_ALERT_LABEL,
} from '../../functions/api/lib/alerts'

describe('Alerts — Threshold Detection', () => {
  it('fires alert when p95 > 500ms', () => {
    const result = checkAlert('GET /api/sessions', 501, 0.02)
    expect(result.fired).toBe(true)
    expect(result.message).toContain('501ms')
  })

  it('does not fire alert when p95 = 500ms', () => {
    const result = checkAlert('GET /api/sessions', 500, 0.02)
    expect(result.fired).toBe(false)
  })

  it('fires alert when error_rate > 5%', () => {
    const result = checkAlert('POST /api/votes', 200, 0.051)
    expect(result.fired).toBe(true)
    expect(result.message).toContain('5.1%')
  })

  it('does not fire alert when error_rate = 5%', () => {
    const result = checkAlert('POST /api/votes', 200, 0.05)
    expect(result.fired).toBe(false)
  })

  it('fires alert for DO crash', () => {
    const result = checkAlert('SessionRoom', 100, 0.02, { do_crash: true })
    expect(result.fired).toBe(true)
    expect(result.message).toContain('crash')
  })

  it('includes request count in message when provided', () => {
    const result = checkAlert('GET /api/sessions', 600, 0.1, { request_count: 1234 })
    expect(result.message).toContain('1234')
  })

  it('escalates to critical when multiple failures', () => {
    const result = checkAlert('POST /api/votes', 600, 0.1)
    expect(result.severity).toBe('critical')
  })

  it('uses warn severity for single threshold breach', () => {
    const result = checkAlert('GET /api/sessions', 501, 0.02)
    expect(result.severity).toBe('warn')
  })
})

describe('alertFingerprint', () => {
  it('collapses ULIDs so the same route shares a bucket', () => {
    const a = alertFingerprint('/api/sessions/01HABCDEFGHJKMNPQRSTVWXYZ/close', 'TypeError')
    const b = alertFingerprint('/api/sessions/01HZZZZZZZZZZZZZZZZZZZZZZZ/close', 'TypeError')
    expect(a).toBe(b)
    expect(a).toContain('/:id')
  })

  it('differs by error class', () => {
    expect(alertFingerprint('/api/x', 'A')).not.toBe(alertFingerprint('/api/x', 'B'))
  })
})

describe('parseSentryDsn / parseGitHubAlertRepo', () => {
  it('parses a valid Sentry DSN', () => {
    expect(parseSentryDsn('https://abc123@o1.ingest.sentry.io/456')).toEqual({
      publicKey: 'abc123',
      host: 'o1.ingest.sentry.io',
      projectId: '456',
    })
  })

  it('rejects bad Sentry DSN', () => {
    expect(parseSentryDsn('not-a-url')).toBeNull()
  })

  it('parses owner/repo', () => {
    expect(parseGitHubAlertRepo('SolarnodeCC/Qesto')).toEqual({
      owner: 'SolarnodeCC',
      repo: 'Qesto',
    })
  })

  it('rejects invalid repo strings', () => {
    expect(parseGitHubAlertRepo('Qesto')).toBeNull()
    expect(parseGitHubAlertRepo(undefined)).toBeNull()
  })
})

describe('dispatchAlert channels', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ number: 42 }), { status: 201 })),
    )
  })

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch)
  })

  it('is a no-op for network channels when secrets are unset', async () => {
    const result = await dispatchAlert({}, criticalAlert('/api/x', 'Boom'), {
      traceId: 't1',
      route: '/api/x',
      errorClass: 'Boom',
    })
    expect(result).toEqual({ webhook: false, sentry: false, github: false })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('posts to ALERT_WEBHOOK_URL for critical alerts', async () => {
    const result = await dispatchAlert(
      { ALERT_WEBHOOK_URL: 'https://hooks.example/alert', ENV: 'dev' },
      criticalAlert('/api/x', 'Boom'),
      { traceId: 't1', route: '/api/x', errorClass: 'Boom' },
    )
    expect(result.webhook).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalled()
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://hooks.example/alert')
    expect((init as RequestInit).method).toBe('POST')
  })

  it('does not page network channels for warn severity', async () => {
    const warn = checkAlert('/api/x', 501, 0.01)
    expect(warn.severity).toBe('warn')
    const result = await dispatchAlert(
      { ALERT_WEBHOOK_URL: 'https://hooks.example/alert' },
      warn,
      { route: '/api/x' },
    )
    expect(result).toEqual({ webhook: false, sentry: false, github: false })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('creates a GitHub issue with auto-alert label when token+repo set', async () => {
    const kvStore = new Map<string, string>()
    const kv = {
      get: async (key: string) => kvStore.get(key) ?? null,
      put: async (key: string, value: string) => {
        kvStore.set(key, value)
      },
      delete: async (key: string) => {
        kvStore.delete(key)
      },
    } as unknown as KVNamespace

    const result = await dispatchAlert(
      {
        GITHUB_ALERT_TOKEN: 'ghs_test_token_not_real',
        GITHUB_ALERT_REPO: 'SolarnodeCC/Qesto',
        ACTIONS_KV: kv,
        ENV: 'dev',
      },
      criticalAlert('/api/sessions/:id/close', 'TypeError'),
      { traceId: 't-gh', route: '/api/sessions/:id/close', errorClass: 'TypeError' },
    )
    expect(result.github).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalled()
    const createCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).endsWith('/issues'),
    )
    expect(createCall).toBeTruthy()
    const body = JSON.parse((createCall![1] as RequestInit).body as string)
    expect(body.labels).toContain(GITHUB_ALERT_LABEL)
    expect(body.body).not.toMatch(/@/)
    expect(body.body).toContain('trace_id')
    expect(body.title).toContain('auto-alert')
  })

  it('comments on an existing fingerprint issue instead of creating a duplicate', async () => {
    const fp = alertFingerprint('/api/x', 'Boom')
    const past = Date.now() - (ALERT_THRESHOLDS.githubMinCommentIntervalSec + 10) * 1000
    const kvStore = new Map<string, string>([
      [`alert:gh:fp:${fp}`, JSON.stringify({ issueNumber: 99, count: 2, lastCommentAt: past })],
    ])
    const kv = {
      get: async (key: string) => kvStore.get(key) ?? null,
      put: async (key: string, value: string) => {
        kvStore.set(key, value)
      },
      delete: async (key: string) => {
        kvStore.delete(key)
      },
    } as unknown as KVNamespace

    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (String(url).endsWith('/issues/99')) {
        return new Response(JSON.stringify({ state: 'open', number: 99 }), { status: 200 })
      }
      if (String(url).endsWith('/issues/99/comments')) {
        return new Response(JSON.stringify({ id: 1 }), { status: 201 })
      }
      return new Response('unexpected', { status: 500 })
    })

    const result = await dispatchAlert(
      {
        GITHUB_ALERT_TOKEN: 'ghs_test',
        GITHUB_ALERT_REPO: 'SolarnodeCC/Qesto',
        ACTIONS_KV: kv,
        ENV: 'dev',
      },
      criticalAlert('/api/x', 'Boom'),
      { traceId: 't2', route: '/api/x', errorClass: 'Boom' },
    )
    expect(result.github).toBe(true)
    const urls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.endsWith('/issues/99/comments'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/repos/SolarnodeCC/Qesto/issues') && !u.includes('/99'))).toBe(false)
  })
})
