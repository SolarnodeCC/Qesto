# ADR-042: Cloudflare Platform Capability Expansion — 6-Week Phased Improvement Plan

**Date**: 2026-06-04  
**Status**: Proposed  
**Owner**: Lead Architect  
**Related ADRs**: ADR-001 (Durable Objects for session state), CB-02 (in-app circuit breaker)  
**Stakeholders to sign off**: PO (scope), DevOps (rollout), CSO (firewall/security gates)

---

## Context

Qesto runs on a maturing Cloudflare stack: 3 Workers, D1 (`qesto_3_db`), 13 active KV namespaces, the `SessionRoom` Durable Object, Vectorize (3 indexes), Workflows, and Workers AI. Several account-level capabilities are provisioned but **unused**: AI Gateway, Queues, Hyperdrive, Cloudflare Images, Cache Rules, Firewall/Transform Rules, Zaraz, and Stream.

Codebase findings that shape this plan:
- **Workers AI is called directly** (`env.AI.run(...)` in `functions/api/lib/ai/*.ts`) with **no AI Gateway** in front. There is no centralized cache, no cross-request cost ceiling, and no provider-side observability. Resilience is hand-rolled per call site via `functions/api/lib/resilience/circuit-breaker.ts` (KV-backed).
- **Analytics Engine is bound** as `METRICS_AE` but only for raw request logging — not session funnel or realtime health.
- **No Firewall Rules / WAF custom rules** are configured despite a public WS surface and magic-link auth — the only abuse controls are Bot Fight Mode and the in-app circuit breaker.
- Votes and sentiment scoring run hot during LIVE; the architect skill flags **KV's 1-write/s-per-key limit** as the binding constraint.

**Hard constraints (unchanged):** Workers AI only (no Anthropic/OpenAI), secrets via `wrangler ... secret put`, DRAFT=REST / LIVE=WebSocket, D1 source of truth + KV cache, DO single-threaded ~128MB.

**Prioritization order:** (1) realtime performance → (2) reliability/security → (3) cost → (4) new features.

---

## Decision

Adopt a **3-phase, 6-week plan**. Each phase is independently shippable and gated. We deliberately front-load the highest-leverage, lowest-risk items (AI Gateway, WAF, AE dashboards), defer anything needing schema or DO-protocol changes to Phase 2, and reserve Phase 3 for feature-unlocking work (Queues, Images, Stream/recording) that depends on the earlier foundations.

---

## Phase 1 (Weeks 1–2): Quick Wins — high impact, low effort

### 1.1 — AI Gateway in front of all Workers AI calls
- **Impact**: Sentiment latency −40–70% on cache hits; cost −30–50%; rate-limit safety.
- **Effort**: 2–3 days.
- **Implementation**: New `ai-gateway.ts` wrapper + `runAI()` unified entry point in `session-context.ts`.
- **Success metrics**: Gateway cache-hit rate ≥ 35% within 2 weeks; p50 sentiment latency < 200ms on hits; AI spend/session down ≥ 30%.

### 1.2 — WAF custom Firewall Rules + rate limiting on auth & WS upgrade
- **Impact**: Edge abuse blocking (auth flood, WS join attacks); reliability ++.
- **Effort**: 2 days.
- **Implementation**: Rate-limit rules on `/api/auth/magic-link`, `/api/sessions/:code/ws`; firewall rules for anomalous join bursts.
- **Success metrics**: ≥ 90% credential-stuffing/join-flood traffic challenged at edge; zero false-positive lockouts in canary.

### 1.3 — Session funnel + realtime health on Analytics Engine
- **Impact**: Observability foundation for all Phase 2+ optimizations.
- **Effort**: 2–3 days.
- **Implementation**: Extend `writeEvent()` for state transitions, vote latency, WS, AI metrics. Build SQL dashboards.
- **Success metrics**: Dashboards live for funnel conversion, WS drop rate, p95 vote→broadcast latency, AI cache-hit; used as baseline.

**Phase 1 total: ~7 working days. Risk: low. No schema/DO-protocol changes.**

---

## Phase 2 (Weeks 3–4): Infrastructure — medium effort, major improvements

### 2.1 — Async work offload to Queues (AI insights, recaps, integration fan-out)
- **Impact**: Realtime close path latency −60%+; reliability ++ (retry/DLQ).
- **Effort**: 4–5 days.
- **Implementation**: Move post-session AI insight generation and Slack/Teams notifications to Queues consumer Worker.
- **Dependencies**: Depends on 1.1 (AI Gateway wrapper).
- **Success metrics**: 100% of post-session work async; DLQ rate < 1%; p95 `close_session` ack < 500ms.

### 2.2 — DO-buffered vote/sentiment writes with periodic KV/D1 flush
- **Impact**: Realtime throughput scales to large rooms; kills 1-write/s KV bottleneck.
- **Effort**: 4–5 days.
- **Implementation**: Accumulate votes in SessionRoom DO memory, flush to D1 every N seconds and to KV on debounce.
- **Dependencies**: D1 migration required (audit gate). Load test (500+ voters) mandatory before prod.
- **Success metrics**: Zero KV 429 errors at 500+ concurrent voters; p95 vote→broadcast < 150ms; no vote loss.

### 2.3 — R2 durable session snapshots + DO eviction recovery
- **Impact**: Reliability ++ (graceful DO recovery); negligible cost.
- **Effort**: 3 days.
- **Implementation**: Snapshot SessionRoom state to R2 periodically for DO rehydration after eviction.
- **Dependencies**: Land with/before 2.2 (shared recovery contract).
- **Success metrics**: Forced DO restart mid-session loses ≤ one flush interval of data; recovery < 1s.

**Phase 2 total: ~12 working days. Risk: medium (DO protocol + migration). Gate: load test + canary.**

