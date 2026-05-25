---
id: ADR-0029
status: accepted
date: 2026-05-25
---

# ADR-0029 — Long-Running AI via Async Jobs

## Decision

- In-request: wizard, sentiment, copilot hints (&lt; 8s).
- Deferred (S65+): recap precompute returns `202` + `pollUrl` when `AI_ASYNC_JOBS_ENABLED=true`.
- Until then, coaching/recap remain synchronous with circuit breaker.
