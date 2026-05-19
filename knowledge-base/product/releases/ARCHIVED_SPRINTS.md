---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - governance
  - policy
  - guidelines
relates_to:
  - CONTRIBUTING
---

# Qesto — Archived Sprints (Historical Reference)

_Hub: [Documentation map](./README.md)._

_Last updated: 2026-05-19 (UTC)_

## Overview

This document provides historical summaries of completed sprints, including Sprint 19's early implementation closeout. For **calendar / team sprint history**, use this file and [`BACKLOG.md`](../backlog/BACKLOG_MASTER.md). For a **reference five-sprint teaching arc** (v0.1→v0.5) layered on the shipped v2 baseline, see [`SPRINT_PLAN.md`](../planning/SPRINT_PLAN_MASTER.md) — and read [`README.md`](./README.md) so the two notions of “sprint” are not confused.

---

## Sprint 19 — AI Wizard + Launchpad (Implemented 2026-04-30 ahead of planned 2026-05-13 to 2026-05-27 window)

**Focus**: Complete the host create-session journey from AI-assisted wizard through overview, Launchpad preflight, and Open lobby readiness.

**Delivered**:
- ✅ **WIZ-AI-01**: AI wizard generation via `/api/sessions/:id/ai/generate` SSE (`ready` → `questions` → `done`), with grounding hash support and existing `/ai/refine` idempotency.
- ✅ **WIZ-AI-02**: Per-question editor supports poll, ranking, open, multi-select, likert, slider, upvote, and word cloud; validation gates progression.
- ✅ **WIZ-OVERVIEW-01**: Step 5 read-only overview with edit-jump preserving wizard state.
- ✅ **LAUNCHPAD-01**: Launchpad action/content rails with backend `/preflight` as the single launch readiness gate.
- ✅ **AI-VIS-03 / AI-VIS-02**: AI badge primitive plus accept/edit/dismiss suggestion chips in the wizard.
- ✅ **LAYOUT-DENSITY-01**: Compact/comfortable/spacious density applied to Dashboard sessions, Insights, and Teams list surfaces with `USERS_KV` persistence.
- ✅ **DX-INSIGHTS-02**: Conditional stretch delivered after `insights_daily` precompute/read path landed.

**Quality**:
- Focused tests: `npx vitest run tests/unit/sessions-new-routes.test.ts tests/unit/ai-wizard.test.ts tests/integration/user-preferences.test.ts` — 47 tests green.
- TypeScript: 0 errors (`npm run typecheck`).
- KPI measurement remains post-ship; implementation evidence is captured in `SPRINT_PLAN.md` §Sprint 19.

---

## Sprints 21-29 — Enterprise Authorization + LIVE Engagement (Completed 2026-05-04 to 2026-05-19)

### Sprint 21 — Custom RBAC Authorization ✅ (Merged 2026-05-04)

**Focus**: Turn Sprint 20 entitlement evidence into a safe, production-grade custom RBAC implementation.

**Delivered**:
- ✅ **ADR-0004**: Custom RBAC Authorization accepted
- ✅ **AUTHZ-RBAC-01**: D1-backed custom roles table + authorization library (`hasTeamPermission()`)
- ✅ **AUTHZ-RBAC-02**: 6 backend API endpoints (GET/POST/PATCH/DELETE roles, assign/unassign)
- ✅ **Compliance**: Audit events for role mutations, permission denials, assignments

**Quality**: 16 integration tests passing (custom-rbac, teams-crud, entitlement-contracts)

---

### Sprint 22 — Template Catalogue + Session Creation Polish ✅ (Merged 2026-05-04)

**Focus**: Complete the template path — confirmation flow + wizard seeding.

**Delivered**:
- ✅ **TPL-CATALOG-01**: Customer vs Qesto template groups (Dashboard separation)
- ✅ **TPL-CATALOG-02**: Template overview confirmation before "Use template"
- ✅ **TPL-CATALOG-03**: 3+ curated templates per topic (team, product, learning)
- ✅ **TPL-WIZARD-01**: SessionWizard accepts `initialTemplate` prop, all fields editable

**Quality**: 14 tests (template-catalogue, templates-crud); i18n validated

---

### Sprint 23 — Launchpad + Design Polish ✅ (Merged 2026-05-04)

**Focus**: Complete Launchpad inline editing + design consistency.

**Delivered**:
- ✅ **LAUNCHPAD-02**: Inline add/edit/reorder via `PUT /questions/reorder` + preflight refresh
- ✅ **DESIGN-POLISH-01**: `.btn-motion` tokenized motion (120ms, scale 1.02, --shadow-teal)
- ✅ **DESIGN-POLISH-02**: Logo sparkle mark + optical weight
- ✅ **AI-VIS-01**: Workers AI narrative accuracy (i18n-keyed)

**Quality**: 3 polish contract tests; 644 full suite; 38 a11y tests; token drift ✅

---

### Sprint 24 — v2.2 Realtime Governance + Admin Hardening ✅ (Merged 2026-05-18)

**Focus**: Protocol governance + admin maturity before LIVE energizers.

**Delivered**:
- ✅ **DO-PROTOCOL-ADR-01**: ADR-0005 accepted; v1 protocol with unsupported-version rejection
- ✅ **AUTHZ-ROLE-UI-01**: Team settings custom role CRUD (Sprint 21 integration)
- ✅ **ADMIN-ANALYTICS-01**: Admin CSV export + KPI dashboard
- ✅ **S21-S23-VERIFY-01**: Realtime protocol + template/Launchpad surfaces validated

