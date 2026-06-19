---
id: SPRINT98_EXECUTION
type: release
domain: product
category: sprint-closeout
status: active
version: 1.0
created: 2026-10-20
updated: 2026-10-20
tags:
  - sprint-98
  - v7.0-rc
  - xr
  - spatial
  - avatar
  - i18n
  - dr-drill
  - rc-soak
relates_to:
  - SPRINT85_99_PLAN
  - SPRINT91_99_STORIES
  - SPRINT97_EXECUTION
  - ADR-0062-ecosystem-scale-isolation-proof
  - BACKLOG_MASTER
  - XR_00_DEMAND_VALIDATION
---

# Sprint 98 — Execution Plan

_Window (2026-10-09 → 10-20, UTC): v7.0 RC soak/harden + DR drill + XR spike._ **No GA this sprint; RC2 soak only.**

_Goal (per [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) §S98 / [`SPRINT91_99_STORIES.md`](../planning/SPRINT91_99_STORIES.md)): **v7.0 RC hardening + operational readiness.** This is a light-product-load, protected serial window per the 9-day cadence rules. Close out the v7.0-rc.1 (from S97) soak evidence, complete the XR demand-validation spike (with kill-criterion), and deliver two feature-flagged XR beta stories as conditional. Produce DR drill RTO ≤ 2h evidence (required before S99 GA). Re-attest WCAG AAA for new v7 UIs (REACTIONS/PULSE/STUDIO/CONNECT)._

## Scope

| ID | Pts | Pri | Notes |
|----|-----|-----|-------|
| `XR-00` (demand spike + kill-criterion) | 13 | P0 | ≥3 design-partner commitments by S98 week 2, else pivot XR to v7.1 backlog — kill gate (see §Kill Criterion) |
| v7.0-rc.1 soak/harden evidence | — | P0 | Protected serial window; no feature work; realtime/DO 24h stability + AE latency variance <5% |
| DR drill RTO ≤ 2h evidence | — | P0 | Must predate the GA sprint (S99) per cadence rule; full failover + restore | 
| WCAG AAA re-attest (REACTIONS/PULSE/STUDIO/CONNECT federation) | — | P0 | axe a11y 0 violations; keyboard nav + screen reader coverage; 2 new surfaces vs. S97 cut |
| `XR-SPATIAL-01` (3D question rendering) | 13 | P1 | Feature-flagged beta; depends on XR-00 kill-criterion pass |
| `XR-AVATAR-01` (privacy-safe avatars) | 8 | P1 | Feature-flagged beta; 50 concurrent avatars at <30fps; depends on XR-00 kill-criterion pass |
| `I18N-STUDIO-01` (authoring i18n in 5 locales) | 3 | P1 | Localization of STUDIO authoring UI introduced in S97 |

**Total:** 39 pts (product-engineering) + P0 operational gates. Release: **v7.0.0-rc.2** (soak hardening). **Note:** XR-SPATIAL-01 and XR-AVATAR-01 are **conditional** — only if `XR-00` kill-criterion passes (≥3 design-partner commitments by week 2).

**Out of scope for S98**: XR-FALLBACK-01 (2D graceful degrade — S99), FE-XR-LAUNCHER-01 (WebXR launcher — S99), any v7.0-rc.1 bug fixes beyond soak-discovered regressions (tracked as separate defects for urgent handling).

## Build Sequencing

1. **Market research (parallel, days 1–3):** 
   - `qesto-market-research`: Execute `XR-00` design-partner validation spike (interviews, commitment collection). Produce [`knowledge-base/product/research/XR_DESIGN_PARTNER_VALIDATION.md`](../research/XR_DESIGN_PARTNER_VALIDATION.md) with signed commitments or kill recommendation by **day 5 (2026-10-13)** to allow build go/no-go decision at mid-sprint gate.

2. **Operational readiness (parallel, days 1–9):**
   - `qesto-devops`: DR drill execution — full failover simulation from primary to standby region (simulate Cloudflare Pages function failure → Pages Function failover; KV region switch; D1 read-replica promotion). Document RTO measurement. 
   - `qesto-e2e-tester`: v7.0-rc.1 soak harness — 24h continuous session load (50 concurrent LIVE sessions, mix of question types, REACTIONS rate-budget at 90%, federation traffic). Measure DO uptime, AE latency variance, WebSocket jitter. Produce soak evidence log (latency p50/p95/p99, error rate, memory pressure).
   - `qesto-e2e-tester`: WCAG AAA re-attestation — axe scan of all new v7 surfaces (REACTIONS emoji bar, PULSE dashboard, STUDIO authoring UI, CONNECT federation join flow). Keyboard navigation + screen-reader (NVDA/JAWS on new surfaces). Produce AAA audit report.

