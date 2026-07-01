---
id: ADR-0072
title: Theming mechanisms — three bounded systems (app / canvas / embed)
status: accepted
date: 2026-07-01
deciders: [remco.oostelaar@capgemini.com]
relates_to:
  - ADR-0071
  - SPEC_DESIGN_SYSTEM_OVERVIEW
  - SPEC_FRONTEND
---

# ADR-0072 — Theming mechanisms: three bounded systems

## Context

The design-system audit (`knowledge-base/quality/audits/DESIGN_SYSTEM_AUDIT_2026-07-01.md`)
flagged that the codebase runs **three parallel theming mechanisms** and marked the situation
"needs a design-system decision." This ADR records that decision. No theming code is changed by
this ADR itself — it documents the intended architecture and the one concrete follow-up cleanup.

The three mechanisms, as they exist today:

1. **App-wide color scheme — `[data-theme]`.**
   `useColorScheme` (`src/hooks/useColorScheme.ts`) + `ColorSchemeProvider`
   (`src/hooks/ColorSchemeProvider.tsx`) resolve a `system | light | dark` preference to
   `light | dark`, write it to `document.documentElement.dataset.theme`, persist it in
   `localStorage['qesto:color-scheme']`, and hydrate it from server-side user preferences for
   authenticated users. Tailwind's `dark:` variant is bound to `[data-theme="dark"]`
   (`src/styles.css`, `@custom-variant dark`). This is the global chrome/dark-mode system that
   governs every routed page.

2. **Presenter canvas theme — `[data-canvas-theme]`.**
   `useCanvasThemeState` / `useCanvasTheme` (`src/hooks/useCanvasTheme.ts`) +
   `CanvasThemeProvider` manage a **four-value** enum
   (`default | dark | high-contrast | brand-neutral`) applied as `[data-canvas-theme]` on the
   projected-room canvas only, persisted in `localStorage['qesto:canvas-theme']`. Token sets live
   in `src/styles/canvas-themes.css`. Present and Display instantiate their own providers so they
   do not cross-talk. These four values exist for **projector legibility** (a high-contrast and a
   neutral-brand option for rooms/AV setups) and deliberately do **not** map onto the binary
   app light/dark scheme.

3. **Embed widget palette — manual ternary.**
   `src/pages/EmbedWidget.tsx` renders inside a sandboxed third-party iframe (ADR-0050). It cannot
   reliably inherit the host app's `:root` custom properties, so it re-implements a small light/dark
   palette via an `isDark` ternary rather than consuming `[data-theme]`.

## Decision

**Keep the three mechanisms as separate, intentionally-bounded systems.** Do not attempt to
unify them into a single theming primitive — the contexts are genuinely different and a forced
unification would be worse than the current separation:

- `[data-theme]` (app) — owns all standard, in-app chrome across authenticated and marketing
  surfaces. **Use this for anything rendered in the normal app shell.**
- `[data-canvas-theme]` (canvas) — owns the projected/audience canvas only, where a 4-value theme
  set serves AV/projector needs the binary app scheme cannot. **Use this only inside the
  Present/Display canvas.** The distinct attribute name is intentional, not drift.
- Embed palette (iframe) — owns the sandboxed widget, which is CSS-isolated from `:root` by design.
  **This is a documented exception, not a pattern to copy** into any non-iframe surface.

### Boundaries / rules

- New in-app surfaces MUST use `[data-theme]` + the semantic tokens in `src/styles.css`; they MUST
  NOT introduce a fourth theming mechanism.
- The projected `--surface-stage` token (added alongside the shared `BigScreenShell` layout, see
  the design-system remediation work) is the canonical big-screen background and supersedes the
  ad-hoc `#0f1117` that had been hardcoded across `*Display` pages.
- The canvas theme set stays a superset of app dark mode, not a replacement — a canvas may be dark
  while the app chrome around a host console remains on the user's app-level scheme.

### Mandated follow-up (deferred, mechanical — not done in this ADR)

`EmbedWidget.tsx`'s hand-maintained hex palette must be reconciled to the **canonical token hex
values** (e.g. `--surface-bg` / `--text-primary` dark equivalents) so it cannot drift from the
design system, and the embed's independent theming must be explicitly documented as an ADR-0050
scoped exception. This is a mechanical change tracked with the rest of the audit remediation, not a
new decision.

## Consequences

- The audit's "needs a design-system decision" item is closed: three systems, each with a clear
  owner and usage rule, rather than an implicit, undocumented divergence.
- Reviewers have an explicit test for scope creep: any new `[data-*-theme]` attribute or per-page
  manual light/dark palette outside the three sanctioned contexts is a violation of this ADR.
- The embed palette remains a maintenance cost until the mandated follow-up lands; until then its
  values are allowed to differ, but only within `EmbedWidget.tsx`.
