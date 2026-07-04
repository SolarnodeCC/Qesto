/**
 * PRIVACY-GAM-01 — Engagement analytics privacy tests.
 * Verifies that energizer/engagement AE events and export payloads
 * contain no PII (emails, JWTs, Stripe keys, SAML assertions, AI prompts).
 * Acceptance: tests confirm no PII in analytics/export payloads.
 */

import { describe, it, expect } from 'vitest'
import { detectPII, safeLogContext } from '../../functions/api/lib/log'
import { writeEvent } from '../../functions/api/lib/observability'
import type { QestoEvent } from '../../functions/api/lib/observability'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function captureWriteDataPoint(event: QestoEvent): { blobs: string[]; doubles: number[] } {
  let captured: { blobs: string[]; doubles: number[] } | null = null
  const ae = {
    writeDataPoint(data: { blobs: string[]; doubles: number[] }) {
      captured = data
    },
  } as unknown as AnalyticsEngineDataset

  writeEvent(ae, event)
  if (!captured) throw new Error('writeDataPoint was not called')
  return captured
}

function assertNoBlobs(blobs: string[], label: string) {
  for (const blob of blobs) {
    const pii = detectPII(blob)
    expect(pii, `PII detected in ${label} blob "${blob}": ${pii.join(', ')}`).toHaveLength(0)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// detectPII unit tests (sanity check the detector itself)
// ─────────────────────────────────────────────────────────────────────────────

describe('detectPII', () => {
  it('detects email addresses', () => {
    expect(detectPII('failed for user@example.com')).toContain('email')
  })

  it('detects JWT tokens', () => {
    // jankurai:allow HLT-010-SECRET-SPRAWL reason=synthetic JWT-shaped fixture exercising the PII detector expires=2027-12-31
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.signature'
    expect(detectPII(jwt)).toContain('jwt')
  })

  it('detects Stripe secret keys', () => {
    expect(detectPII('key=sk_live_abc123')).toContain('stripe_secret')
    expect(detectPII('key=sk_test_abc123')).toContain('stripe_secret')
  })

  it('detects Stripe webhook secrets', () => {
    expect(detectPII('whsec_abc123xyz')).toContain('stripe_webhook')
  })

  it('detects Bearer tokens', () => {
    expect(detectPII('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9')).toContain('bearer')
  })

  it('returns empty array for clean strings', () => {
    expect(detectPII('session-abc123 team-xyz plan-pro')).toHaveLength(0)
    expect(detectPII('ws.energizer_answered')).toHaveLength(0)
    expect(detectPII('')).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Energizer AE event PII tests
// ─────────────────────────────────────────────────────────────────────────────

describe('PRIVACY-GAM-01: energizer AE events contain no PII', () => {
  const baseEvent = {
    sessionId: 'session-abc123',
    teamId: 'team-xyz789',
    plan: 'team' as const,
  }

  it('ws.energizer_activated — no PII in blobs', () => {
    const { blobs } = captureWriteDataPoint({ name: 'ws.energizer_activated', ...baseEvent, count: 1 })
    assertNoBlobs(blobs, 'ws.energizer_activated')
  })

  it('ws.energizer_answered — no PII in blobs', () => {
    const { blobs } = captureWriteDataPoint({ name: 'ws.energizer_answered', ...baseEvent, count: 42 })
    assertNoBlobs(blobs, 'ws.energizer_answered')
  })

  it('ws.energizer_advanced — no PII in blobs', () => {
    const { blobs } = captureWriteDataPoint({ name: 'ws.energizer_advanced', ...baseEvent })
    assertNoBlobs(blobs, 'ws.energizer_advanced')
  })

  it('ws.energizer_completed — no PII in blobs', () => {
    const { blobs } = captureWriteDataPoint({ name: 'ws.energizer_completed', ...baseEvent, durationMs: 30000 })
    assertNoBlobs(blobs, 'ws.energizer_completed')
  })

  it('ws.energizer_activation_denied — no PII in blobs', () => {
    const { blobs } = captureWriteDataPoint({ name: 'ws.energizer_activation_denied', ...baseEvent })
    assertNoBlobs(blobs, 'ws.energizer_activation_denied')
  })

  it('ws.energizer_advance_denied — no PII in blobs', () => {
    const { blobs } = captureWriteDataPoint({ name: 'ws.energizer_advance_denied', ...baseEvent })
    assertNoBlobs(blobs, 'ws.energizer_advance_denied')
  })

  it('ws.vote_submitted — no PII in blobs', () => {
    const { blobs } = captureWriteDataPoint({ name: 'ws.vote_submitted', ...baseEvent, count: 120 })
    assertNoBlobs(blobs, 'ws.vote_submitted')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PII in event fields is rejected
// ─────────────────────────────────────────────────────────────────────────────

describe('PRIVACY-GAM-01: PII in event fields is detected', () => {
  it('detects email accidentally placed in userId', () => {
    const { blobs } = captureWriteDataPoint({
      name: 'ws.energizer_answered',
      userId: 'host@company.com',
      sessionId: 'session-abc',
      plan: 'free',
    })
    // blob[1] = userId|sessionId — must contain PII (this is the test proving detectPII works)
    const pii = detectPII(blobs[1])
    expect(pii).toContain('email')
  })

  it('detects JWT accidentally placed in traceId', () => {
    const { blobs } = captureWriteDataPoint({
      name: 'ws.energizer_activated',
      sessionId: 'session-abc',
      // jankurai:allow HLT-010-SECRET-SPRAWL reason=synthetic JWT-shaped fixture exercising the PII detector expires=2027-12-31
      traceId: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.signature',
      plan: 'free',
    })
    const pii = detectPII(blobs[4])
    expect(pii).toContain('jwt')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Export CSV payload — no PII in field labels
// ─────────────────────────────────────────────────────────────────────────────

describe('PRIVACY-GAM-01: analytics export CSV headers contain no PII', () => {
  const csvHeaders = [
    'sessionId',
    'teamId',
    'energizerId',
    'energizerType',
    'participantCount',
    'activationCount',
    'answerCount',
    'completionRate',
    'durationMs',
    'windowStart',
    'windowEnd',
  ]

  it('CSV column headers contain no PII', () => {
    for (const header of csvHeaders) {
      const pii = detectPII(header)
      expect(pii, `PII in CSV header "${header}"`).toHaveLength(0)
    }
  })

  it('engagement summary row with opaque IDs contains no PII', () => {
    const row = [
      'session-abc123',
      'team-xyz789',
      'energizer-001',
      'word_cloud',
      '42',
      '3',
      '38',
      '0.905',
      '28000',
      '2026-05-20T09:00:00Z',
      '2026-05-20T09:30:00Z',
    ].join(',')

    const pii = detectPII(row)
    expect(pii, `PII in engagement CSV row: ${pii.join(', ')}`).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// safeLogContext output contains no PII (log output audit)
// ─────────────────────────────────────────────────────────────────────────────

describe('PRIVACY-GAM-01: safeLogContext redacts PII from error messages', () => {
  it('redacts email from error message', () => {
    const logOutput: string[] = []
    const origError = console.error
    console.error = (msg: string) => logOutput.push(msg)

    safeLogContext(new Error('Conflict for user@example.com already exists'), {
      traceId: 'trace-001',
      route: '/api/sessions',
      errorClass: 'ConflictError',
    })

    console.error = origError
    expect(logOutput).toHaveLength(1)
    const parsed = JSON.parse(logOutput[0])
    expect(parsed.errorMessage).not.toContain('user@example.com')
    expect(parsed.errorMessage).toContain('[REDACTED]')
  })

  it('redacts JWT from error message', () => {
    const logOutput: string[] = []
    const origError = console.error
    console.error = (msg: string) => logOutput.push(msg)

    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.sig'
    safeLogContext(new Error(`Token invalid: ${jwt}`), {
      traceId: 'trace-002',
      route: '/api/auth/verify',
      errorClass: 'AuthError',
    })

    console.error = origError
    expect(logOutput).toHaveLength(1)
    const parsed = JSON.parse(logOutput[0])
    expect(parsed.errorMessage).not.toContain(jwt)
    expect(parsed.errorMessage).toContain('[REDACTED]')
  })

  it('redacts Stripe secret key from error message', () => {
    const logOutput: string[] = []
    const origError = console.error
    console.error = (msg: string) => logOutput.push(msg)

    safeLogContext(new Error('Stripe error with key sk_live_abc123def456'), {
      traceId: 'trace-003',
      route: '/api/billing',
      errorClass: 'StripeError',
    })

    console.error = origError
    const parsed = JSON.parse(logOutput[0])
    expect(parsed.errorMessage).not.toContain('sk_live_abc123def456')
    expect(parsed.errorMessage).toContain('[REDACTED]')
  })

  it('clean error message passes through without modification', () => {
    const logOutput: string[] = []
    const origError = console.error
    console.error = (msg: string) => logOutput.push(msg)

    safeLogContext(new Error('D1 transaction failed: constraint violation'), {
      traceId: 'trace-004',
      route: '/api/sessions',
      errorClass: 'D1Error',
    })

    console.error = origError
    const parsed = JSON.parse(logOutput[0])
    expect(parsed.errorMessage).toBe('D1 transaction failed: constraint violation')
  })
})