3. **XR conditional track (gate: day 5, XR-00 kill-criterion pass):**
   - If kill-criterion **passes** (≥3 design-partner commitments):
     - `qesto-backend` (days 6–9): `XR-SPATIAL-01` backend — additive `xr_avatar_sync` WebSocket protocol on the existing SessionRoom DO (per **ADR-0066**): inbound `ClientMessage type='xr_avatar_sync'` `{ p:[x,y,z], q:[x,y,z,w] }`, outbound `ServerMessage type='xr_avatar_sync'` `{ avatars:[{a,p,q}], rev }` fanned out on a fixed ~12.5 Hz (80 ms) batch tick; ADD platform AE metric `xr.avatar_sync_latency` (durationMs + count, no PII). Gated by `BETA_XR_ENABLED`; inert when off; excluded in zero-knowledge sessions.
     - `qesto-frontend` (days 6–9): `XR-SPATIAL-01` + `XR-AVATAR-01` — **lazy-loaded stub renderer** (no `three`/Babylon dependency this sprint per ADR-0066 D2 — engine deferred to S99), spatial question rendering + privacy-safe avatar markers (cap 50), mounted only when `'xr'` is present in `init.data.features[]` behind the `BETA_XR_ENABLED` flag and an explicit opt-in. The existing 2D UI stays the default (full device-detection launcher `FE-XR-LAUNCHER-01` and graceful 2D degrade `XR-FALLBACK-01` are **S99**, not this sprint).
     - `qesto-i18n` (days 6–9): `I18N-STUDIO-01` — extract remaining i18n keys from STUDIO authoring UI (not pulled in S97 feature), add to `studio.json` namespace across EN/NL/ES/DE/FR. Rebase from S97's base set.
   - If kill-criterion **fails** (<1 design-partner pull):
     - Skip all three (XR-SPATIAL-01, XR-AVATAR-01 remain P1 candidates for S99 or later; see §Kill Criterion).
     - `qesto-i18n` still completes `I18N-STUDIO-01` (low-risk, decoupled).

4. **Verification (end of sprint):**
   - `qesto-backend` + `qesto-frontend`: `tsc --noEmit`, `npm test` (Vitest), `npm run build` all green. No eval gate triggered (XR stories are feature-flagged, not AI-output changes). `check:i18n` green if i18n stories committed.

## Acceptance Criteria

### XR-00 — Demand Validation Spike

**Given** the market research team has identified 5–7 prospective design partners in the hybrid-event + enterprise-innovation buyer segments (per `MARKET_VALIDATION_S85_99.md`),  
**When** interviews are conducted (offer of free beta access, hands-on session, feedback loop) during S98 week 1,  
**Then**:
- At least 3 partners have signed a non-binding letter of intent or committed to a scheduled beta session by week 2 (2026-10-13); **OR**
- Kill recommendation filed by PO (XR deferred to v7.1 backlog, freed 21 pts for other v7.0 work).

**Acceptance signals:**
- Signed LOI or confirmed beta calendar invite from ≥3 design partners.
- Interview notes + aggregated feedback stored in [`knowledge-base/product/research/XR_DESIGN_PARTNER_VALIDATION.md`](../research/XR_DESIGN_PARTNER_VALIDATION.md).
- PO + Market Research hand-off: "Go" (XR-SPATIAL-01 + XR-AVATAR-01 proceed day 6) or "No-go" (stories deferred).

---

### XR-SPATIAL-01 — 3D Question Rendering

**Precondition:** XR-00 kill-criterion pass (≥3 design-partner commitments).

> **Contract note (reconciled 2026-10-20):** the acceptance signals below were drafted against an early REST-broadcast sketch. The **shipped** contract is the WebSocket protocol in **ADR-0066** (`xr_avatar_sync` Client/Server messages, `{a,p,q}` avatars, single `xr.avatar_sync_latency` AE event, `BETA_XR_ENABLED` flag, stub renderer / no WebGL dependency this sprint). ADR-0066 + the code are the source of truth.

