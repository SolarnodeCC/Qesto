---
id: DESIGN-TOKENS
type: specification
domain: design
category: tokens
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
audience:
  - Frontend engineer
  - Designer
tags:
  - design-tokens
  - tailwind
  - typography
  - spacing
  - colors
  - css
relates_to:
  - SPEC_DESIGN_SYSTEM_OVERVIEW
  - WEBSITE_DESIGN_SPEC
  - SPEC_FRONTEND
---

# Design tokens

_Hub: [Documentation map](../README.md)._

> **⚠️ Retired pipeline (2026-07).** `design-tokens.json` and its generator
> (`build-tokens.mjs` → `src/ui/tokens.ts` + the Tailwind theme, `DESIGN-TOK-01`)
> have been **removed as dead code** — nothing consumed the generated output.
> The **single source of truth for tokens is now the `@theme` block in
> `src/styles.css`** (hand-authored; `vite build` consumes it via the
> `@tailwindcss/vite` plugin). Edit tokens there. The prose design spec remains
> [`WEBSITE_DESIGN_SPEC.md`](../product/WEBSITE_DESIGN_SPEC.md) and ADR-0071.
> The material below is retained only as historical context.

This folder previously held the machine-readable **visual design system** for the public site and dashboard shell.

## Read next

- **[`WEBSITE_DESIGN_SPEC.md`](../product/WEBSITE_DESIGN_SPEC.md)** — prose spec: layout, components, KPIs, accessibility as layout, and how tokens are applied.
- **[`../README.md`](../README.md)** — how all `docs/` connect (truth hierarchy, reading order).
- **[`INDEX.md`](../SPEC_INDEX.md)** — technical specs hub; frontend contract in **`SPEC_FRONTEND.md`** references these artefacts.

## Engineering rules

- **Tokens are hand-authored in `src/styles.css` (`@theme`) and `src/styles/tokens.css`** — the single source of truth. `src/styles.css` holds the Tailwind-namespaced `@theme` tokens; `src/styles/tokens.css` (imported by it) holds the short aliases (`--teal/violet/pulse/signal-*`), the signature gradients, and the typography classes. (Historical: `DESIGN-TOK-01` proposed a `design-tokens.json` → `src/ui/tokens.ts` generator with a CI drift gate; that pipeline was built but never consumed, and was removed in 2026-07.)
- Token or visual changes belong in **`WEBSITE_DESIGN_SPEC.md`** and the CSS token files (`src/styles.css` / `src/styles/tokens.css`) in the **same PR** when practical.

## Editing tokens

Edit the CSS custom properties directly in `src/styles.css` (`@theme`) or `src/styles/tokens.css`. Prefer extending existing scales over one-off magic values in components. The retired `design-tokens.json` (Design Tokens Community Group format) is no longer part of the build.
