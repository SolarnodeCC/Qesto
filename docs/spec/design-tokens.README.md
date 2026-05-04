# Design tokens (`design-tokens.json`)

_Hub: [Documentation map](../README.md)._

This folder holds the **visual design system** for the public site and dashboard shell. **`design-tokens.json`** is the machine-readable source of truth for colour, typography, spacing, motion, shadows, and related tokens (see `$meta` inside the JSON for a short embedded summary).

## Read next

- **[`WEBSITE_DESIGN_SPEC.md`](./WEBSITE_DESIGN_SPEC.md)** — prose spec: layout, components, KPIs, accessibility as layout, and how tokens are applied.
- **[`../README.md`](../README.md)** — how all `docs/` connect (truth hierarchy, reading order).
- **[`INDEX.md`](./INDEX.md)** — technical specs hub; frontend contract in **`SPEC_FRONTEND.md`** references these artefacts.

## Engineering rules

- **`src/ui/tokens.ts`** must be **generated** from `design-tokens.json`, not hand-edited (backlog **`DESIGN-TOK-01`**). CI should fail on drift between JSON and generated output.
- Token or visual changes belong in **`WEBSITE_DESIGN_SPEC.md`** and **`design-tokens.json`** in the **same PR** when practical.

## Editing `design-tokens.json`

The file follows the [Design Tokens Community Group](https://design-tokens.github.io/community-group/format/) shape (`$schema` in-file). Prefer extending existing groups over one-off magic values in components.
