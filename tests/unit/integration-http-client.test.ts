import { describe, it, expect, vi, afterEach } from 'vitest'
import { IntegrationHttpClient } from '../../functions/api/lib/integrations/http-client'
import { CircuitBreaker } from '../../functions/api/lib/resilience/circuit-breaker'

describe('IntegrationHttpClient timeout (INT-PROVIDER-01)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('aborts fetch when defaultTimeout elapses even with upstream AbortSignal', async () => {
    const cb = new CircuitBreaker('test-int', {
      timeout: 5000,
      failureThreshold: 5,
      openDurationMs: 60000,
      halfOpenProbeDelayMs: 60000,
      strategy: 'local',
    })
    const client = new IntegrationHttpClient(cb, 50)

    const upstream = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal
          if (signal) {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
              once: true,
            })
          }
        })
      }),
    )

    await expect(
      client.fetch('https://example.test/hook', { method: 'GET', signal: upstream.signal }),
    ).rejects.toThrow()
  })
})
