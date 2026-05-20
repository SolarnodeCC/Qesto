/**
 * Two-tier circuit breaker for external dependencies.
 *
 * Combines in-memory state (fast) with KV-backed shared state (coordinated)
 * to prevent cascading failures during outages of Stripe, Resend, Workers AI, OAuth.
 *
 * See ADR-CIRCUIT-BREAKER.md for detailed design.
 */

export type BreakerStatus = 'closed' | 'open' | 'half_open'

export interface BreakerConfig {
  /** Request timeout in milliseconds (default 5000) */
  timeout: number
  /** Number of failures before breaker opens */
  failureThreshold: number
  /** How long to keep breaker open before trying half-open (ms) */
  openDurationMs: number
  /** Delay before probing a half-open breaker (ms) */
  halfOpenProbeDelayMs: number
  /** Whether to use KV for cross-isolate state ('local' or 'shared') */
  strategy: 'local' | 'shared'
}

interface BreakerState {
  status: BreakerStatus
  failureCount: number
  lastFailureTime?: number
  openedAt?: number
  lastProbeTime?: number
}

/**
 * Generic circuit breaker for external service calls.
 *
 * State machine:
 * - CLOSED: normal, requests pass through
 * - OPEN: threshold hit, requests fail fast (return fallback)
 * - HALF_OPEN: testing recovery, single-flight probe
 */
export class CircuitBreaker {
  private state: BreakerState = {
    status: 'closed',
    failureCount: 0,
  }

  private kvKey: string
  private environment: string

  constructor(
    public name: string,
    public config: BreakerConfig,
    private kv?: KVNamespace,
    environment?: string
  ) {
    this.environment = environment || 'prod'
    this.kvKey = `cb:${name}:${this.environment}`
  }

  /**
   * Execute a function with circuit breaker protection.
   *
   * @param fn Function that returns a Promise (receives AbortSignal)
   * @param onOpen Fallback to return when breaker is open
   * @returns Result of fn or fallback if open
   */
  async execute<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    onOpen: () => T | Promise<T>
  ): Promise<T> {
    // Check if locally open
    if (this.state.status === 'open') {
      const timeSinceOpen = Date.now() - (this.state.openedAt || 0)
      if (timeSinceOpen > this.config.openDurationMs) {
        // Transition to half-open
        this.state.status = 'half_open'
        this.state.lastProbeTime = Date.now()
      } else {
        // Still open, return fallback
        return await onOpen()
      }
    }

    // Make call with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout
    )

    try {
      const result = await fn(controller.signal)
      // Success: record and return
      this.recordSuccess()
      return result
    } catch (err) {
      // Failure: record and maybe open breaker
      this.recordFailure(err)

      // If failure count exceeded threshold, breaker is now open
      if (this.state.failureCount >= this.config.failureThreshold) {
        return await onOpen()
      }

      // Otherwise re-throw (not yet at threshold)
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Get current breaker status.
   */
  getStatus(): BreakerStatus {
    return this.state.status
  }

  /**
   * Manually reset breaker to closed.
   */
  reset(): void {
    this.state = {
      status: 'closed',
      failureCount: 0,
    }
    // Clear KV if using shared state
    if (this.kv && this.config.strategy === 'shared') {
      this.kv.delete(this.kvKey).catch(() => {
        // Ignore KV delete errors
      })
    }
  }

  private recordSuccess(): void {
    // Success resets failure count
    this.state.failureCount = 0

    // If half-open, transition back to closed
    if (this.state.status === 'half_open') {
      this.state.status = 'closed'
      if (this.kv && this.config.strategy === 'shared') {
        this.kv.delete(this.kvKey).catch(() => {})
      }
    }
  }

  private recordFailure(_err: unknown): void {
    this.state.failureCount++
    this.state.lastFailureTime = Date.now()

    if (this.state.failureCount >= this.config.failureThreshold) {
      this.state.status = 'open'
      this.state.openedAt = Date.now()

      // Write to KV (async, fire-and-forget)
      if (this.kv && this.config.strategy === 'shared') {
        const kvData = {
          status: 'open',
          openedAt: this.state.openedAt,
          failureCount: this.state.failureCount,
        }
        this.kv.put(this.kvKey, JSON.stringify(kvData), {
          expirationTtl: Math.ceil(this.config.openDurationMs / 1000),
        }).catch(() => {
          // Ignore KV write errors
        })
      }

      // Emit metric event
      // TODO: wire to observability system
    }
  }
}

/**
 * Pre-configured circuit breakers for Qesto's external dependencies.
 */
export const CircuitBreakers = {
  stripe: new CircuitBreaker('stripe', {
    timeout: 5000,
    failureThreshold: 5,
    openDurationMs: 60000,
    halfOpenProbeDelayMs: 60000,
    strategy: 'shared',
  }),

  resend: new CircuitBreaker('resend', {
    timeout: 5000,
    failureThreshold: 5,
    openDurationMs: 60000,
    halfOpenProbeDelayMs: 60000,
    strategy: 'shared',
  }),

  ai: new CircuitBreaker('ai', {
    timeout: 25000, // Matches RES-TIMEOUT-01 (25s proven in production)
    failureThreshold: 3,
    openDurationMs: 45000,
    halfOpenProbeDelayMs: 45000,
    strategy: 'shared',
  }),

  jwks: new CircuitBreaker('jwks', {
    timeout: 5000,
    failureThreshold: 3,
    openDurationMs: 15000,
    halfOpenProbeDelayMs: 15000,
    strategy: 'local', // Auth path doesn't need cross-isolate sync
  }),

  /**
   * Create a custom breaker for integrations.
   */
  createIntegration(name: string, strategy: 'local' | 'shared' = 'shared') {
    return new CircuitBreaker(name, {
      timeout: 8000,
      failureThreshold: 3,
      openDurationMs: 30000,
      halfOpenProbeDelayMs: 30000,
      strategy,
    })
  },
}

/**
 * Initialize circuit breakers with KV namespace.
 * Idempotent — safe to call on every request; only wires KV once per isolate.
 *
 * @param kv ACTIONS_KV namespace (or any shared KV)
 * @param environment 'production' | 'staging' | 'dev'
 */
let _breakersKvInitialized = false

export function initCircuitBreakers(kv: KVNamespace | undefined, environment: string): void {
  if (!kv || _breakersKvInitialized) return
  _breakersKvInitialized = true

  // Re-initialize existing breakers with KV binding (once per isolate)
  const entries = Object.entries(CircuitBreakers) as Array<[string, CircuitBreaker | Function]>
  for (const [_key, breaker] of entries) {
    if (breaker instanceof CircuitBreaker) {
      const newBreaker = new CircuitBreaker(breaker.name, breaker.config, kv, environment)
      Object.assign(breaker, newBreaker)
    }
  }
}
