---
id: SPRINT97_EXECUTION
type: release
domain: product
category: sprint-closeout
status: active
version: 1.0
created: 2026-09-25
updated: 2026-09-25
tags:
  - sprint-97
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
  - SPRINT96_EXECUTION
  - ADR-0062-federation-trust-isolation-model
  - ADR-0060-analytics-insight-intelligence
  - BACKLOG_MASTER
---

# Sprint 97 — Execution Plan

_Goal (per [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) §S97 / [`SPRINT91_99_STORIES.md`](../planning/SPRINT91_99_STORIES.md)): **v7.0-rc cut — CONNECT GA + Pentest #6 close.** Close out the S96 carry-forwards: scale/isolation proof for federation, prompt-injection hardening for STUDIO, and the P1 frontend/library/suggestion surfaces that complete the user-facing half of both epics._

## Scope (carried from SPRINT96_EXECUTION.md §Carry-forwards)

| ID | Pts | Pri | Notes |
|----|-----|-----|-------|
| `QA-CONNECT-SCALE-01` | 8 | P0 | 5 tenants × 50k participants × 100 queries, zero cross-tenant leakage — built on the existing `IsolationProof` + `aggregateIsSafe` harnesses |
| `SEC-STUDIO-PROMPT-01` | 8 | P0 | Prompt-injection hardening for STUDIO authoring (Pentest #6 AI-safety scope) |
| `FE-CONNECT-JOIN-UI-01` | 13 | P1 | Federation UI: accept invite, view co-tenant aggregate stats (anonymized — "3 organizations joined", never names) |
| `STUDIO-LIBRARY-01` | 13 | P1 | Content library: save authored questions, remix/fork, usage tracking |
| `STUDIO-SUGGEST-01` | 8 | P1 | Next-question suggestions in the authoring surface via `DECISIONS_VECTORIZE` semantic match |
| `FE-STUDIO-AUTHORING-01` | 13 | P1 | Authoring UI: prompt input, theme selector, draft preview + edit, apply-to-session |
| `I18N-CONNECT-01` | 3 | P1 | Federation labels + isolation warnings in 5 locales |

**Total:** 66 pts (2 P0 / 5 P1). Release: **v7.0-rc cut**. Gate: Pentest #6 crit/high = 0; tenant-isolation proof evidence (ADR-0062 §3/§5).

**Out of scope for S97** (explicitly deferred): `I18N-STUDIO-01` (locale parity for the authoring UI — bundled into the frontend story's i18n keys directly rather than a separate pass since the UI is new this sprint), STUDIO public cross-tenant library sharing (fork is same-tenant only this sprint; cross-tenant fork is gated on CONNECT GA being closed first), XR-00 (S98).

## Build sequencing

1. **Backend/security in parallel** (no shared file ownership):
   - `qesto-backend`: `STUDIO-LIBRARY-01` (D1 migration + save/list/fork routes) + `QA-CONNECT-SCALE-01` (scale/isolation proof harness + evidence doc).
   - `qesto-security`: `SEC-STUDIO-PROMPT-01` (harden `lib/studio-authoring.ts` + `lib/ai/prompt-sanitize`, expand eval fixtures, security review doc).
   - `qesto-ai-engineer`: `STUDIO-SUGGEST-01` (new `lib/studio-suggest.ts` using `DECISIONS_VECTORIZE`, route, eval coverage).
2. **Frontend** (depends on the above APIs): `qesto-frontend` builds `FE-CONNECT-JOIN-UI-01`, `FE-STUDIO-AUTHORING-01`, and the library UI for `STUDIO-LIBRARY-01`.
3. **i18n**: `qesto-i18n` adds `connect.json` (5 locales) for `I18N-CONNECT-01` plus the studio-authoring UI strings the frontend story introduces.
4. **Verification**: `tsc --noEmit`, `npm test`, `npm run test:eval`, `npm run check:i18n`, `npm run build` all green before merge.

## Exit criteria

- [x] 5-tenant × 50k × 100-query scale run produces zero cross-tenant rows (evidence doc committed).
- [x] STUDIO authoring rejects/neutralizes prompt-injection payloads in expanded eval corpus; Pentest #6 AI-safety scope closed.
- [ ] A participant can accept a federation invite and join via UI; co-tenant stats show counts only, never tenant/participant identity.
- [ ] An operator can save, list, and fork an authored question; fork creates an independent, editable copy.
- [ ] After authoring question 1, the UI offers a semantically related question 2 suggestion.
- [ ] An operator can drive the full authoring flow (prompt → theme → preview/edit → apply to session) from the UI.
- [ ] Federation UI strings present in EN/NL/ES/DE/FR; `check:i18n` green.

## Quality gates line

`tsc --noEmit` clean · Vitest green · `npm run test:eval` green · `npm run build` green · `check:i18n` green.
