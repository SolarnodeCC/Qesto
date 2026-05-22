---
id: ADR-0012
title: Route → Service → Repository Boundaries
domain: architecture
status: proposed
version: 1.0
created: 2026-05-22
updated: 2026-05-22
tags:
  - architecture
  - hono
  - sessions
  - refactoring
relates_to:
  - ADR-0008-integration-foundation
  - SPRINT30_39_PLAN
---

# ADR-0012: Route → Service → Repository Boundaries

**Backlog:** ADR-0012  
**Status:** Proposed — accept before Sprint 33 integration + AI work  
**Date:** 2026-05-22

## Context

`sessions.routes.ts` and related modules exceed 1,800 lines with nine concerns (DRAFT/LIVE lifecycle, AI wizard SSE, insights, exports, DO proxy, schema migration). Sprint 33–34 adds `AI-CONTEXT-01`, Slack/Teams/webhooks, and sentiment — all touching the same surface.

CODE-SPLIT-01 (Sprint 32) splits routes by session state but does not extract orchestration logic.

## Decision

Adopt a three-layer boundary for session and AI domains:

| Layer | Responsibility | Max size guidance |
|-------|----------------|-------------------|
| **Routes** (`routes/sessions/*`, `routes/ai-insights/*`) | HTTP shape, auth/plan middleware outputs, status codes | ≤ ~400 lines per file |
| **Services** (`services/sessionService.ts`, `services/aiWizardService.ts`, `services/insightsService.ts`) | Multi-step orchestration, Workers AI calls, DO RPC | Business logic only |
| **Repositories** (`repositories/sessionRepository.ts`, `repositories/questionRepository.ts`) | D1 queries, KV reads for session blobs | No `c.env` in routes |

### Rules

1. New Sprint 33+ features **must not** add business logic to route files.
2. Repositories return typed domain objects; they do not call Workers AI or send emails.
3. Services may call repositories, DO stubs, `c.env.AI`, and integration clients.
4. Routes call services; they never call D1 `prepare()` directly except in legacy files until migrated.

### Migration order (S31–S33)

1. S31: Extract `sessionRepository.fetchSession`, `fetchQuestions` from routes (no behavior change).
2. S32: CODE-SPLIT-01 file move only; repositories wired.
3. S33: `aiWizardService` + `session-context.ts` for AI-CONTEXT-01.

## Consequences

**Positive:** Parallel integration/AI PRs; smaller review diffs; testable services without HTTP mocks.

**Negative:** Short-term churn during CODE-SPLIT-01; requires discipline in PR review.

## Alternatives considered

- **Monolithic routes with comments:** Rejected — already at integrity risk (architecture audit SA-01).
- **Full domain-driven redesign:** Rejected — over-scoped for v2.3 timeline.

## Acceptance

- [ ] PO + Architect sign-off
- [ ] `services/` and `repositories/` directories created with at least session read path migrated
- [ ] PR template note: "No new business logic in `routes/sessions/*`"
