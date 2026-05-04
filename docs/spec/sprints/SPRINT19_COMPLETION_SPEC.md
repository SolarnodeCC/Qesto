# Sprint 19 Full Completion Spec

_Hub: [Documentation map](./README.md)._

_Created: 2026-05-04 (Europe/Amsterdam)._

## Goal

Sprint 19 is complete only when the AI wizard -> Launchpad journey is both usable and measurable. Feature implementation alone is not enough; the product must emit durable evidence for wizard entry, AI suggestion resolution, Launchpad entry, launch attempts, launch success, launch failure, and preflight readiness.

## Completion Scope

### Built Journey

- AI-assisted session wizard with consent, generation, refinement, editable questions, validation, and overview.
- Wizard launch path that persists AI provenance:
  - `ai_generated`
  - `ai_consent_at`
  - `ai_grounding_hash`
  - `ai_accepted_count`
  - `ai_dismissed_count`
- Launchpad preflight, action rail, question review, inline edit/add/reorder support, energizer setup, and guarded Open lobby path.

### Durable Measurement

Sprint 19 now records durable journey events in `sprint19_events`:

| Event | Trigger |
|---|---|
| `wizard.opened` | Host opens the new-session wizard |
| `wizard.completed` | Host completes wizard and reaches Launchpad |
| `ai.suggestions_resolved` | AI-generated questions are accepted/dismissed at completion |
| `launchpad.opened` | Host opens a DRAFT session Launchpad |
| `preflight.checked` | Launchpad readiness checks run |
| `preflight.failed` | Readiness checks fail |
| `launchpad.launch_attempt` | Start endpoint receives an Open lobby attempt |
| `launchpad.launch_success` | DRAFT -> LIVE succeeds |
| `launchpad.launch_failed` | Launch fails before LIVE state is established |

The events are also mirrored to Analytics Engine through `writeEvent()` where available.

### Baseline Endpoint

`GET /api/admin/sprint19-baseline` returns:

- AI usage rate.
- Wizard completion rate, using `wizard.opened` / `wizard.completed` when available and D1 session fallback otherwise.
- Launchpad success rate, using launch attempt/success events when available and D1 session fallback otherwise.
- Inline AI suggestion acceptance rate from persisted accepted/dismissed counts.
- Invalid live attempts from launch failures.
- Preflight failure rate from durable preflight events.
- Counts for all denominator and numerator fields.
- Remaining measurement gaps only when the selected window has no events for a given denominator.

## Acceptance Criteria

- Focused tests pass:
  - `tests/integration/sprint19-baseline.test.ts`
  - `tests/unit/observability.test.ts`
  - `tests/unit/ai-wizard.test.ts`
  - `tests/unit/sessions-new-routes.test.ts`
- `npm run typecheck` passes.
- `npm run build` passes.
- Sprint 20 planning must not promote Launchpad expansion until the baseline endpoint has real data for the selected production window.

## Time-Based Data Note

Today is 2026-05-04. The 7-day production baseline that starts on 2026-05-01 cannot be final yet. The product can now collect the missing Sprint 19 evidence, but the numeric 7-day baseline should be appended after 2026-05-08.
