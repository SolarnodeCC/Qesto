---
id: SPRINT94_EXECUTION
type: release
domain: product
category: sprint-closeout
status: active
version: 1.0
created: 2026-08-14
updated: 2026-08-14
tags:
  - sprint-94
  - v6.2-dev
  - learn
  - sovereign
  - egress-governance
  - adr-0059
relates_to:
  - SPRINT85_99_PLAN
  - SPRINT93_EXECUTION
  - ADR-0059-ecosystem-egress-governance
  - ADR-0058-vertical-packaging-tenant-config
  - BACKLOG_MASTER
---

# Sprint 94 — Execution Summary

_Goal (per [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) §S94): **Verticals build +
Pentest #6 prep.** Build the LEARN assessment engine (scoring + LMS grade passback) and the
SOVEREIGN+ exclusion + verifiable audit surfaces on the config-as-data tenant model (ADR-0058),
and open Pentest #6 prep by accepting the egress-governance ADR. P0 anchors:
`LEARN-GRADE-01`, `SOVEREIGN-EXCLUSION-01`._

## Outcome

Sprint 94 ships the **full S94 P0 set plus both P1 backend slices** and accepts **ADR-0059**
(ecosystem depth — extension data contracts + partner egress governance). It stays on the v6.2
development line; GA lands at S95 per plan.

- **LEARN assessment engine (`LEARN-SCORING-01`):** pure per-question weighting, all-or-nothing
  vs. proportional partial credit, and linear/bell curve application — one calculation shared by
  the close handler, instructor preview, and grade passback.
- **LEARN grade passback (`LEARN-GRADE-01`):** LTI Basic Outcomes 1.1 `replaceResultRequest`
  POX, signed with OAuth 1.0a **body-hash** (reusing `lib/lti.ts` primitives), POSTed to the
  LMS outcomes endpoint. `POST /api/learn/grade-passback`; every attempt audit-logged
  (`learn.grade.passback`) — the score leaves the boundary, so it is traceable.
- **SOVEREIGN-tier exclusion (`SOVEREIGN-EXCLUSION-01`):** a single pure boundary
  (`assertFederationAllowed` / `assertEgressAllowed`) plus a federation-eligibility SQL fragment
  that structurally excludes sovereign tenants at the query layer. Drives the S95 CONNECT join.
- **Verifiable audit export (`SOVEREIGN-AUDIT-API-01`):** SHA-256 hash chain + HMAC-SHA256
  provenance signature; tamper/reorder/graft all break verification. `GET
  /api/teams/:id/sovereign/audit/export` (team-owner only; 503 fail-closed without signing key).
- **P1 backend:** L&D template gallery (`LEARN-TEMPLATES-01`, `GET /api/learn/templates`) and the
  compliance posture matrix (`SOVEREIGN-POSTURE-01`, `GET /api/teams/:id/sovereign/posture`).

Platform RELEASES stays at **`6.2.0-dev`** (S93); v6.2 GA is S95 per plan — no version bump.

**Quality gates:** `tsc --noEmit` clean · Vitest **1946 passed (237 files)** · `npm run build` green.

## Delivered

| Story | Pri | Status | Evidence |
|-------|-----|--------|----------|
| ADR-0059 ecosystem egress governance | P0 | ✅ | `knowledge-base/adr/ADR-0059-ecosystem-egress-governance.md` |
| `LEARN-SCORING-01` | P0 | ✅ | `lib/learn-scoring.ts` (weights, partial credit, curves) |
| `LEARN-GRADE-01` | P0 | ✅ | `lib/lms-grade-passback.ts` + `POST /api/learn/grade-passback`; audit `learn.grade.passback` |
| `SOVEREIGN-EXCLUSION-01` | P0 | ✅ | `lib/sovereign-exclusion.ts` + `GET .../sovereign/federation-eligibility` |
| `SOVEREIGN-AUDIT-API-01` | P0 | ✅ | `lib/sovereign-audit-export.ts` + `GET .../sovereign/audit/export`; audit `sovereign.audit.export` |
| `LEARN-TEMPLATES-01` | P1 | ✅ | `lib/learn-templates.ts` + `GET /api/learn/templates` |
| `SOVEREIGN-POSTURE-01` | P1 | ✅ | `lib/sovereign-posture.ts` + `GET .../sovereign/posture` |

**Tests added (+48 cases):** `learn-scoring.test.ts`, `lms-grade-passback.test.ts`,
`sovereign-exclusion.test.ts`, `sovereign-audit-export.test.ts`, `learn-templates.test.ts`,
`sovereign-posture.test.ts`.

**Config-as-data (ADR-0058):** `Team` gains optional `regionId` / `isSovereign` /
`fedrampModerate` (backward compatible — absent ⇒ default `eu-001`, not sovereign).

## Exit-criteria status

- [x] Assessment scoring supports per-question weights, partial credit, and curves (pure + tested).
- [x] Grade passback signs the POX body (OAuth1 body-hash) and audit-logs every attempt.
- [x] Sovereign tenants are denied federation + partner egress at both app and query layers.
- [x] Audit export is tamper-evident (hash chain) and provenance-signed (HMAC); fail-closed (503) without key.
- [x] Posture matrix derives claims from enforced config, not hand-maintained marketing copy.
- [x] ADR-0059 accepted → Pentest #6 egress-governance scope open.

## Carry-forwards → S95 (v6.2 GA)

- `SEC-SOVEREIGN-ISOLATION-01` (P0) — cross-region isolation proof (Pentest #6 run).
- `CONNECT-00` (ADR-0062) + `CONNECT-INVITE-01` (P0) — federation trust model; CONNECT join must
  call `assertFederationAllowed` (ADR-0059).
- `FE-LEARN-INSTRUCTOR-01`, `SOVEREIGN-I18N-01`, `I18N-LEARN-01`, `I18N-SOVEREIGN-01` (P1) —
  instructor analytics + regional compliance i18n.
- **DevOps:** provision `SOVEREIGN_AUDIT_SIGNING_KEY` (prod + staging); confirm
  `LTI_CONSUMER_KEY`/`LTI_CONSUMER_SECRET` provisioned (S93 carry-forward) before grade passback
  is enabled for pilots.

## Quality gates line

`tsc --noEmit` clean · Vitest 1946 passed · `npm run build` green.
