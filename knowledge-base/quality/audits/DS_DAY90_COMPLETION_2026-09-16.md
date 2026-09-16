# Design System Days 61–90 — Completion Wave

> **Date:** 2026-09-16  
> **Status:** Implementing on `cursor/ds-day90-completion-d4b3`  
> **Parent:** [DS Day 31–60 Adoption](./DS_DAY60_ADOPTION_2026-09-16.md)  
> **ADR:** [ADR-0071](../../adr/ADR-0071-design-system-v1.md)  
> **Shell matrix:** [SHELL_MATRIX.md](../../architecture/SHELL_MATRIX.md)

## Goals

Close the remaining shell-matrix debt and finish the highest-leverage Button/token
adoptions so every primary participant/host/display surface sits on a declared
shell with shared CTAs and CI hex coverage.

## Scope (this train)

| # | Deliverable | Acceptance |
|---|---|---|
| 1 | Live voter → `ParticipantShell` | `JoinPage` Voter uses shell (legal footer); Lucide for trust/pause icons; XR control via `headerTrailing` |
| 2 | Classic `Display` → `BigScreenShell` / Fallback | Loading/error use `BigScreenFallback`; live frame uses `BigScreenShell` (canvas theme via `style`/`className`) |
| 3 | `EventStagePresent` → `HostConsoleShell` | Skip link + brand chrome; `maxWidth="7xl"`; attendee URL in `headerTrailing` |
| 4 | Wizard footer + Launchpad QuestionList CTAs → `ui/Button` | Primary/next/launch + add/save use `Button`; Lucide `Play` on launch |
| 5 | Expand `check:hex-tokens` scope | Add Display, EventStagePresent, SessionWizardFooter, wizard/session-wizard paths |
| 6 | Shell matrix + ADR note | Days 61–90 marked complete; no remaining shell-matrix rows |

## Out of scope

- Exhaustive migration of every remaining raw `<button>` (~200+)
- Marketing template pipeline merge
- Replacing Login Google brand SVG fills
- Pixel-identical canvas Display chrome (shell + canvas vars are the contract)

## Test plan

| Suite | Coverage |
|---|---|
| `tests/unit/ds-day90-completion.test.ts` | Source contracts for shells + Button adoption |
| Existing join/display functional contracts | Still green |
| `check:hex-tokens` / lucide / lint / typecheck / `npm test` | Green |

## Non-goals for reviewers

Live Display keeps canvas CSS variables for theming; BigScreenShell supplies landmarks/chrome while `style.background = var(--canvas-bg)` overrides the default stage fill.
