---
id: SPRINT95_EXECUTION
type: release
domain: product
category: sprint-closeout
status: active
version: 1.0
created: 2026-08-28
updated: 2026-08-28
tags:
  - sprint-95
  - v6.2-ga
  - connect
  - federation
  - sovereign
  - learn
  - adr-0062
relates_to:
  - SPRINT85_99_PLAN
  - SPRINT91_99_STORIES
  - SPRINT94_EXECUTION
  - ADR-0062-federation-trust-isolation-model
  - ADR-0059-ecosystem-egress-governance
  - BACKLOG_MASTER
---

# Sprint 95 — Execution Summary

_Goal (per [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) §S95: **v6.2 GA + CONNECT opens.**
Close the v6.2 line (PULSE + LEARN + SOVEREIGN+) and open the E96 CONNECT epic by accepting the
federation trust ADR and shipping the scoped-invite handshake + the cross-region/cross-tenant
isolation-proof harness. P0 anchors: `SEC-SOVEREIGN-ISOLATION-01`, `CONNECT-INVITE-01`._

## Outcome

Sprint 95 **opens CONNECT** (competitive epic #6, the v7.0 network moat) and lands the v6.2 GA
verticals tail. It accepts **ADR-0062** (federation trust model & cross-tenant isolation proof),
ships the federation invite envelope (`CONNECT-INVITE-01`) and the isolation-proof harness
(`SEC-SOVEREIGN-ISOLATION-01`), completes the LEARN instructor-analytics backend
(`FE-LEARN-INSTRUCTOR-01`), and closes the v6.2 i18n carry-forwards (`I18N-LEARN-01`,
`I18N-SOVEREIGN-01`, `SOVEREIGN-I18N-01`). The CONNECT *join* (multi-tenant join, ZK-across-tenants,
hard sovereign D1 constraint) is sequenced for S96 behind these gates, per the do-not-co-land
discipline.

- **Federation trust model (`CONNECT-00`, ADR-0062):** decides — once, up front — the invite
  envelope, the cross-tenant isolation guarantee, federated anonymity (aggregates only), and the
  v7.0-rc scale-evidence obligation. Supersedes nothing in FEDERATION-01 (template trust links) —
  the two coexist for different jobs.
- **Federation invite (`CONNECT-INVITE-01`):** a compact, scoped, time-limited, HMAC-signed
  envelope (the ADR-0050 discipline — not a JWT, not an API key) reusing the single shared MAC
  primitive. Default TTL **7d**, hard max **30d**. `POST /api/federation/connect/invites`
  (host-member only; **503** fail-closed without `CONNECT_INVITE_SECRET`). **Sovereign exclusion
  is enforced at mint** — `mintFederationInvite` calls `assertFederationAllowed` and returns a
  typed violation (never a token) for a sovereign host; every mint is audit-logged
  (`connect.invite.minted`).
- **Isolation proof (`SEC-SOVEREIGN-ISOLATION-01`):** `lib/region-isolation.ts` composes the
  per-row `assertSameRegion` guard into a reproducible batch `IsolationProof` (in-region vs leaked,
  region + tenant facets, bounded non-PII leak sample, `pass = leakedCount === 0 &&
  crossTenantCount === 0`). This is the evidence artifact Pentest #6 (run S95–S96) and the S97
  scale proof assert against — isolation as a test output, not a hope. Plus a fail-safe
  `filterToRegion` and a region-scoped SQL fragment for defence in depth.
- **LEARN instructor analytics (`FE-LEARN-INSTRUCTOR-01`):** `lib/learn-instructor-analytics.ts`
  derives score distribution (deciles), summary stats (avg/median/pass-rate), and per-question
  difficulty (1 − facility) from the LEARN-SCORING cohort, plus a formula-injection-safe CSV
  (ids only, no PII). `POST /api/learn/instructor/analytics` (`format: 'json' | 'csv'`).
- **v6.2 i18n tail:** new `learn` + `sovereign` i18n namespaces across all 5 locales
  (EN/NL/ES/DE/FR), with locale-correct regulatory terms (DE *Datenschutzerklärung*, NL
  *Verwerkingsregister*). Pre-existing `ideate.board.*` locale gaps and a launchpad non-keyed
  literal were also cleared so the i18n gate is fully green.

**Release: v6.2 GA** (PULSE, LEARN, SOVEREIGN+). Platform RELEASES bumps **`6.2.0-dev` →
`6.2.0`** (GA cut at S95 per plan); v7.0-rc is S97.

**Quality gates:** `tsc --noEmit` clean · Vitest **1990 passed (243 files)** · `npm run build`
green · `check:i18n` green.

## Delivered

| Story | Pri | Status | Evidence |
|-------|-----|--------|----------|
| ADR-0062 federation trust & isolation model (`CONNECT-00`) | P0 | ✅ | `knowledge-base/adr/ADR-0062-federation-trust-isolation-model.md` |
| `CONNECT-INVITE-01` | P0 | ✅ | `lib/connect-invite.ts` + `POST /api/federation/connect/invites`; audit `connect.invite.minted` |
| `SEC-SOVEREIGN-ISOLATION-01` | P0 | ✅ | `lib/region-isolation.ts` (`IsolationProof` harness + fail-safe filter) |
| `FE-LEARN-INSTRUCTOR-01` (backend + data contract) | P1 | ✅ | `lib/learn-instructor-analytics.ts` + `POST /api/learn/instructor/analytics` |
| `I18N-LEARN-01` | P1 | ✅ | `public/locales/*/learn.json` (5 locales) |
| `I18N-SOVEREIGN-01` | P1 | ✅ | `public/locales/*/sovereign.json` (5 locales) |
| `SOVEREIGN-I18N-01` | P1 | ✅ | `sovereign.json` `regional.notice` — DE/NL regulatory terms |

**Tests added (+34 cases):** `connect-invite.test.ts` (TTL clamp, mint/verify round-trip,
sovereign-mint refusal, signature/expiry/malformed failures, tenant admission),
`region-isolation.test.ts` (region + tenant leak detection, fail-safe filter, sample bounding,
SQL fragment), `learn-instructor-analytics.test.ts` (distribution, summary, difficulty,
hardest/easiest, CSV injection guard).

## Exit-criteria status

- [x] Federation is invite-gated (scoped, TTL ≤ 30d, signed); no open-join path exists.
- [x] Sovereign exclusion enforced at mint (typed violation, never a token); audit-logged.
- [x] Cross-region/cross-tenant isolation is a reproducible proof artifact (`leakedCount === 0`).
- [x] Instructor analytics derive distribution + difficulty + pass-rate; CSV is formula-safe, ids-only.
- [x] v6.2 i18n carry-forwards complete in 5 locales with locale-correct regulatory terms.
- [x] ADR-0062 accepted → CONNECT build (S96) and Pentest #6 federation scope open.

## Carry-forwards → S96 (Federation + authoring build, Pentest #6 run)

- `CONNECT-JOIN-01`, `CONNECT-ZEROK-01`, `CONNECT-ISOLATION-01` (P0) — multi-tenant join; ZK across
  tenants; isolation. Join path must re-check the **invitee** with `assertFederationAllowed` and AND
  `FEDERATION_ELIGIBLE_SQL_FRAGMENT` + `regionScopedSqlFragment` into the query.
- `CONNECT-SOVEREIGN-01` (P0) — hard sovereign-exclusion D1 constraint (third enforcement layer).
- `CONNECT-AUDIT-01` (P1) — federation audit + `jti`-keyed **invite revocation** (the one gap ADR-0062
  defers from S95; required before CONNECT GA).
- `STUDIO-00` (ADR-0060), `STUDIO-COPILOT-01`, `STUDIO-THEME-01` (P0) — authoring co-pilot.
- **FE:** the LEARN instructor screen consuming `POST /api/learn/instructor/analytics` +
  `learn`/`sovereign` i18n namespaces (data contract + strings shipped this sprint).
- **DevOps:** provision `CONNECT_INVITE_SECRET` (prod + staging) before federation invites enable for
  pilots; confirm `SOVEREIGN_AUDIT_SIGNING_KEY` (S94 carry-forward) provisioned.

## Quality gates line

`tsc --noEmit` clean · Vitest 1990 passed (243 files) · `npm run build` green · `check:i18n` green.
