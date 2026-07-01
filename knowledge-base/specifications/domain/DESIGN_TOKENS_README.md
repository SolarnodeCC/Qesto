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

- **Tokens are hand-authored in `src/styles.css` (`@theme`)** — the single source of truth. (Historical: `DESIGN-TOK-01` proposed a `design-tokens.json` → `src/ui/tokens.ts` generator with a CI drift gate; that pipeline was built but never consumed, and was removed in 2026-07.)
- Token or visual changes belong in **`WEBSITE_DESIGN_SPEC.md`** and **`design-tokens.json`** in the **same PR** when practical.

## Editing `design-tokens.json`

The file follows the [Design Tokens Community Group](https://design-tokens.github.io/community-group/format/) shape (`$schema` in-file). Prefer extending existing groups over one-off magic values in components.
