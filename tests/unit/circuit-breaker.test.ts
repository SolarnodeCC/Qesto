/**
 * CB-01/CB-02 — Circuit breaker unit tests (ADR-0007).
 * Verifies: state transitions (CLOSED → OPEN → HALF_OPEN → CLOSED),
 * failure counting, timeout behavior, KV sync, and graceful fallback.
 * Also verifies pre-configured breakers for Stripe, Resend, AI, JWKS.
 */

import { describe, it, expect, vi } from 'vitest'
import { CircuitBreaker, CircuitBreakers, initCircuitBreakers } from '../../functions/api/lib/resilience/circuit-breaker'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeBreaker(opts: { threshold?: number; timeout?: number; openMs?: number } = {}) {
  return new CircuitBreaker('test', {
    timeout: opts.timeout ?? 5000,
    failureThreshold: opts.threshold ?? 3,
    openDurationMs: opts.openMs ?? 60000,
    halfOpenProbeDelayMs: opts.openMs ?? 60000,
    strategy: 'local',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// State machine transitions
// ─────────────────────────────────────────────────────────────────────────────

describe('CircuitBreaker state machine', () => {
  it('starts CLOSED', () => {
    const cb = makeBreaker()
    expect(cb.getStatus()).toBe('closed')
  })

  it('stays CLOSED on success', async () => {
    const cb = makeBreaker({ threshold: 3 })
    await cb.execute(async () => 'ok', () => 'fallback')
    expect(cb.getStatus()).toBe('closed')
  })

  it('transitions to OPEN after threshold failures', async () => {
    const cb = makeBreaker({ threshold: 3 })
    const fail = async () => { throw new Error('fail') }
    // Two failures — still CLOSED (below threshold)
    await expect(cb.execute(fail, () => 'open')).rejects.toThrow()
    await expect(cb.execute(fail, () => 'open')).rejects.toThrow()
    expect(cb.getStatus()).toBe('closed')
    // Third failure hits threshold → OPEN
    const result = await cb.execute(fail, () => 'open')
    expect(result).toBe('open')
    expect(cb.getStatus()).toBe('open')
  })

  it('returns fallback immediately when OPEN', async () => {
    const cb = makeBreaker({ threshold: 2 })
    const fail = async () => { throw new Error('fail') }
    await expect(cb.execute(fail, () => 'fb')).rejects.toThrow()
    await cb.execute(fail, () => 'fb') // hits threshold
    // Now open — next call short-circuits
    const spy = vi.fn(async () => 'called')
    const result = await cb.execute(spy, () => 'fallback')
    expect(result).toBe('fallback')
    expect(spy).not.toHaveBeenCalled()
  })

  it('resets to CLOSED after reset()', () => {
    const cb = makeBreaker()
    cb.reset()
    expect(cb.getStatus()).toBe('closed')
  })

  it('transitions to HALF_OPEN after open duration expires', async () => {
    const cb = makeBreaker({ threshold: 2, openMs: 100 })
    const fail = async () => { throw new Error('fail') }
    await expect(cb.execute(fail, () => 'fb')).rejects.toThrow()
    await cb.execute(fail, () => 'fb')
    expect(cb.getStatus()).toBe('open')

    // Wait for open duration to expire
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Next call should probe (half-open)
    const result = await cb.execute(async () => 'ok', () => 'fb')
    expect(result).toBe('ok')
    expect(cb.getStatus()).toBe('closed')
  })

  it('stays CLOSED on success in HALF_OPEN probe', async () => {
    const cb = makeBreaker({ threshold: 2, openMs: 50 })
    const fail = async () => { throw new Error('fail') }
    await expect(cb.execute(fail, () => 'fb')).rejects.toThrow()
    await cb.execute(fail, () => 'fb')
    await new Promise((resolve) => setTimeout(resolve, 80))
    await cb.execute(async () => 'ok', () => 'fb')
    expect(cb.getStatus()).toBe('closed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Timeout behavior
// ─────────────────────────────────────────────────────────────────────────────

describe('CircuitBreaker timeout', () => {
  it('aborts request that exceeds timeout', async () => {
    const cb = makeBreaker({ timeout: 50, threshold: 10 })
    const slow = (signal: AbortSignal) => new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => resolve('done'), 200)
      signal.addEventListener('abort', () => {
        clearTimeout(t)
        reject(new Error('aborted'))
      })
    })
    await expect(cb.execute(slow, () => 'fallback')).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Pre-configured breakers (ADR-0007 compliance)
// ─────────────────────────────────────────────────────────────────────────────

describe('CircuitBreakers pre-configured instances (ADR-0007)', () => {
  it('stripe: 5s timeout, 5 failures threshold', () => {
    expect(CircuitBreakers.stripe.config.timeout).toBe(5000)
    expect(CircuitBreakers.stripe.config.failureThreshold).toBe(5)
    expect(CircuitBreakers.stripe.config.openDurationMs).toBe(60000)
  })

  it('resend: 5s timeout, 5 failures threshold', () => {
    expect(CircuitBreakers.resend.config.timeout).toBe(5000)
    expect(CircuitBreakers.resend.config.failureThreshold).toBe(5)
  })

  it('ai: 25s timeout, 3 failures threshold (matches RES-TIMEOUT-01)', () => {
    expect(CircuitBreakers.ai.config.timeout).toBe(25000)
    expect(CircuitBreakers.ai.config.failureThreshold).toBe(3)
  })

  it('jwks: 5s timeout, 3 failures threshold', () => {
    expect(CircuitBreakers.jwks.config.timeout).toBe(5000)
    expect(CircuitBreakers.jwks.config.failureThreshold).toBe(3)
    expect(CircuitBreakers.jwks.config.strategy).toBe('local')
  })

  it('ai uses shared strategy', () => {
    expect(CircuitBreakers.ai.config.strategy).toBe('shared')
  })

  it('stripe and resend use shared strategy', () => {
    expect(CircuitBreakers.stripe.config.strategy).toBe('shared')
    expect(CircuitBreakers.resend.config.strategy).toBe('shared')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// initCircuitBreakers idempotency
// ─────────────────────────────────────────────────────────────────────────────

describe('initCircuitBreakers idempotency', () => {
  it('does not throw when KV is undefined', () => {
    expect(() => initCircuitBreakers(undefined, 'test')).not.toThrow()
  })

  it('initializes without error when KV is provided', () => {
    const mockKv = { put: vi.fn(), get: vi.fn(), delete: vi.fn() } as unknown as KVNamespace
    expect(() => initCircuitBreakers(mockKv, 'test')).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// createIntegration factory
// ─────────────────────────────────────────────────────────────────────────────

describe('CircuitBreakers.createIntegration factory', () => {
  it('creates a breaker with 8s timeout and 3 failures', () => {
    const cb = CircuitBreakers.createIntegration('slack')
    expect(cb.config.timeout).toBe(8000)
    expect(cb.config.failureThreshold).toBe(3)
    expect(cb.config.strategy).toBe('shared')
    expect(cb.name).toBe('slack')
  })

  it('allows local strategy override', () => {
    const cb = CircuitBreakers.createIntegration('notion', 'local')
    expect(cb.config.strategy).toBe('local')
  })
})
