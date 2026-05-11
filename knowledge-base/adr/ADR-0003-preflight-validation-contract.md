# ADR-0003: Pre-flight Validation Contract (Worker vs. DO)

**Date**: 2026-04-30
**Status**: Accepted
**Deciders**: Architecture (Sprint 19 planning, 2026-04-30)
**Implements**: [Sprint 19 LAUNCHPAD-01](../product/planning/SPRINT_PLAN_MASTER.md) — pre-flight strip on Session Launchpad

---

## Context

The Session Launchpad (`LAUNCHPAD-01`) displays a pre-flight checklist before the host opens the lobby. When the host clicks "Open lobby", `POST /api/sessions/:id/start` transitions the session DRAFT → LIVE and creates the Durable Object.

**Problem**: Invariants must be checked before the DO is created. Two implementation paths exist:

1. **Worker-only**: The `POST /start` route validates everything before calling the DO's `/init` handler.
2. **Worker + DO**: The Worker checks basic invariants; the DO's `onStart`/`/init` re-validates them.
3. **DO-only**: The Worker delegates validation entirely to the DO's `/init` call.

Duplication between paths creates a drift risk: if the Worker's checks diverge from the DO's checks, the Launchpad can show "ready" but `start()` still fails, producing a broken UX that violates the LAUNCHPAD-01 KPI (≥99.5% DRAFT→LIVE success from Launchpad).

---

## Decision

**Single-source validation in the Worker layer.** The DO's `/init` handler trusts the Worker's validation and performs only a lightweight state check (idempotency guard: already-initialised → 409).

The shared validator is a pure function `validateSessionPreflight(session, questions)` in `functions/api/lib/preflight.ts` that both `GET /preflight` and `POST /start` import.

---

## Rationale

1. **No drift**: One module, two callers. Changing a validation rule updates both the Launchpad UI and the start gate simultaneously.
2. **DO simplicity**: The DO is stateful realtime infrastructure — adding complex business-rule validation there couples two concerns (session invariants + WS message routing). The DO `/init` handler only checks "am I already initialised?".
3. **Testability**: The pure function can be unit-tested without a DO harness (Vitest + no real D1/KV needed).
4. **Launchpad contract**: `GET /preflight` is designed to give the UI exactly the same signal as `POST /start`'s guard. If `preflight.ready === true`, then `start()` MUST succeed (barring a race condition, see below).
5. **Performance**: Preflight is called on Launchpad mount (page load) and on any draft edit. It must be cheap (no AI calls, no KV writes). The pure validator runs in < 1ms; the D1 question fetch adds ~5ms.

---

## Validation Checks

All checks live in `functions/api/lib/preflight.ts`:

| Check ID | Description | Pass condition |
|---|---|---|
| `has_questions` | Session has at least one question | `questions.length >= 1` |
| `questions_valid` | All structured questions have ≥2 options | All questions where `kind` ∉ `['open', 'word_cloud']` have `options.length >= 2` |
| `title_set` | Session has a non-empty title | `session.title.trim().length > 0` |
| `ai_consent` | If AI was used to generate questions, the host confirmed the AI consent gate | `session.ai_generated === 0` OR `session.ai_consent_at != null` |

`ready = checks.every(c => c.pass)`

The `POST /start` route imports `validateSessionPreflight`, runs it, and returns 422 `preflight_failed` if `ready === false`, including the full checks array so the client can surface which check failed.

---

## Race Condition Handling

A small window exists between `GET /preflight` (pass) and `POST /start`: the host edits a question (removing an option) in another tab. The Worker re-validates in `POST /start` using `validateSessionPreflight` — so the race produces a correct 422, not a broken DO state.

The DO's `/init` does not need to protect against this scenario.

---

## Consequences

- **Positive**: Launchpad UI and `start()` gate are always in sync — LAUNCHPAD-01 KPI ≥99.5% success is achievable.
- **Positive**: DO `/init` handler remains small and focused on WS state initialisation.
- **Positive**: Validator is unit-testable; easy to add new checks (e.g. "at least one question translated" for i18n sprints).
- **Negative**: Validation logic must not drift from D1 schema. Enforced by the single-module contract; reviewers must check that schema migrations update `preflight.ts`.
- **Follow-up**: If more complex invariants are added (e.g. "video slide must have a valid URL"), consider a check registry pattern rather than hardcoded if-blocks.

---

## References

- [Sprint 19 LAUNCHPAD-01 exit criteria](../product/planning/SPRINT_PLAN_MASTER.md)
- [ADR-0001: DO-per-session](./ADR-0001-do-per-session.md)
- Implementation: `functions/api/lib/preflight.ts` (Sprint 18 prereq), `functions/api/routes/sessions.ts` (`GET /:id/preflight`, `POST /:id/start`)