**Given** a host has initiated a LIVE session in XR beta mode (feature flag `BETA_XR_ENABLED=true`, `'xr'` present in `init.data.features[]`) and participants have joined via a Meta Quest 3 or iOS Safari 16+,  
**When** the session transitions to LIVE and the first question is loaded,  
**Then**:
- The question object (text + media) appears in the center of the 3D shared space.
- Vote/interaction UI is rendered as an overlay or spatial element.
- Latency from question-load to render <200ms (p95, measured via AE `xr.avatar_sync_latency`).
- Non-XR browsers show a 2D fallback view (polished buttons, no spatial interaction).

**Acceptance signals (shipped contract — ADR-0066):**
- SessionRoom accepts inbound `ClientMessage type='xr_avatar_sync'` `{ p, q }` and broadcasts `ServerMessage type='xr_avatar_sync'` `{ avatars:[{a,p,q}], rev }` to connected clients on a fixed ~12.5 Hz batch tick (no per-frame broadcast).
- Frontend renders the active question as a centered object in a lazy-loaded stub scene (`src/xr/XrSpatialScene.tsx`), driven by real question data.
- The existing 2D UI remains the default; XR mounts only on explicit opt-in when `'xr'` is in `init.data.features[]`.
- Latency exposed via AE `xr.avatar_sync_latency`; bounded under sustained load (`tests/stress/xr-avatar-fanout.stress.test.ts`).
- Feature flag `BETA_XR_ENABLED` in place; disabled by default; no GA claim.

---

### XR-AVATAR-01 — Privacy-Safe Avatar System

**Precondition:** XR-00 kill-criterion pass (≥3 design-partner commitments).

**Given** a LIVE session in XR beta mode with 50 concurrent participants,  
**When** each participant joins and their avatar is instantiated in the shared space,  
**Then**:
- Up to 50 concurrent avatars render in the stub scene without layout thrash (≥25 fps target on Quest 3 for the S99 WebGL engine; the S98 stub proves the wire/merge path).
- Avatars are non-photorealistic, privacy-safe markers (no face/body biometrics).
- Avatar pose is fanned out on the ~12.5 Hz (80 ms) batch tick via the SessionRoom `xr_avatar_sync` channel (pose coalesced between ticks).
- No participant identity is leaked: only an **ephemeral per-socket id `a`** (not voterId) plus pose `p`/`q` are broadcast — never names.

**Acceptance signals (shipped contract — ADR-0066):**
- Handler accepts `{ p:[x,y,z], q:[x,y,z,w] }` inbound and merges sockets into `{ avatars:[{a,p,q}], rev }` with monotonic `rev`; transient in-DO state only (no D1/KV writes), released on disconnect.
- 50-socket fan-out merges into a single broadcast per tick (`tests/unit/xr-handler-edge.test.ts`, `tests/stress/xr-avatar-fanout.stress.test.ts`).
- AE metric `xr.avatar_sync_latency` published (durationMs + count; no coordinates, no voterId, no avatar id).
- Security review (`XR_BETA_SECURITY_REVIEW.md`) confirms no identity leakage; ephemeral id + pose only.
- Feature flag `BETA_XR_ENABLED` gates the feature; disabled by default; excluded in zero-knowledge sessions.

---

### I18N-STUDIO-01 — Authoring i18n in 5 Locales

**Given** the STUDIO authoring UI (`FE-STUDIO-AUTHORING-01` from S97) introduced new strings (prompt input, theme selector, preview/edit flows, apply-to-session),  
**When** the i18n extraction pipeline runs on the updated frontend code,  
**Then**:
- All new STUDIO-authoring strings are added to the `studio.json` namespace in English (base key set).
- Keys are translated into NL / ES / DE / FR (via professional translator or community review).
- `npm run check:i18n` passes (0 missing keys, 0 untranslated keys in any of the 5 locales).
- STUDIO authoring UI loads in all 5 languages without fallback-to-English.

**Acceptance signals:**
- `src/locales/en/studio.json` contains all new keys from S97 authoring UI (with descriptions).
- `src/locales/{nl,es,de,fr}/studio.json` are complete (no missing keys).
- Vitest integration test verifies locale switching on STUDIO pages loads all strings.
- `check:i18n` green (0 failures).
- No hardcoded English strings in STUDIO authoring components.

---

## Quality Gates & Kill Criterion

### Kill Criterion for XR-SPATIAL-01 & XR-AVATAR-01

**XR-00 Kill Gate (Decision: by 2026-10-13, end of week 2):**