**Quality**: 717 tests; TypeScript 0 errors; 4px baseline ✅

---

### Sprints 25-29 — LIVE Energizer Complete ✅ (All on main, 2026-05-19)

#### Sprint 25: LIVE Energizer Protocol Foundation
- ✅ **GAM-LIVE-01**: `energizer_activate` (presenter-only) + `energizer_state` broadcast (v1)
- ✅ **GAM-LIVE-FLAG-01**: `LIVE_ENERGIZERS_ENABLED=true` feature gate
- ✅ **GAM-LIVE-RECONNECT-01**: `init` snapshots include active energizer state
- ✅ **GAM-LIVE-QA-01**: 46 tests covering flag, permission, broadcast, reconnect

#### Sprint 26: LIVE Energizer Activation
- ✅ Presenter activation controls in Present.tsx wired to `sendEnergizerActivate`
- ✅ Active energizer persisted + replayed on reconnect
- ✅ Participant page WebSocket preference over REST fallback

#### Sprint 27: Quick Finger Playable Loop
- ✅ Participant `energizer_answer` submission validation + duplicate rejection
- ✅ Speed-based ranking (rank 1..n for correct, rank 0 for incorrect)
- ✅ Reconnect snapshots preserve answer state + scoreboards
- ✅ 29 session-room tests covering answers, validation, state persistence

#### Sprint 28: Team Quiz LIVE Loop
- ✅ Multi-question Team Quiz with presenter `energizer_advance` (no main-session drift)
- ✅ Question-level submission tracking (one answer per question per voter)
- ✅ `completed` flag when final question advanced
- ✅ Reconnect snapshots include question index, submissions, completion state

#### Sprint 29: Leaderboard & Badge Foundation
- ✅ Bounded top-10 leaderboard (anonymous labels: "Player 1", etc.)
- ✅ 4-type badges: `first_answer`, `speedster`, `perfect_trivia`, `engaged`
- ✅ Deterministic, idempotent badge creation + stable IDs
- ✅ Duplicate answer rejection (cannot duplicate scores/badges)
- ✅ 10+ tests for leaderboard, badges, idempotency

**Combined Quality (Sprints 25-29)**:
- 717 full test suite
- Feature flag guards all LIVE energizer mutations
- Role-based access control (presenter vs voter)
- Reconnect state persistence across all energizer types
- Idempotent badge/score derivation

---

## Phase 3–4 Build (Reference Sprint 18) — 2026-04-15 to 2026-04-20

**Focus**: Vertical slice LIVE → close → results (WebSocket + DO + D1 persistence).

**Delivered** (from `SPRINT_PLAN.md` reference arc Sprint 2–4):
- ✅ **CORE-04**: WebSocket DO (`SessionRoom`), S1–S5 acceptance tests, 100ms broadcast, voter dedupe
- ✅ **CORE-05**: Vote submission (DO + rate limit), persisted to D1 after close
- ✅ **CORE-07**: Join flow (`/j/:code` + anonymous voter ID derivation)
- ✅ **CORE-08**: Results export (CSV via Blob + download, Results.tsx histogram)

**Key Deliverables**:
- `functions/api/SessionRoom.ts` — Durable Object (persisted state, hibernated WS, broadcast)
- `functions/api/realtime.ts` — ClientMessage/ServerMessage types
- `functions/api/routes/sessions.ts` — POST /start, POST /close, GET /results
- `src/pages/Present.tsx`, `src/pages/JoinPage.tsx`, `src/pages/Results.tsx`
- `tests/unit/session-room.test.ts` (10 tests covering S1–S5 acceptance)
- `tests/integration/close-results-flow.test.ts` (4 tests covering persist round-trip)
- ADR-0001: DO-per-session design decision

**Acceptance**: S1–S5 spike criteria (PREBUILD_AND_DELIVERY.md)
- S1: Upgrade + subprotocol ✅
- S2: 25 concurrent, broadcast 100ms ✅ (tested; S2 says “N”, spec says 100+)
- S3: Reconnect preserves state ✅
- S4: Close freezes cleanly + D1 persist ✅
- S5: Rate limit (token bucket) ✅

**Quality**:
- Unit + Integration: 51 tests green (10 suites)
- TypeScript: 0 errors (`tsc --noEmit`)
- Coverage: Happy path (DRAFT → LIVE → vote → close → results) ✅
- **Gaps**: No stress test (100+ concurrent), no a11y audit, no i18n

**Process Notes**:
- **No agent invocation** (all work by main agent; reason: tight coupling + speed)
- **No security audit** (Phase 5 task)
- **Documentation**: Code-first; ADR-0001 written post-hoc
- **Branch**: `claude/qesto-build-plan-GAsed`, commit `aa172a0`

---

## For New Context

When starting fresh on Qesto (after Phase 4 LIVE spike), refer to:
- **CLAUDE.md** — Project context, hard rules, stack overview
- **BACKLOG.md** — Complete roadmap with status (CORE-01 through CORE-08 shipped)
- **SPRINT_PLAN.md** — Reference five-sprint arc; next: Phase 5 (hardening)
- **docs/adr/ADR-0001-do-per-session.md** — DO architecture decision
- **ARCHITECTURE.md** — System design and data model
- **This file** — Historical sprint data for reference

**Next**: Phase 5 (hardening + demo) requires `/architect`, `/security`, `/tester`, `/marketing` agents for observability, audit, stress testing, release notes.
