# ADR: Circuit Breaker Pattern for External Dependencies

**Status:** Approved (Agent-Validated)  
**Date:** 2026-05-10  
**Author:** Security + Architecture Review  
**Affected Components:** Stripe, Resend, Workers AI, OAuth/JWKS  

---

## Problem

Qesto makes calls to external dependencies (Stripe, Resend, Workers AI, JWKS IdP). When these services degrade or fail:

- **Without timeout:** requests hang up to 30s, exhausting Worker CPU budget and isolate concurrency limits
- **Without retry:** transient failures (network hiccup, brief latency) cascade to user-visible errors
- **Without circuit breaker:** a single failing service gets hammered with requests during its outage, slowing recovery

**Audit Finding:** RES-08 (no circuit breaker), RES-01 (no timeout on AI), RES-05/06 (no retry on Stripe/Resend), EF-01/02 (empty OAuth catches) are critical.

**Current State:** Basic timeouts exist in `lib/ai-insights.ts` (10s) and `billing.ts` (10s), but no cross-service breaker, no retry logic, no Resend/OAuth coverage.

---

## Decision

Implement a **two-tier circuit breaker** with **KV-backed shared state** and **per-isolate memory cache** to balance latency, consistency, and cost.

### Architecture

```
External Dependency Call Flow:

1. Check in-memory cache (microseconds)
   → if OPEN locally, short-circuit → return degraded response

2. Make call with timeout (AbortController, 5s default, 10s for AI)

3. On failure:
   → increment in-memory failure counter
   → if threshold reached (5 failures in 60s):
      → set local OPEN state
      → write KV "cb:stripe:status=OPEN" (TTL 60s)
      → broadcast metric event (cb.opened)

4. On cold isolate:
   → lazy-read KV once per isolate lifetime
   → if KV state is OPEN, adopt locally

5. On HALF_OPEN (breaker open for >60s):
   → single-flight probe: one request attempts call
   → if probe succeeds → set CLOSED, reset counters
   → if probe fails → set OPEN again (TTL 60s)
```

### Storage

- **In-memory state:** `{ status: CLOSED | OPEN | HALF_OPEN, failureCount, openedAt, lastProbeAt }`
- **KV state:** `cb:{service}:{env} = { status, timestamp }` (TTL 60s)
- **DO state (for JWKS only):** Optional; for auth hot-path use in-memory only

### Configuration

Per-service parameters:

| Service | Timeout | Failure Threshold | Open Duration | Reuse |
|---|---|---|---|---|
| **Stripe** | 5s | 5 in 60s | 60s | Integrations, billing |
| **Resend** | 5s | 5 in 60s | 60s | Integrations, email |
| **Workers AI** | 10s | 3 in 60s | 45s | AI insights, AI recap |
| **JWKS (OAuth)** | 5s | 3 in 30s | 15s | Auth hot path, fail-closed |

### Implementation

**File:** `lib/resilience/circuit-breaker.ts`

```typescript
export type BreakerConfig = {
  timeout: number;
  failureThreshold: number;
  openDurationMs: number;
  halfOpenProbeDelayMs: number;
  strategy: 'local' | 'shared'; // local=in-memory only, shared=KV
};

export class CircuitBreaker {
  static readonly STRIPE = new CircuitBreaker('stripe', {
    timeout: 5000,
    failureThreshold: 5,
    openDurationMs: 60000,
    halfOpenProbeDelayMs: 60000,
    strategy: 'shared',
  });

  static readonly RESEND = new CircuitBreaker('resend', { /* ... */ });
  static readonly AI = new CircuitBreaker('ai', { /* ... */ });
  static readonly JWKS = new CircuitBreaker('jwks', {
    strategy: 'local', // Auth path doesn't need cross-isolate sync
  });

  async execute<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    onFallback: () => T
  ): Promise<T> {
    // Check local state
    if (this.isLocallyOpen()) {
      return onFallback();
    }

    // Make call with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const result = await fn(controller.signal);
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure(err);
      if (this.isOpen()) {
        return onFallback();
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private isLocallyOpen(): boolean {
    // Check in-memory state + lazy-read KV once
    // ...
  }

  private recordSuccess(): void {
    this.failureCount = 0;
    // KV write if transitioning OPEN → CLOSED
  }

  private recordFailure(err: Error): void {
    this.failureCount++;
    if (this.failureCount >= this.config.failureThreshold) {
      this.status = 'OPEN';
      this.openedAt = Date.now();
      // Write to KV (async, no await)
      this.writeKVState();
    }
  }
}
```

