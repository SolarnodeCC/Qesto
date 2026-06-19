---
id: SPRINT99_EXECUTION
type: release
domain: product
category: sprint-closeout
status: active
version: 1.0
created: 2026-10-23
updated: 2026-10-23
tags:
  - sprint-99
  - v7.0-ga
  - xr
  - platform-certification
  - release-engineering
  - engagement-intelligence-network
relates_to:
  - SPRINT85_99_PLAN
  - SPRINT91_99_STORIES
  - SPRINT98_EXECUTION
  - ADR-0063-v7-platform-certification
  - BACKLOG_MASTER
  - ROADMAP_FULL
---

# Sprint 99 — Execution Plan

_Window (2026-10-23 → 11-03, UTC): v7.0 GA ship + XR launcher/fallback + platform certification._ **Final sprint of S85–S99 arc; v7.0 Engagement Intelligence Network GA.**

_Goal (per [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) §S99 / [`SPRINT91_99_STORIES.md`](../planning/SPRINT91_99_STORIES.md)): **v7.0 GA release engineering.** S98 delivered the RC soak evidence, DR drill RTO ≤2h proof, WCAG AAA re-attestation, and XR demand-validation spike (kill-gate PASSED ≥3 design partners). S99 closes the feature work (XR launcher real-device detection + 2D graceful-degrade path), authors platform certification ADR, executes release engineering (version bump to 7.0.0, certification bundle assembly, pentest #6 final sign-off, v6.x deprecation notice endpoint), and ships v7.0 GA with optional XR beta feature-flagged._

## Scope

| ID | Pts | Pri | Notes |
|----|-----|-----|-------|
| `FE-XR-LAUNCHER-01` | 5 | P1 | WebXR launcher: real device detection (`navigator.xr?.isSessionSupported('immersive-vr')`), detect Quest 3 / iOS Safari 16+ / Android Chrome; current S98 button only checks the DO `xr` feature flag, no device detection yet |
| `XR-FALLBACK-01` | 8 | P1 | Explicit 2D graceful-degrade path for non-WebXR browsers: button-based voting keeps working, `fallback_notice` shown; never gate voting on XR |
| `ADR-0063` | — | P0 | v7.0 platform certification + v6.x deprecation policy (authored in parallel by the architect to `knowledge-base/adr/ADR-0063-v7-platform-certification.md`) |
| v7.0 GA release engineering | — | P0 | Platform `RELEASES` += `7.0.0` GA (sprint 99); `/api/platform/version` → `7.0.0`; `/certification` → certifiedVersion `7.0.0`, pentest #6 complete, deprecationPolicy → ADR-0063; v6.x sunset notice endpoint; release notes `v7.0.0.md` |

**Total:** 13 pts (product-engineering) + P0 operational gates. Release: **v7.0.0 GA**. **Note:** XR launcher and fallback are conditional on S98's XR-00 kill-gate pass (≥3 design-partner commitments — already passed; proceeding with go decision).

**Out of scope for S99**: Any new trust boundary, third-party AI APIs, full production XR/VR (XR stays a gated beta, feature-flagged `beta-xr=false` by default). XR kill-criterion still applies: if design-partner pull collapses post-S98, XR can defer to v7.1 — but S98 passed the gate, so proceeding with the **go** path.

## Build Sequencing

1. **Backend platform certification (parallel, days 1–5):**
   - `qesto-architect`: Draft and accept `ADR-0063` (v7.0 platform certification + v6.x deprecation policy). Document: v7.0 service-level claims (uptime, latency, isolation), v6.x sunset timeline (6-month notice, API endpoints disabled 2026-12-01), compliance/security evidence checklist (DR drill, Pentest #6, SOC 2, WCAG AAA).
   - `qesto-backend`: Release engineering — add `7.0.0` entry to platform RELEASES table (D1); update `/api/platform/version` endpoint to return `{ version: '7.0.0', platform: 'qesto', timestamp: <now> }`; implement `/api/platform/deprecation-notice` endpoint (returns `{ deprecatedVersion: '6.x', sunsetDate: '2026-12-01', migrateUrl: '/docs/v7-migration' }`); wire up `/api/certification` endpoint to surface certifiedVersion, pentest closure date, compliance evidence URIs.

2. **Frontend XR launcher + fallback (parallel, days 2–7):**
   - `qesto-frontend` (days 2–7): `FE-XR-LAUNCHER-01` — add real WebXR device detection via `navigator.xr?.isSessionSupported('immersive-vr')` call (Safari 16+, Quest 3, Android Chrome 88+). Update launcher button in `src/pages/JoinPage.tsx` to show "Join in XR" only on supported devices (no longer relies solely on DO feature flag). Style fallback affordance (disabled button with tooltip "Your device doesn't support XR" if `isSessionSupported` returns false).
   - `qesto-frontend` (days 2–7): `XR-FALLBACK-01` — ensure 2D voting path is fully independent of XR code path. Button voting (yes/no/multiple choice/ranking) must never be gated on XR availability. Render `fallback_notice` (small banner + icon) on non-WebXR browsers if session has XR enabled, but votes still submit normally. Add unit test: "votes submit even if XR fallback is shown."
   - `qesto-i18n` (days 2–7): i18n strings for XR launcher ("Join in XR", "Your device doesn't support immersive sessions", "Vote without XR") and fallback notice ("This session supports spatial interactions, but your browser doesn't. You can still vote below.") added to locales (EN/NL/ES/DE/FR). `npm run check:i18n` green.

3. **QA & verification (end of sprint):**
   - `qesto-tester`: `tsc --noEmit`, `npm test` (Vitest) green. `check:i18n` green. Release engineering endpoints tested (`/api/platform/version` returns 7.0.0; `/api/certification` surfacing evidence URIs; `/api/platform/deprecation-notice` callable).
   - `qesto-e2e-tester`: Smoke test XR launcher on real Quest 3 / iOS Safari 16+ (if available) or ChromeOS emulator; confirm button shows "Join in XR" only on supported devices and fallback notice appears in Chrome. Confirm voting submits in both paths.

4. **Release engineering & go-live (days 8–9):**
   - `qesto-devops`: Final deployment checklist — verify RELEASES entry added, `/api/platform/version` green, certification evidence bundle staged. Prepare rollback plan (revert to v7.0.0-rc.2 if critical issue found in first 2h). Monitor AE for `platform.startup_time`, `session.realtime_latency` p95, error rate (target: <0.1%).
   - `qesto-product-owner` + `qesto-knowledge`: Final docs updates to BACKLOG_MASTER (S99 closeout bullet), ROADMAP_FULL (v7.0 narrative), release notes (`v7.0.0.md`), and KB version index.

## Acceptance Criteria

### FE-XR-LAUNCHER-01 — WebXR Launcher with Real Device Detection

**Given** a participant on a Meta Quest 3 or iOS Safari 16+ visits the session join page,  
**When** the page loads and checks for WebXR capability via `navigator.xr?.isSessionSupported('immersive-vr')`,  
**Then**:
- The "Join in XR" button is visible and clickable (not disabled).
- Button text reads "Join in XR" (in the user's language).
- Clicking the button initiates the WebXR session flow (delegates to S98's XR launcher stub).

**Given** a participant on a non-WebXR browser (e.g., Chrome 85, Firefox 100, Safari 15) visits the session join page,  
**When** the page loads and checks for WebXR capability,  
**Then**:
- The "Join in XR" button is present but disabled (greyed out).
- A tooltip or inline note reads "Your device doesn't support immersive sessions" (localized).
- The 2D voting UI is fully visible and functional; no XR dependency blocks voting.

**Acceptance signals:**
- `src/pages/JoinPage.tsx` checks `navigator.xr?.isSessionSupported('immersive-vr')` (not just `beta-xr` flag).
- `FE-XR-LAUNCHER-01` branch checks `isSessionSupported` result; feature flag `beta-xr` remains in backend (controls `/api/xr-broadcast` endpoint availability), not in launcher detection.
- Launcher button disabled state tested in `tests/unit/JoinPage.test.ts` for Chrome/Firefox (no XR) vs. Quest 3 emulator / Safari 16+ (XR capable).
- Tooltip copy passes `check:i18n` (no hardcoded English).

---

### XR-FALLBACK-01 — Explicit 2D Graceful-Degrade Path

**Given** a non-WebXR browser (e.g., Chrome on desktop) visits a LIVE session where XR is enabled (feature flag `beta-xr=true`),  
**When** the session renders,  
**Then**:
- A `fallback_notice` element appears (small banner with icon) saying "This session supports spatial interactions, but your browser doesn't. You can still vote below." (localized).
- All question types (yes/no, multiple choice, ranking, scales, open text) render with button-based UI, not spatial elements.
- Submitting a vote (clicking a button or entering text) posts to `/api/questions/:id/responses` normally (does not require XR).
- Response submission succeeds (200 OK); response is recorded.

**Given** a participant submits a vote while `fallback_notice` is displayed,  
**When** they click "Submit",  
**Then**:
- The response is accepted and counted in results (no special handling; same pipeline as XR-capable browsers).
- The results UI updates normally (e.g., bar chart refreshes, count increments).
- No error or warning is shown to the participant.

**Acceptance signals:**
- `src/xr/XrSessionOverlay.tsx` (or equivalent) renders `fallback_notice` conditionally: shown if `xrEnabled && !isXrCapable`, never blocks voting UI.
- 2D voting path (button submission) is orthogonal to XR code path; no XR imports in vote submission logic (`src/hooks/useVoteSubmission.ts` or equivalent).
- Unit test: `tests/unit/XrFallback.test.ts:fallback_notice_shown_on_non_xr_browser`.
- Unit test: `tests/unit/useVoteSubmission.test.ts:vote_submits_with_fallback_notice_displayed`.
- Fallback notice text passes `check:i18n` (strings in `xr.json` namespace).

---

### ADR-0063 — v7.0 Platform Certification + v6.x Deprecation Policy

**Given** the architecture team has completed ADR-0063,  
**When** the document is committed to `knowledge-base/adr/ADR-0063-v7-platform-certification.md`,  
**Then**:
- The ADR specifies v7.0 service-level claims (uptime ≥99.95%, latency p95 <500ms, isolation proof per ADR-0062).
- The ADR cites evidence: DR drill RTO ≤2h (S98), Pentest #6 closed (S97), SOC 2 annual (S89), WCAG AAA zero violations (S98), RC soak 24h <5% latency variance (S98).
- The ADR defines v6.x sunset: 6-month notice effective 2026-10-23 (S99 ship), API endpoints (`/api/v6/*` namespace, if any) disabled 2026-12-01, `/api/platform/deprecation-notice` endpoint returns sunset metadata.
- Compliance evidence bundle (PDF artifacts of DR drill, Pentest #6, WCAG AAA report) is prepared for `/api/certification` endpoint.

**Acceptance signals:**
- `knowledge-base/adr/ADR-0063-v7-platform-certification.md` committed and linked in BACKLOG_MASTER + ROADMAP_FULL.
- `qesto-architect` + PO sign-off: ADR accepted.

---

### v7.0 GA Release Engineering

**Given** release engineering steps are executed (days 8–9),  
**When** the platform is deployed to production with version bump,  
**Then**:
- `GET /api/platform/version` returns `{ version: '7.0.0', platform: 'qesto', timestamp: <RFC3339> }`.
- `GET /api/certification` returns `{ certifiedVersion: '7.0.0', certificationDate: '2026-10-23', uptime: '99.95%', evidenceUri: '/docs/v7.0-certification-bundle', pentest6ClosedDate: '2026-09-22' }`.
- `GET /api/platform/deprecation-notice` returns `{ deprecatedVersions: ['6.x'], sunsetDate: '2026-12-01', migrateUrl: '/docs/v7-migration', message: 'v6.x support ends 2026-12-01. Upgrade to v7.0 now.' }` (200 OK).
- Platform RELEASES table (D1) has entry `{ version: '7.0.0', shipped_date: '2026-10-23', notes: 'Engagement Intelligence Network GA: CONNECT + STUDIO + XR beta (feature-flagged)' }`.
- Release notes file `v7.0.0.md` published to `knowledge-base/product/releases/v7.0.0.md` with narrative of S97–S99 work (CONNECT GA, STUDIO GA, XR beta, platform certification, v6.x sunset timeline).

**Acceptance signals:**
- Backend smoke test: `curl -s https://qesto.app/api/platform/version | jq .version` returns `7.0.0`.
- Certification endpoint accessible; evidence URIs reachable.
- Deprecation notice endpoint returns correct metadata.
- Release notes link in product marketing site updated.

---

## Quality Gates & XR Kill Criterion

### XR-00 Kill Gate Status (S98 decision: PASS)

S98 market research validated ≥3 design-partner commitments (signed LOI / confirmed beta calendar). Go decision filed; XR-SPATIAL-01 and XR-AVATAR-01 shipped feature-flagged in S98. **S99 proceeds with XR launcher + fallback work.**

**Go decision implications:**
- `FE-XR-LAUNCHER-01` (5 pts) + `XR-FALLBACK-01` (8 pts) enter S99 build pipeline.
- XR beta remains feature-flagged (`beta-xr` defaults to false in `wrangler.toml [vars]`); no GA claim in marketing.
- S99 feature work is **conditional**: if design-partner pull collapses *after* S98, XR defers to v7.1 backlog; feature flag already gated, so no hot-fix needed.

---

## Quality Gates Line

- `tsc --noEmit` clean · Vitest green · `npm run build` green · `check:i18n` green.
- **Release engineering:** `/api/platform/version` returns `7.0.0` · `/api/certification` surfaces evidence URIs · `/api/platform/deprecation-notice` returns v6.x sunset metadata.
- **Certification evidence in place:** DR drill RTO ≤ 2h proof (S98) · Pentest #6 closed (S97) · SOC 2 annual (S89) · WCAG AAA zero violations (S98) · RC soak <5% latency variance (S98).
- **Feature flags:** `beta-xr` defaults to false; XR launcher gracefully disabled on non-WebXR browsers; no GA claim.
- **Platform claims:** Uptime ≥99.95%, latency p95 <500ms, federation + aggregation isolation per ADR-0062.

---

## Release Engineering

**Version number:** `7.0.0` (GA, bumped from `7.0.0-rc.2` shipped in S98).  
**Platform `/api/platform/version`:** Returns `7.0.0`.  
**Platform `/api/certification`:** Returns certification metadata + evidence URIs.  
**Platform `/api/platform/deprecation-notice`:** Returns v6.x sunset notice (effective 2026-10-23, endpoints disabled 2026-12-01).  
**Release notes location:** [`v7.0.0.md`](./v7.0.0.md) (produced at sprint closeout; summarizes S97–S99 work: CONNECT GA, STUDIO GA, XR beta, platform certification, v6.x deprecation).  
**Platform RELEASES:** Add entry `{ version: '7.0.0', shipped_date: '2026-10-23', notes: 'Engagement Intelligence Network GA: federation, authoring, XR beta feature-flagged' }`.  
**Certification bundle:** PDF artifacts of DR drill (S98), Pentest #6 (S97), WCAG AAA (S98), SOC 2 (S89) staged at `/docs/v7.0-certification-bundle` (internal or gated link).

---

## Sequential Dependencies & Critical Paths

1. **ADR-0063 must be written & accepted by day 5:** Certification evidence checklist is input to release engineering endpoints (days 6–9).
2. **S98 RC soak / DR drill / WCAG AAA / Pentest #6 evidence must be ready by S99 start:** Feeds `/api/certification` endpoint.
3. **XR launcher + fallback are parallel to release engineering:** Both can proceed independently; both gate on `tsc --noEmit` + Vitest green at sprint close.
4. **Release engineering is end-of-sprint critical path:** Version bump, endpoint wiring, and deployment checklist cannot start until day 7; plan 2 days (days 8–9) with rollback buffer if needed.

---

## Docs to Update (PO to file at closeout)

| Deliverable | Owner | Location |
|---|---|---|
| ADR-0063: v7.0 platform certification + v6.x deprecation policy | Architect | [`knowledge-base/adr/ADR-0063-v7-platform-certification.md`](../../adr/ADR-0063-v7-platform-certification.md) |
| v7.0 release notes | PO | [`v7.0.0.md`](./v7.0.0.md) |
| v7.0 GA narrative (CONNECT + STUDIO + XR beta) | PO | Update top of [`knowledge-base/product/roadmap/ROADMAP_FULL.md`](../roadmap/ROADMAP_FULL.md) with v7.0 section |
| Sprint 99 closeout summary | PO | Update top of [`knowledge-base/product/backlog/BACKLOG_MASTER.md`](../backlog/BACKLOG_MASTER.md) with rolling-update bullet (✅ S99: v7.0 GA shipped, CONNECT+STUDIO GA, XR beta, platform cert, v6.x sunset notice) |
| v7.0 platform certification evidence | DevOps | Stage PDF artifacts at `/docs/v7.0-certification-bundle` for `/api/certification` endpoint |
| Platform version index | Knowledge Steward | Update `knowledge-base/specifications/product/SPEC_PRODUCT.md` §Version history with entry for `7.0.0` (S99, certified, v6.x sunsets 2026-12-01) |

---

## S99 AC → Test Traceability Matrix

| Story ID | Acceptance Criterion | Test File | Test Cases |
|---|---|---|---|
| **FE-XR-LAUNCHER-01** | "Join in XR" button visible on WebXR-capable devices | `tests/unit/JoinPage.test.ts` | `renders_xr_join_button_on_quest3`, `renders_xr_join_button_on_ios_safari_16plus`, `renders_xr_join_button_on_android_chrome_88plus` |
| **FE-XR-LAUNCHER-01** | "Join in XR" button disabled on non-WebXR browsers | `tests/unit/JoinPage.test.ts` | `disables_xr_join_button_on_chrome_desktop_no_webxr`, `disables_xr_join_button_on_firefox_no_webxr`, `disables_xr_join_button_on_safari_15` |
| **FE-XR-LAUNCHER-01** | Tooltip "Your device doesn't support immersive sessions" shown on non-XR devices | `tests/unit/JoinPage.test.ts` | `tooltip_shown_on_disabled_xr_button`, `tooltip_text_includes_device_support_hint` |
| **FE-XR-LAUNCHER-01** | Launcher button detection uses `navigator.xr?.isSessionSupported()`, not just feature flag | `tests/unit/JoinPage.test.ts` | `checks_webxr_api_on_mount`, `feature_flag_does_not_override_device_detection` |
| **XR-FALLBACK-01** | Fallback notice displayed on non-WebXR browsers in LIVE session with XR enabled | `tests/unit/XrFallback.test.ts` | `shows_fallback_notice_when_xr_enabled_and_device_not_capable`, `fallback_notice_text_localized` |
| **XR-FALLBACK-01** | 2D voting UI rendered alongside fallback notice | `tests/unit/XrFallback.test.ts` | `yes_no_buttons_visible_with_fallback_notice`, `multiple_choice_buttons_visible_with_fallback_notice` |
| **XR-FALLBACK-01** | Vote submission succeeds while fallback notice displayed | `tests/unit/useVoteSubmission.test.ts` | `vote_submits_with_fallback_notice_displayed`, `vote_response_recorded_in_results_with_fallback` |
| **XR-FALLBACK-01** | No error shown on vote submit with fallback active | `tests/unit/useVoteSubmission.test.ts` | `no_error_on_fallback_vote_submit`, `vote_success_acknowledged_in_ui` |
| **v7.0 Release Engineering** | `/api/platform/version` returns `7.0.0` | Backend integration test | `platform_version_endpoint_returns_7_0_0` |
| **v7.0 Release Engineering** | `/api/certification` returns v7.0.0 metadata + evidence URIs | Backend integration test | `certification_endpoint_returns_metadata`, `certification_evidence_uris_accessible` |
| **v7.0 Release Engineering** | `/api/platform/deprecation-notice` returns v6.x sunset metadata | Backend integration test | `deprecation_notice_endpoint_returns_v6x_sunset`, `sunset_date_correct_2026_12_01` |
| **v7.0 Release Engineering** | RELEASES table (D1) has v7.0.0 entry | Backend integration test | `releases_table_includes_v7_0_0`, `release_shipped_date_correct` |
| **ADR-0063** | Platform certification ADR authored and accepted | ADR review gate | ADR-0063 file exists, linked in BACKLOG_MASTER, architect + PO sign-off |

---

## S99 Exit Criteria Checklist

**All items must be green before v7.0 GA can ship:**

- [ ] `tsc --noEmit` passes (no TypeScript errors).
- [ ] `npm test` (Vitest) passes (unit + integration tests green).
- [ ] `npm run build` green (frontend build succeeds).
- [ ] `npm run check:i18n` green (no missing keys in EN/NL/ES/DE/FR for XR launcher / fallback strings).
- [ ] `FE-XR-LAUNCHER-01` acceptance signals met (device detection, button rendering, tooltip).
- [ ] `XR-FALLBACK-01` acceptance signals met (fallback notice, 2D voting, vote submission).
- [ ] ADR-0063 (v7.0 platform certification + v6.x deprecation) committed and accepted.
- [ ] `/api/platform/version` returns `7.0.0` (tested in staging).
- [ ] `/api/certification` endpoint returns metadata + evidence URIs (tested in staging).
- [ ] `/api/platform/deprecation-notice` endpoint returns v6.x sunset (tested in staging).
- [ ] Platform RELEASES table entry for `7.0.0` added to D1.
- [ ] Certification evidence bundle (DR drill, Pentest #6, WCAG AAA, SOC 2 artifacts) staged at `/docs/v7.0-certification-bundle`.
- [ ] Release notes `v7.0.0.md` published.
- [ ] BACKLOG_MASTER updated with S99 closeout bullet.
- [ ] ROADMAP_FULL updated with v7.0 GA narrative.
- [ ] SPEC_PRODUCT version index updated with v7.0.0 entry.
- [ ] Smoke test: XR launcher on real device (or emulator) shows button only on WebXR-capable browsers.
- [ ] Smoke test: 2D voting works with fallback notice displayed.
- [ ] Deployment: v7.0.0 pushed to production; rollback plan documented.
- [ ] Monitoring: AE metrics green (platform.startup_time, session.realtime_latency p95 <500ms, error rate <0.1%).
- [ ] **Marketing:** v7.0 GA announcement copy approved (does not claim XR as GA, only as "feature-flagged beta").

---

## XR Kill Criterion: Post-S98 Contingency

If design-partner pull collapses *after* S98 GA but *before* S99 completion:

1. **Action:** PO + Market Research file kill recommendation; escalate for final call.
2. **Outcome:** 
   - `FE-XR-LAUNCHER-01` (5 pts) + `XR-FALLBACK-01` (8 pts) defer to v7.1 backlog.
   - S99 scope reduces to release engineering + ADR-0063 only (no net-new product code).
   - XR beta (already shipped feature-flagged in S98) remains in codebase but is disabled by default (`beta-xr=false`); no support claim.
3. **v7.0 GA claim:** Proceeds as planned; v7.0 ships without active XR launcher (only release engineering + platform cert gate).

---

## Notes

- **XR Beta Status:** All XR code (from S98: `XR-SPATIAL-01`, `XR-AVATAR-01`, SessionRoom `xr_avatar_sync` channel, `/api/xr-broadcast` endpoint) remains feature-flagged (`beta-xr` KV var, defaults false). S99's XR launcher + fallback are *optional UX layers* that expose the beta to users on capable devices. If the killer feature request fails mid-sprint, launcher/fallback work stops; the beta remains dormant.
- **v6.x Sunset:** Effective 2026-10-23 (S99 ship), 6-month notice period. API endpoints to be disabled 2026-12-01. Deprecation notice endpoint allows client-side detection of sunset; `/docs/v7-migration` guide published separately by marketing.
- **Platform Certification:** Evidence-driven; inputs from S89 (SOC 2), S97 (Pentest #6), S98 (DR drill, WCAG AAA, RC soak). No new security/compliance gates in S99; purely release-engineering assembly.
