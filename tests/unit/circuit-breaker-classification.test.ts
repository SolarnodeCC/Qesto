/**
 * Requirement: ADR-042 (AI resilience) — the shared AI circuit breaker trips only on infrastructure failures.
 */
// A6 — the shared AI breaker must only trip on infrastructure failures, and
// failures must decay out of a 60s window.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CircuitBreaker, FAILURE_WINDOW_MS, isInfrastructureFailure } from '../../functions/api/lib/resilience/circuit-breaker'

function breaker() {
  return new CircuitBreaker('test', { timeout: 1000, failureThreshold: 3, openDurationMs: 45_000, halfOpenProbeDelayMs: 45_000, strategy: 'local' })
}
class WizardValidationError extends Error { override name = 'WizardValidationError' }

afterEach(() => vi.useRealTimers())

describe('circuit breaker failure classification', () => {
  it('classifies validation / sanitisation / opted-out errors as non-infra', () => {
    expect(isInfrastructureFailure(new WizardValidationError('bad json'))).toBe(false)
    expect(isInfrastructureFailure(Object.assign(new Error('empty'), { breakerIgnore: true }))).toBe(false)
    expect(isInfrastructureFailure(new Error('504 gateway timeout'))).toBe(true)
  })

  it('does not open on repeated validation errors', async () => {
    const b = breaker()
    for (let i = 0; i < 5; i++) {
      await expect(b.execute(async () => { throw new WizardValidationError('x') }, () => 'open')).rejects.toThrow('x')
    }
    expect(b.getStatus()).toBe('closed')
  })

  it('opens after 3 infra failures inside the window', async () => {
    const b = breaker()
    await expect(b.execute(async () => { throw new Error('net') }, () => 'open')).rejects.toThrow()
    await expect(b.execute(async () => { throw new Error('net') }, () => 'open')).rejects.toThrow()
    await expect(b.execute(async () => { throw new Error('net') }, () => 'open')).resolves.toBe('open')
    expect(b.getStatus()).toBe('open')
  })

  it('lets old failures decay out of the window', async () => {
    vi.useFakeTimers()
    const b = breaker()
    await expect(b.execute(async () => { throw new Error('net') }, () => 'open')).rejects.toThrow()
    await expect(b.execute(async () => { throw new Error('net') }, () => 'open')).rejects.toThrow()
    vi.advanceTimersByTime(FAILURE_WINDOW_MS + 1)
    await expect(b.execute(async () => { throw new Error('net') }, () => 'open')).rejects.toThrow()
    expect(b.getStatus()).toBe('closed')
  })
})