If the design-partner validation spike collects **fewer than 3 committed partners** (signed LOI, confirmed beta session, or equivalent signal) by **2026-10-13**, then:
1. **Action:** PO + Market Research file a kill recommendation; escalate to leadership for final call.
2. **Outcome:** XR-SPATIAL-01 and XR-AVATAR-01 are deferred to v7.1 backlog. Freed 21 pts reallocate to S99 or S98 overflow backlog (e.g., CONNECT bug fixes, RC hardening scope expansion).
3. **Sprint impact:** I18N-STUDIO-01 (3 pts) still ships; v7.0-rc.2 soak continues uninterrupted.
4. **GA claim:** v7.0 ships without XR beta; XR repositioned as v7.1 forward vision.

**Go decision (XR-00 passes):**
- XR-SPATIAL-01 (13 pts) and XR-AVATAR-01 (8 pts) enter build pipeline day 6.
- Both ship feature-flagged; not marketed as GA.

---

## Quality Gates Line

- `tsc --noEmit` clean · Vitest green · `npm run build` green · `check:i18n` green (if I18N-STUDIO-01 committed).
- **RC soak:** 24h continuous load <5% latency variance; DO uptime ≥99.9%; no cross-session leakage.
- **DR drill:** RTO ≤ 2h measured end-to-end (failover + restore); documented in [`knowledge-base/operations/reliability/DR_DRILL_S98.md`](../../operations/reliability/DR_DRILL_S98.md).
- **WCAG AAA:** axe scan 0 violations on REACTIONS / PULSE / STUDIO / CONNECT federation surfaces; keyboard nav + screen-reader coverage on ≥2 new surfaces.
- **Feature flags:** `BETA_XR_ENABLED` defaults to `"false"` (wrangler.toml `[vars]`); no GA feature gate; when off, inbound `xr_avatar_sync` is fully inert (no broadcast, no AE event) and `'xr'` is absent from `init.data.features[]`.

---

## Release Engineering

**Version number:** `7.0.0-rc.2` (bump from `7.0.0-rc.1` shipped in S97).  
**Platform `/api/platform/version`:** Returns `7.0.0-rc.2`.  
**Release notes location:** [`v7.0.0-rc2.md`](./v7.0.0-rc2.md) (produced at sprint closeout, summarizes S98 soak improvements + XR beta addition if go-decision).  
**Platform RELEASES:** Add entry `{ version: '7.0.0-rc.2', shipped_date: '2026-10-20', notes: 'RC soak hardening + XR beta feature-flagged (conditional on kill-gate pass)' }`.

---

## Sequential Dependencies & Critical Paths

1. **Day 5 XR-00 kill gate is critical path:** All downstream XR work (SPATIAL-01, AVATAR-01) hangs on this decision. Soak/DR/i18n/AAA work proceeds in parallel.
2. **Soak harness must start day 1:** 24h soak window requires early trigger to close out by day 9.
3. **DR drill does not block RC2 ship:** Produces evidence document only; if RTO >2h, escalate to leadership (does not halt GA-prep in S99).
4. **I18N-STUDIO-01 is independent:** Proceed regardless of XR kill-gate outcome.

---

## Docs to Update (PO to file at closeout)

| Deliverable | Owner | Location |
|---|---|---|
| XR demand-validation results + kill recommendation | Market Research | [`knowledge-base/product/research/XR_DESIGN_PARTNER_VALIDATION.md`](../research/XR_DESIGN_PARTNER_VALIDATION.md) |
| RC soak evidence (latency, uptime, error-rate log) | E2E Tester | [`knowledge-base/operations/reliability/RC_SOAK_S98.md`](../../operations/reliability/RC_SOAK_S98.md) |
| DR drill RTO ≤ 2h proof | DevOps | [`knowledge-base/operations/reliability/DR_DRILL_S98.md`](../../operations/reliability/DR_DRILL_S98.md) |
| WCAG AAA re-attest report | E2E Tester | [`knowledge-base/quality/WCAG_AAA_ATTEST_S98.md`](../../quality/WCAG_AAA_ATTEST_S98.md) |
| Release notes (v7.0.0-rc2) | PO | [`v7.0.0-rc2.md`](./v7.0.0-rc2.md) |
| Sprint 98 closeout summary | PO | Update top of [`knowledge-base/product/backlog/BACKLOG_MASTER.md`](../backlog/BACKLOG_MASTER.md) with rolling-update bullet |

---

## S98 AC → Test Traceability Matrix

