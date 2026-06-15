---
id: SPRINT93_EXECUTION
type: release
domain: product
category: sprint-closeout
status: active
version: 1.0
created: 2026-07-31
updated: 2026-07-31
tags:
  - sprint-93
  - v6.2-dev
  - copilot
  - pulse
  - learn
  - sovereign
  - adr-0058
relates_to:
  - SPRINT85_99_PLAN
  - SPRINT92_EXECUTION
  - ADR-0058-vertical-packaging-tenant-config
  - ADR-0056-agentic-maturity-l2-copilot
  - ADR-0057-pulse-analytics-data-model
  - BACKLOG_MASTER
---

# Sprint 93 — Execution Summary

_Goal (per [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) §S93): **v6.1 RC close +
LEARN/SOVEREIGN open.** Complete COPILOT GA (approval-gated broadcast + sandbox hardening),
finish PULSE governance (aggregation audit log), and open the LEARN + SOVEREIGN+ verticals on
the config-as-data tenant surface (ADR-0058). P0 anchors: `COPILOT-CHECKPOINT-01`,
`LEARN-LTI-01`, `SOVEREIGN-REGIONS-01`._

## Outcome

Sprint 93 ships the **full S93 P0 set** and accepts **ADR-0058** (vertical packaging & tenant
config surface). It opens the v6.2 development line; GA lands at S95 per plan.

- **COPILOT GA (checkpoint + sandbox):** L2 plan steps now broadcast to the room **only** on
  explicit facilitator approval, and only after the `SEC-COPILOT-SANDBOX-01` gate passes
  (read-only whitelisted tool · same-session context · PII-safe output). New `copilot_checkpoint`
  server message (additive on protocol v3, no version bump) + DO `/copilot/checkpoint` fan-out.
- **PULSE governance:** every aggregation read (summary / trends) is logged to a DPO-readable
  `pulse_query_audit` table — actor, cohort size, masked-row count, window, timestamp — with a
  team-owner-only export endpoint.
- **SOVEREIGN+ open:** config-as-data region registry (`eu-001`/`uk-001`/`ca-001`) with a hard
  `assertSameRegion` no-cross-region-leak boundary, region-namespaced KV keys, and a public
  `GET /api/platform/regions` catalog.
- **LEARN open:** LTI 1.1 consumer (`POST /api/learn/lti/launch`) authenticated by OAuth 1.0a
  HMAC-SHA1 signature (fail-closed when unconfigured), plus the LEARN-00 EMBED traction gate
  (`GET /api/admin/learn/gate`).

Platform RELEASES advances to **`6.2.0-dev` (sprint 93)**; current GA remains `6.1.0`.

**Quality gates:** `tsc --noEmit` clean · Vitest **1848 passed (224 files)** · `npm run build` green.

## Delivered

| Story | Pri | Status | Evidence |
|-------|-----|--------|----------|
| ADR-0058 vertical packaging & tenant config | P0 | ✅ | `knowledge-base/adr/ADR-0058-vertical-packaging-tenant-config.md` |
| `COPILOT-CHECKPOINT-01` | P0 | ✅ | `lib/copilot-checkpoint.ts`; PATCH plan-step approval broadcast; DO `/copilot/checkpoint`; `copilot_checkpoint` server msg |
| `SEC-COPILOT-SANDBOX-01` | P0 | ✅ | `lib/copilot-sandbox.ts` (whitelist + same-session + PII gate); wired into approval path |
| `PULSE-AUDIT-01` | P0 | ✅ | `migrations/0058_pulse_query_audit.sql`, `lib/pulse-audit.ts`, pulse summary/trends wiring + `GET /teams/:id/pulse/audit` |
| `SOVEREIGN-00` | P0 | ✅ | `lib/region-residency.ts` `assertSameRegion` hard boundary (architect + DPO sign-off in ADR-0058) |
| `SOVEREIGN-REGIONS-01` | P0 | ✅ | region registry (eu/uk/ca) + `regionKvKey` namespacing + `GET /api/platform/regions` |
| `LEARN-00` | P0 | ✅ | `lib/learn-gate.ts` + `GET /api/admin/learn/gate` |
| `LEARN-LTI-01` | P0 | ✅ | `lib/lti.ts` (OAuth1 HMAC-SHA1 verify) + `POST /api/learn/lti/launch` |
| Platform 6.2.0-dev | P0 | ✅ | `routes/platform.ts` RELEASES += `6.2.0-dev` sprint 93 |

**Tests added:** `region-residency.test.ts`, `lti.test.ts`, `learn-gate.test.ts`,
`copilot-sandbox.test.ts`, `copilot-checkpoint.test.ts`, `pulse-audit.test.ts` (+32 cases).

## Exit-criteria status

- [x] L2 plan step broadcasts **only** after explicit facilitator approval; dismissed/pending never broadcast.
- [x] Sandbox gate blocks mutating/cross-session tools and PII-bearing output before broadcast.
- [x] Every PULSE aggregation read logged; DPO-readable export (team-owner only).
- [x] Region residency boundary denies cross-region access; KV keys namespaced per region.
- [x] LTI launch verified by OAuth1 signature; fail-closed (503) when unconfigured.
- [x] EMBED traction gate has no "proceed anyway" path.
- [x] Platform RELEASES → `6.2.0-dev`.

## Carry-forwards → S94

- `PULSE-AI-NARRATION-01` (P1) — Workers-AI trend narration (eval-gated; defer per AI eval gate REV-10).
- `FE-PULSE-DASHBOARD-01`, `FE-COPILOT-PANEL-01` (P1) — HR dashboard + co-pilot side panel UI.
- `LEARN-GRADE-01`/`LEARN-SCORING-01`, `SOVEREIGN-AUDIT-API-01`/`SOVEREIGN-EXCLUSION-01` (S94 P0).
- DevOps: provision `LTI_CONSUMER_KEY`/`LTI_CONSUMER_SECRET` (prod + staging) and per-region
  Worker/KV bindings (SOVEREIGN-REGIONS-01 physical follow-up); run `migrations/0058`.

## Quality gates line

`tsc --noEmit` clean · Vitest 1848 passed · `npm run build` green.