---

## Phase 3 (Weeks 5–6): Advanced Features — unlock new capabilities

### 3.1 — Cloudflare Images for team branding, presenter media & open-text exports
- **Impact**: New plan-gated upsell; faster media load; reduced bandwidth.
- **Effort**: 3 days.
- **Implementation**: Wire `requirePlan()` gating; signed upload URLs; tenant-scoped keys.

### 3.2 — Edge Cache Rules for public/read-heavy surfaces
- **Impact**: Cost −; TTFB − on public/marketing pages.
- **Effort**: 2 days.
- **Implementation**: Cache Rules for template gallery, public result pages, help KB.

### 3.3 — Session recording & replay (Stream) — *spike + thin slice*
- **Impact**: New premium feature; async/on-demand sessions.
- **Effort**: 5 days (spike + slice, not full GA).
- **Implementation**: Spike to validate; one thin vertical slice end-to-end.
- **Blocked until**: GDPR consent-log gate + CSO/PO sign-off.

**Phase 3 total: ~10 working days. Risk: medium (Stream unknowns, consent). 3.3 is spike-gated.**

---

## Consequences

### Positive
- Realtime latency measurably faster (AI Gateway cache + DO-buffered votes).
- Reliability hardened end-to-end (WAF, Queues retry/DLQ, DO snapshots).
- Cost reduced on Workers AI (Gateway caching, fewer junk invocations via WAF).
- Each phase independently shippable, observable, and reversible.
- New revenue/feature surface (branding, recording) lands after foundation is solid.

### Negative / Trade-offs
- **More platform surface to operate**: Each service adds failure modes. Mitigated by phasing + AE observability.
- **Eventual consistency on KV vote mirror** (2.2): D1 is source of truth; KV cache lags by flush interval. **PO must accept.**
- **DO protocol + D1 migration** (2.2/2.3): Only schema-invasive work. Gated behind load test + canary.
- **Cache = data-exposure risk** (1.1 semantic cache, 3.2 edge cache): Mandatory CSO review on scope + tenant isolation.

### Risks
- WAF false positives lock out legitimate users → canary + allowlist known egress; **CSO sign-off**.
- Queues at-least-once delivery double-posts messages → idempotency keys required.
- DO memory pressure from buffered votes in huge rooms → hard cap + flush-on-threshold.
- Stream recording without verified consent → GDPR exposure → consent-log gate is hard blocker.

---

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| **Hyperdrive (DB pooling)** | Qesto uses D1 (native SQLite), not external Postgres. Hyperdrive doesn't apply. |
| **API Gateway request transformation** | Hono already owns request shaping. Adding edge transformation duplicates ownership. |
| **Zaraz (marketing tags)** | Orthogonal to realtime/reliability/cost priorities. Defer to marketing-owned initiative. |
| **Replace CB-02 with AI Gateway rate limiting** | Different layers. Keep both; layer Gateway on top. |
| **Buffer votes in KV instead of DO** | Explodes key count, loses single-threaded ordering. DO buffering (2.2) is cleaner. |
| **Full Stream GA in Phase 3** | Too many unknowns (cost model, consent UX). Scoped to spike + slice. |

---

## Implementation Sequencing & Gates

- **Phase 1** ships behind config flags; no migration. Gate: AE dashboards green, CSO sign-off on WAF.
- **Phase 2** requires architect-authored D1 migration, load test (500+ voters), canary. Gate: zero KV write-limit errors + DO recovery proven. 2.3 lands with/before 2.2.
- **Phase 3** feature-flagged + plan-gated. 3.3 blocked until consent-log gate + CSO/PO sign-off.

**Per-phase exit criteria:** `npm test` + `npx tsc --noEmit` pass; docs updated.

---

## Docs to Update

| Change | Doc |
|---|---|
| AI Gateway wrapper, Queues consumer, DO buffer/snapshot state shape | `ARCHITECTURE.md` |
| WAF rules deployment, cache scope | `SECURITY_FULL.md` |
| New bindings (AI Gateway ID, Queues) | `wrangler.toml [vars]` |
| Initiatives accepted as committed work | `BACKLOG_MASTER.md` |
| This decision | `knowledge-base/adr/ADR-042-cloudflare-capability-expansion.md` |

---

## Effort Summary

| Phase | Initiatives | Days | Risk |
|---|---|---|---|
| 1 — Quick Wins | AI Gateway (1.1), WAF (1.2), AE dashboards (1.3) | ~7 | Low |
| 2 — Infrastructure | Queues (2.1), DO vote buffer (2.2), R2 snapshots (2.3) | ~12 | Medium |
| 3 — Advanced | Images (3.1), Cache Rules (3.2), Stream spike (3.3) | ~10 | Medium |
| **Total** | | **~29 days** | |

---

## Sign-Offs Required Before Build

- [ ] **PO**: Accept KV eventual-consistency for votes (2.2)? Accept recording consent UX (3.3)?
- [ ] **CSO**: Approve WAF thresholds (1.2), semantic/edge cache scope (1.1 + 3.2), recording consent gate (3.3)?
- [ ] **Architect**: Confirm DO protocol changes (2.2) + migration placement?

---

**Implementation docs:**
- Phase 1.1: `functions/api/lib/ai/ai-gateway.ts`, `functions/api/lib/ai/session-context.ts` (updated)
- Phase 1.2: `docs/PHASE1-WAF-RULES.md`
- Phase 1.3: `docs/PHASE1-ANALYTICS-ENGINE.md`
- Phase 2+: To be detailed in follow-up PRs per phase gate.

---

*Status: Ready for sign-off. Phase 1 implementation in progress on branch `claude/stoic-ptolemy-h6KWt`.*
