/**
 * Integration HTTP client with circuit breaker, timeout, and retry support.
 * Used by all integration providers.
 */

import { CircuitBreaker } from '../resilience/circuit-breaker'

export interface RetryConfig {
  maxAttempts?: number
  backoffMs?: number
  backoffStrategy?: 'exponential' | 'linear'
}

export class IntegrationHttpClient {
  constructor(
    private circuitBreaker: CircuitBreaker,
    private defaultTimeout: number = 10000
  ) {}

  /**
   * Make an HTTP request with circuit breaker, timeout, and retry.
   *
   * @param url URL to fetch
   * @param options Request options
   * @param retryConfig Retry behavior
   * @returns Parsed JSON response
   */
  async fetch<T>(
    url: string,
    options: RequestInit = {},
    retryConfig: RetryConfig = {}
  ): Promise<T> {
    const maxAttempts = retryConfig.maxAttempts ?? 2
    const backoffMs = retryConfig.backoffMs ?? 100
    const backoffStrategy = retryConfig.backoffStrategy ?? 'exponential'

    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await this.circuitBreaker.execute(
          (signal) => this.fetchWithTimeout(url, { ...options, signal }),
          () => {
            throw new Error('Circuit breaker open')
          }
        )
        return result as T
      } catch (err) {
        lastError = err as Error
        const isLastAttempt = attempt === maxAttempts - 1

        if (isLastAttempt) {
          throw lastError
        }

        // Calculate backoff delay
        const delayMs =
          backoffStrategy === 'exponential'
            ? backoffMs * Math.pow(2, attempt)
            : backoffMs * (attempt + 1)

        // Sleep before retry
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    throw lastError || new Error('Unknown fetch error')
  }

  /**
   * Fetch with timeout (AbortController).
   */
  private async fetchWithTimeout<T>(
    url: string,
    options: RequestInit & { signal?: AbortSignal }
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout)

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort()
      } else {
        options.signal.addEventListener('abort', () => controller.abort(), { once: true })
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
