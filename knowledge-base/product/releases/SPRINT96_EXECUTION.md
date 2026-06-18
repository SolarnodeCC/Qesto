---
id: SPRINT96_EXECUTION
type: release
domain: product
category: sprint-closeout
status: active
version: 1.0
created: 2026-09-11
updated: 2026-09-11
tags:
  - sprint-96
  - connect
  - federation
  - studio
  - authoring
  - pentest-6
  - adr-0060
  - adr-0062
relates_to:
  - SPRINT85_99_PLAN
  - SPRINT91_99_STORIES
  - SPRINT95_EXECUTION
  - ADR-0062-federation-trust-isolation-model
  - ADR-0060-analytics-insight-intelligence
  - BACKLOG_MASTER
---

# Sprint 96 — Execution Summary

_Goal (per [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) §S96): **Federation + authoring
build (Pentest #6 run).** Build the CONNECT multi-tenant join behind the S95 trust gates
(ADR-0062) and stand up the STUDIO privacy-native authoring co-pilot foundation (ADR-0060). P0
anchors: `CONNECT-JOIN-01`, `STUDIO-COPILOT-01`. CONNECT (data-trust) and STUDIO (AI-output) are
built in the same build sprint but sequenced so their high-risk surfaces don't co-land at the v7.0
RC (S97)._

## Outcome

Sprint 96 lands the **full CONNECT join track** — federated join, federated anonymity, cross-tenant
isolation, the hard sovereign D1 constraint, and invite revocation — plus the **STUDIO authoring
foundation** (ADR-0060 + co-pilot + theme-aware generation). It stays on the v6.2 line; v7.0-rc is
cut at S97 with CONNECT GA after Pentest #6 closes.

### CONNECT track (ADR-0062)

- **`CONNECT-JOIN-01`:** `lib/connect-join.ts` is the pure join verdict composing every gate —
  invite valid (S95 `verifyFederationInvite`), not revoked, invite admits the tenant, **invitee not
  sovereign** (second `assertFederationAllowed` guard — the mint covered the host), **region match**
  (`assertSameRegion` — no cross-border join), and idempotent membership. `POST
  /api/federation/connect/join` verifies the token, re-checks the invitee, persists membership, and
  audit-logs `connect.session.joined`.
- **`CONNECT-ZEROK-01`:** `lib/federation-aggregates.ts` turns raw per-tenant contributions into a
  cross-tenant view that is provably free of participant identifiers (and, under zero-knowledge,
  free of per-tenant attribution). `findIdentityLeak` / `aggregateIsSafe` are the guard the route
  and Pentest #6 assert against before any aggregate is serialised cross-tenant.
- **`CONNECT-ISOLATION-01`:** the join + membership reads are region+tenant scoped, reusing the S95
  `region-isolation` `IsolationProof` harness and `regionScopedSqlFragment`.
- **`CONNECT-SOVEREIGN-01`:** `migrations/0065_connect_federation.sql` adds
  `connect_federation_members` with `is_sovereign INTEGER … CHECK (is_sovereign = 0)` — the **third**
  sovereign-exclusion layer (mint guard, join guard, DB constraint) so an accidental sovereign
  federation is structurally impossible.
- **`CONNECT-AUDIT-01`:** `lib/connect-revocation.ts` closes the one gap ADR-0062 deferred from S95 —
  jti-keyed invite revocation (`POST /api/federation/connect/invites/revoke`, audit
  `connect.invite.revoked`); the join path checks the tombstone before admitting a tenant.

### STUDIO track (ADR-0060)

- **`STUDIO-00` / ADR-0060:** privacy-native AI authoring co-pilot model — Workers AI inference-only
  (no egress), authoring output schema reusing the wizard question schema, CANVAS theme embedding,
  and the eval-gate obligation (REV-10 golden fixtures).
- **`STUDIO-COPILOT-01`:** `lib/studio-authoring.ts` — sanitised prompt builder + validated output
  parsing/confidence (the ai-wizard discipline); `POST /api/studio/authoring/generate` (Workers AI
  only). Prompt-injection input hardening via `lib/ai/prompt-sanitize`.
- **`STUDIO-THEME-01`:** `lib/studio-theme.ts` — generated drafts inherit the selected CANVAS theme
  tokens so previews carry brand styling.
- **AI eval gate (REV-10):** `tests/eval/studio-authoring.eval.test.ts` + golden fixtures keep
  `npm run test:eval` green and cover the authoring output schema (accept good / reject malformed +
  injection).

## Delivered

| Story | Pri | Status | Evidence |
|-------|-----|--------|----------|
| `CONNECT-JOIN-01` | P0 | ✅ | `lib/connect-join.ts` + `POST /api/federation/connect/join`; audit `connect.session.joined` |
| `CONNECT-ZEROK-01` | P0 | ✅ | `lib/federation-aggregates.ts` (aggregates-only + identity-leak guard) |
| `CONNECT-ISOLATION-01` | P0 | ✅ | region+tenant scoping (reuses `lib/region-isolation.ts`, S95) |
| `CONNECT-SOVEREIGN-01` | P0 | ✅ | `migrations/0065_connect_federation.sql` (`CHECK (is_sovereign = 0)`) |
| `CONNECT-AUDIT-01` | P1 | ✅ | `lib/connect-revocation.ts` + `POST /api/federation/connect/invites/revoke` |
| `STUDIO-00` (ADR-0060) | P0 | ✅ | `knowledge-base/adr/ADR-0060-analytics-insight-intelligence.md` |
| `STUDIO-COPILOT-01` | P0 | ✅ | `lib/studio-authoring.ts` + `POST /api/studio/authoring/generate`; eval-gated |
| `STUDIO-THEME-01` | P0 | ✅ | `lib/studio-theme.ts` (CANVAS theme inheritance) |

## Exit-criteria status

- [x] A tenant joins a federated session only via a valid, non-revoked, tenant-matched invite.
- [x] Sovereign exclusion enforced at three layers (mint, join, DB CHECK).
- [x] Federated cross-tenant view exposes aggregates only — no participant identity, ZK-respecting.
- [x] Invite revocation closes the S95 ADR-0062 gap; join checks the tombstone.
- [x] STUDIO co-pilot is Workers-AI-only, output-schema validated, and eval-gated (REV-10).

## Carry-forwards → S97 (v7.0-rc cut, CONNECT GA, Pentest #6 close)

- `QA-CONNECT-SCALE-01` (P0) — 5 tenants × 50k × 100 queries, zero leakage (uses the `IsolationProof`
  + `aggregateIsSafe` harnesses as the measurement instruments).
- `SEC-STUDIO-PROMPT-01` (P0) — prompt-injection hardening (Pentest #6 AI-safety scope).
- `FE-CONNECT-JOIN-UI-01`, `STUDIO-LIBRARY-01`, `STUDIO-SUGGEST-01`, `FE-STUDIO-AUTHORING-01` (P1).
- **DevOps:** `CONNECT_INVITE_SECRET` (prod + staging); apply migration `0065`.

## Quality gates line

`tsc --noEmit` clean · Vitest green · `npm run test:eval` green · `npm run build` green · `check:i18n` green.
