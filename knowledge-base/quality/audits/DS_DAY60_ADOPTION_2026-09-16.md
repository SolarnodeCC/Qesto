# Design System Days 31–60 — Adoption Wave

> **Date:** 2026-09-16  
> **Status:** Implementing on `cursor/ds-day60-adoption-d4b3`  
> **Parent:** [DS Day 1–30 Foundations](./DS_DAY30_FOUNDATIONS_2026-09-16.md)  
> **ADR:** [ADR-0071](../../adr/ADR-0071-design-system-v1.md)  
> **Shell matrix:** [SHELL_MATRIX.md](../../architecture/SHELL_MATRIX.md)

## Goals

Adopt Day 1–30 foundations on the highest-traffic product surfaces so join,
dashboard, launchpad, auth, and studio share one button, form, empty/skeleton,
and shell vocabulary — with CI gates that prevent hex/token regression.

## Scope (this train)

| # | Deliverable | Acceptance |
|---|---|---|
| 1 | `ui/Button` on Dashboard hero, Launchpad join CTA, Join landing/error | Primary/secondary CTAs import `Button` from `src/ui/components`; ≥44px touch; `btn-motion` kept on launchpad start |
| 2 | Shared `FormField` + Login a11y bar on Connect/Join/Studio | Label↔control `htmlFor`/`id`, `aria-invalid`, `role="alert"` errors, hint via `aria-describedby` |
| 3 | Join landing / waiting / loading / error → `ParticipantShell` | Privacy/Terms footer present; no hand-rolled join chrome on those states |
| 4 | High-traffic hex → semantic CSS vars + `check:hex-tokens` | Scoped paths free of Day-30 mapped hex; script in `check:rc` |
| 5 | Dashboard `EmptyState` + skeleton primitives | Recent-sessions empty uses `ui/EmptyState`; loading rows use shared shimmer pattern |
| 6 | `SessionWizard` mega-state → reducer | Single `useReducer` for wizard fields; open-reset via `RESET` action |
| 7 | Present stage token | Outer stage uses `bg-[var(--surface-stage)]` (aligns with `BigScreenShell`) |

## Out of scope (Days 61+)

- Full Button migration of remaining ~250 raw `<button>`s
- Live voter chrome → full `ParticipantShell` (active session keeps focused chrome; tokens only)
- Marketing template merge / Display.tsx → BigScreenShell
- Full Login Google SVG replacement (brand mark fills remain)

## Token map (reuse Day 30)

| Hardcoded hex | Semantic token |
|---|---|
| `#F0F2F8` | `--text-primary` |
| `#A8B3CC` | `--text-secondary` |
| `#8A96B0` / `#8893AD` / `#9AA8C7` | `--text-muted` / `--text-secondary` |
| `#0A0F1E` | `--color-bg` / `--surface-stage` |
| `#0F1525` / `#0F1628` | `--color-bg-subtle` |
| `#151C2E` | `--color-surface` |
| `#1C2540` | `--color-surface-elevated` |
| `#1E2A45` | `--color-border` |
| `#2A3858` | `--color-border-strong` |

## Test plan

| Suite | Coverage |
|---|---|
| `tests/unit/ui-form-field.test.tsx` | label association, error alert, describedby |
| `tests/unit/ui-button.test.tsx` | variants, disabled, submit type, inverse |
| `tests/unit/session-wizard-reducer.test.ts` | reset, field patches, step jumps |
| `scripts/check-hex-tokens.mjs` | scoped paths free of mapped dark hex |
| Existing `check:lucide-layouts` / `check:contrast-tokens` | still green |

## Non-goals for reviewers

Pixel-identical join landing header (gradient hairline dropped in favour of
`ParticipantShell` brand row + legal footer). CTA visual language follows
`ui/Button` (gradient primary / secondary border) rather than one-off teal solids.
