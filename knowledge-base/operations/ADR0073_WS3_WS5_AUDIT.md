---
id: ADR0073_WS3_WS5_AUDIT
type: evidence
domain: security
category: execution
status: complete
version: 1.0
created: 2026-07-30
updated: 2026-07-30
tags:
  - rate-limiting
  - adr-0073
  - audit
relates_to:
  - ADR-0073-atomic-rate-limiting-workers-api
  - ADR0073_ATOMIC_RL_WORKSTREAMS
  - SEC-RL-ATOMIC-TIER-A-01
  - SEC-RL-ATOMIC-TIER-B-01
  - SEC-RL-ATOMIC-CLEANUP-01
---

# ADR-0073 — WS-3 / WS-4 / WS-5 execution + senior audit

**Auditor role:** senior developer / API lead  
**Date:** 2026-07-30  
**Branch:** `cursor/atomic-rate-limiting-adr-c8e4`

## Scope completed

| WS | Story | Verdict |
|----|-------|---------|
| WS-3 | `SEC-RL-ATOMIC-TIER-A-01` | **Done** |
| WS-4 | `SEC-RL-ATOMIC-TIER-B-01` | **Done** |
| WS-5 | `SEC-RL-ATOMIC-CLEANUP-01` | **Done** (code) |
| WS-5 optional | `SEC-RL-ATOMIC-L0-WAF-01` | **Deferred** — zone WAF is dashboard ops (ADR-042 §1.2), not Worker code |

## Surface matrix (post-migration)

| Surface | Profile / mode | File | Notes |
|---------|----------------|------|-------|
| Public API key | `api_key` | `middleware/public-api-auth.ts` | Flag-gated; legacy KV on flag off |
| Embed read / handshake | `embed_read` / `embed_handshake` | `middleware/widget-token.ts` | KV prefixes preserved (`embed-read` / `embed-hs`) |
| Join by-code | `join` | `app.ts` | |
| Public event agenda/feed | `public_event` | `app.ts` | **Critical fix:** were mis-tagged as `join`+60 |
| KB search | `kb_search` | `routes/knowledge-base.ts` | |
| Admin audit query | `admin_audit_query` | `routes/admin/audit.ts` | |
| Webhook egress | `webhook` | `lib/webhook-rate-limit.ts` | Now on ACTIONS_KV (was INTEGRATIONS_KV) |
| Auth middleware `/request` | dual `auth_burst` + 5/600 | `app.ts` | |
| Magic-link / password / gallery | dual `auth_burst` + product window | auth + templates-marketing | |
| Report content | dual `report_burst` + 5/600 | `app.ts` | |
| AI insights/coaching/wizard | dual `ai_burst` + 10/3600 | insights / ai-insights / wizard-ai | New binding `RL_AI_BURST` 1011 |
| Session create | sustained 30/3600 only | `app.ts` | No burst binding (intentional) |
| Admin destructive / audit export | sustained only | admin routes | Long window, no Workers RL |
| Help-ask / deliberate | **unchanged** KV helper | out of epic registry | Documented residual |
| SessionRoom DO | **unchanged** | out of scope | Already atomic |

## Critical findings during build

1. **Agenda/feed mis-namespace (fixed):** previously `namespace: 'join', limit: 60` shared the join key space incorrectly; now `profile: 'public_event'`.
2. **Webhook KV store moved** from INTEGRATIONS_KV → ACTIONS_KV when Env is passed (correct ownership for rate limits). Fallback still uses integrations KV only if ACTIONS_KV absent.
3. **Do-not-co-land WS-3/WS-4:** implemented in one PR at user request, but failure modes remain separable via flag (`ATOMIC_RATE_LIMIT_ENABLED`) and profile-level rollback.
4. **Fail-closed semantics:** middleware returns **503** if `ACTIONS_KV` missing + fail-closed; KV *throw* under fail-closed becomes **429 deny** via `lib/rate-limit` (documented in tests).
5. **L0 WAF not coded** — requires Cloudflare dashboard rulesets; left as optional ops story.
6. **Prod flag still `false`** — enables safe deploy; staging burst + AE check required before flip.

## Exit gates

| Gate | Result |
|------|--------|
| `tsc --noEmit` | Pass |
| Targeted rate-limit suites | Pass (embed PEN5 RG-1 included) |
| `wrangler deploy --dry-run` | 11 `RL_*` bindings (1001–1011) |
| `npm test` | Pass — **304** files / **2598** tests (2026-07-30) |

## Residual risk / follow-ups

- Operator must run `burst:api-key-rate-limit` on staging with flag on before prod flip.
- Help-ask (10/60) and deliberate cast/verify/observe still on `lib/rate-limit` — promote later if abuse appears.
- Optional `SEC-RL-ATOMIC-L0-WAF-01` zone rules for auth/WS.
- ADR status set to **Implemented**; prod enablement remains flag-gated.