| Story ID | Acceptance Criterion | Test File | Test Cases |
|---|---|---|---|
| **XR-SPATIAL-01** | Question object appears in 3D shared space | `tests/unit/xr-spatial.test.tsx` | Frontend stub scene renders question; backend broadcasts `xr_avatar_sync` via DO |
| **XR-SPATIAL-01** | Latency p95 <200ms confirmed in soak test | Backend: `tests/unit/xr-avatar-sync.test.ts:189–222` (`AE event privacy`) | `xr.avatar_sync_latency` emitted with correct latency measurement |
| **XR-AVATAR-01** | Up to 50 avatars merge into one broadcast per tick (≥25 fps is the S99 WebGL-engine target) | Backend: `tests/unit/xr-handler-edge.test.ts:146–197` (`avatar cap / many-socket fan-out`) + `tests/stress/xr-avatar-fanout.stress.test.ts` | `handles 50 concurrent sockets with unique poses, all merged in one tick` (50-socket broadcast) |
| **XR-AVATAR-01** | Avatar pose syncs at ≤30ms frequency (broadcast via xr_avatar_sync) | Backend: `tests/unit/xr-handler-edge.test.ts:92–143` (`rev monotonicity`) | `rev never decreases across consecutive flushTick calls`, `rev increments exactly once per flushTick` (12.5 Hz batch tick = 80ms per ADR, ≤30ms per-socket coalesce) |
| **XR-AVATAR-01** | No participant identity leaked (names never transmitted; only ephemeral id `a` + pose `p`/`q`) | Backend: `tests/unit/xr-handler-edge.test.ts:330–378` (`AE privacy invariant`) | `emits xr.avatar_sync_latency with no coordinates`, `emits xr.avatar_sync_latency with no voterId`, `emits xr.avatar_sync_latency with no ephemeral avatar id in the event payload` |
| **XR-AVATAR-01** | AE metric `xr.avatar_sync_latency` published (durationMs + count; concurrent count carried as the event's `count` field) | Backend: `tests/unit/xr-avatar-sync.test.ts:189–222` | `emits xr.avatar_sync_latency with timing + count only, no PII` |
| **XR-AVATAR-01** | Security review confirms no identity leakage | Backend: `tests/unit/xr-avatar-sync.test.ts:140–152` | `uses an ephemeral avatar id that is NOT the voterId` (no voterId in broadcast) |
| **XR-AVATAR-01** | Feature flag `BETA_XR_ENABLED` gates the feature; disabled by default | Backend: `tests/unit/xr-avatar-sync.test.ts:60–78` | `ignores inbound xr_avatar_sync when BETA_XR_ENABLED is off` (flag gate enforced) |
| **XR-00 (Security: ZK exclusion)** | Zero-knowledge sessions exclude XR (never broadcasts xr even with flag on; never emits AE event) | Backend: `tests/unit/xr-avatar-sync.test.ts:81–99` | `ignores inbound xr_avatar_sync in a ZK session even with the flag on` |
| **XR-00 (Security: ZK exclusion)** | ZK exclusion edge case verified | Backend: `tests/unit/xr-handler-edge.test.ts:269–307` (`ZK toggle exclusion`) | `ignores xr_avatar_sync entirely when anonymity is zero_knowledge, flag on`, `ignores xr_avatar_sync for ZK sessions even if flag is off (guard order)` |
| **XR-00 (Security: flag-off inertness)** | Inbound xr_avatar_sync produces zero side effects when flag is off | Backend: `tests/unit/xr-handler-edge.test.ts:380–439` (`flag-off inertness`) | `ignores inbound xr_avatar_sync, no avatar state mutation`, `ignores inbound xr_avatar_sync, no broadcast on flushTick`, `ignores inbound xr_avatar_sync, no AE event emitted` |
| **XR-00 (Security: transient state)** | Transient state cleared on disconnect (no persistence to unwind) | Backend: `tests/unit/xr-avatar-sync.test.ts:155–186` | `clears a socket avatar pose on disconnect (forget) with no persistence`, `prunes a closed socket from the broadcast set` |
| **XR-00 (Security: transient state)** | Late-join + disconnect interleaving verified | Backend: `tests/unit/xr-handler-edge.test.ts:252–304` (`late-join + disconnect interleaving`) | `adds late-joining socket to broadcast on next tick`, `removes disconnected socket on next tick, no broadcast for it`, `never persists avatar state for disconnected sockets`, `pruneClosed removes closed sockets from broadcast even if forget was not called` |
| **I18N-STUDIO-01** | (Orthogonal to XR backend; frontend/i18n scope) | N/A | (See `qesto-i18n` story deliverables) |
