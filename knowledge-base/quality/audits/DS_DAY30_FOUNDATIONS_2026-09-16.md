# Design System Day 1–30 Foundations — Spec & Build Plan

> **Date:** 2026-09-16  
> **Status:** Implementing on `cursor/ds-day30-foundations-d4b3`  
> **Parent audit:** Principal FE DS review (layout/component/a11y/TS)  
> **ADR:** [ADR-0071](../../adr/ADR-0071-design-system-v1.md) (2026-09-16 amendments)

## Goals

Highest UI-consistency gain with lowest effort: fix shared foundations so every later
page migration inherits correct radius, dark tokens, modal a11y, badges, and CI gates.

## Scope (this train)

| # | Deliverable | Acceptance |
|---|---|---|
| 1 | Radius SoT: ADR ↔ `@theme` ↔ `Card`/`Button` | Card `rounded-xl`, Button `rounded-lg`; ADR px match `@theme` |
| 2 | Shell + primitive dark hex → semantic CSS vars | `AppShellLayout`, `MainLayout`, `ui/components` Caption/EmptyState/MetricCard/Skeleton use `var(--text-*)` / `var(--color-*)` |
| 3 | Lucide shells + CI gate | Zero `<svg` in `src/layouts/*`; `npm run check:lucide-layouts` green |
| 4 | Shared `Modal` + migrate 2 dialogs | Focus trap, Escape, restore focus; TemplatePreview + DuplicateSession use it |
| 5 | Collapse `StatusBadge` + unify `MetricCard` | Dashboard uses `ui/StatusBadge`; single MetricCard API with optional icon/loading |
| 6 | Dedupe `SessionBranding` / gallery `TemplateRecord` | One type each under `src/types/` |
| 7 | Container tokens + shell matrix | CSS vars + `SHELL_MATRIX.md` |
| 8 | Legal/Privacy/Terms mobile TOC + contrast | Mobile nav alternative; no light `text-pulse-400` on Legal |

## Out of scope (Days 31–60+)

Full Button migration of 287 raw buttons, Join→ParticipantShell, Present stage alignment,
hex lint for all pages, marketing template merge.

## Token map (dark)

| Hardcoded hex (legacy) | Semantic token |
|---|---|
| `#F0F2F8` | `--text-primary` |
| `#A8B3CC` | `--text-secondary` |
| `#8A96B0` / `#8893AD` | `--text-muted` (dark value aligned to `#8A96B0`) |
| `#0A0F1E` | `--color-bg` |
| `#0F1525` / `#0F1628` | `--color-bg-subtle` |
| `#151C2E` | `--color-surface` |
| `#1C2540` | `--color-surface-elevated` |
| `#1E2A45` | `--color-border` |
| `#2A3858` | `--color-border-strong` |

Prefer theme-aware classes: `text-[var(--text-secondary)]` (no `dark:` needed).

## Shell matrix

See [`SHELL_MATRIX.md`](../../architecture/SHELL_MATRIX.md).

## Test plan

| Suite | Coverage |
|---|---|
| `tests/unit/ui-modal.test.tsx` | open/close, Escape, focus trap, restore focus, labelled-by |
| `tests/unit/ui-status-badge.test.tsx` | tone map for each `SessionStatus` |
| `tests/unit/ui-metric-card.test.tsx` | icon/loading/trend variants |
| `tests/a11y/modal-focus-trap.test.tsx` | axe + keyboard trap on Modal fixture |
| `scripts/check-lucide-layouts.mjs` | layouts free of inline SVG icons |
| Existing `check:contrast-tokens` | Legal pulse-400 fix |

## Non-goals for reviewers

Visual pixel-perfect match to old dashboard StatusBadge (violet “Gesloten”) — canonical
tone map is amber warning for closed (ADR / `ui/StatusBadge`).