**Usage:**

```typescript
// In billing.ts
const result = await CircuitBreaker.STRIPE.execute(
  async (signal) => {
    return await fetch('https://api.stripe.com/..', {
      signal,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },
  () => ({
    status: 'SERVICE_UNAVAILABLE',
    retryAfter: 60,
    message: 'Billing service temporarily degraded',
  })
);
```

---

## Trade-offs

| Dimension | In-Memory Only | KV Only | Two-Tier (Chosen) |
|---|---|---|---|
| Happy-path latency | 0 | +5-20ms | 0 |
| Cross-isolate convergence | Never | <1s | ~30–60s |
| KV write cost | None | High (throttled) | Low (only on transition) |
| State after isolate restart | Lost | Preserved | Re-learned in seconds |

**Why two-tier?**
- Pure in-memory: one isolate tripping breaker doesn't protect others; Stripe still gets hammered from every PoP
- Pure KV: adds 5-20ms read latency to *every* call on happy path; hits write-throttle during failures
- Two-tier: best of both—fast path has zero overhead; shared state converges in 30-60s; recovery after isolate restart is automatic

---

## Monitoring & Alerts

**Metrics to emit:**
```typescript
// In observability.ts
await c.env.METRICS_AE.writeDataPoint({
  indexes: ['cb.opened'],
  blobs: [JSON.stringify({
    service: 'stripe' | 'resend' | 'ai' | 'jwks',
    failureCount: 7,
    threshold: 5,
    env: 'production',
    timestamp: Date.now(),
  })],
});
```

**Alert Thresholds (P0/P1):**
- **Stripe breaker opens:** P0 (billing path broken)
- **AI breaker opens:** P1 (insights degraded, session unaffected)
- **Resend breaker opens:** P1 (email degraded)
- **JWKS breaker opens:** P0 (login broken)

---

## Testing

**Unit tests (lib/resilience/circuit-breaker.test.ts):**
- Breaker opens after N failures
- Breaker closes on successful half-open probe
- In-memory state is independent per isolate
- KV state converges across isolates within 2 minutes
- Timeout abort works (request doesn't hang)
- Fallback response is returned during open state

**Integration tests (staging):**
- Simulate Stripe 500 for 90s → breaker opens → session continues → recovery on success
- Simulate AI timeout → breaker opens (if threshold reached) → fallback insight sent
- Simulate OAuth JWKS unavailable → login rejects closed (not stale-cached)
- 1000 concurrent requests during half-open → single-flight probe (only 1 hits Stripe)

---

## Rollout Plan

1. **Sprint 20 pre-work:** Implement circuit breaker module (8 pts)
2. **Sprint 21:** Integrate Stripe + Resend + Workers AI (uses new module)
3. **Sprint 23:** Integrate JWKS + finalize error handling
4. **Sprint 25:** Staging validation (simulate failures, verify recovery)
5. **Sprint 26:** Production canary (5% cohort)

---

## Alternatives Considered

1. **No circuit breaker (current state):** Cascading failures, no cross-isolate coordination. **Rejected:** allows whole-platform outage.
2. **In-memory only:** Faster, simpler. **Rejected:** no coordination across instances during multi-PoP Stripe failure.
3. **Pure KV state:** Consistent globally. **Rejected:** adds latency to happy path, prone to write throttle.
4. **DO-backed breaker:** Strong consistency. **Rejected:** adds RPC latency, single point of failure, overhead for non-auth paths.

---

## References

- Jankurai Audit: [RES-08, RES-01, RES-05, RES-06](../quality/audits/resilience-audit.md)
- Backend Review: Circuit Breaker Safety (Agent validation)
- Release Blocker: v2.2 requires resilience hardening before canary
