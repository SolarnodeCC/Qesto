# Qesto — Archived Sprints (Historical Reference)

_Hub: [Documentation map](./README.md)._

_Last updated: 2026-04-30 (UTC)_

## Overview

This document provides historical summaries of completed sprints (15, 16, 17, 18) and conditional sprint (16 v2). For **calendar / team sprint history**, use this file and [`BACKLOG.md`](./BACKLOG.md). For a **reference five-sprint teaching arc** (v0.1→v0.5) layered on the shipped v2 baseline, see [`SPRINT_PLAN.md`](./SPRINT_PLAN.md) — and read [`README.md`](./README.md) so the two notions of “sprint” are not confused.

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
