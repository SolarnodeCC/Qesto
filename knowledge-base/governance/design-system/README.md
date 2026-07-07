---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-07-07
tags:
  - governance
  - policy
  - guidelines
relates_to:
  - CONTRIBUTING
---

# Qesto Design System (`design-system/`)

This folder is a **portable HTML/CSS kit** for Qesto-branded prototypes (preview cards, UI kits, favicon, token-aligned CSS). It is **reference-only** — nothing here is imported by the production app.

**Contents:**

- `colors_and_type.css` — token dump + semantic type roles (monolithic). The app's *live* copy of these tokens now lives at [`src/styles/tokens.css`](../../../src/styles/tokens.css) (imported by `src/styles.css`); keep the two in sync when tokens change.
- `tokens/` — the same tokens split into `fonts.css` · `colors.css` · `semantic.css` · `typography.css` · `layout.css`, with `styles.css` as the entry point.
- `preview/` — foundation specimen cards (colours, type, spacing, shadows, radius, motion, components).
- `ui_kits/` — full-surface recreations: `website/` (+ `pricing.html`), `dashboard/`, `present/`, `participant/`, `admin/` (superadmin console). `qr.js` is the shared real-QR renderer.
- `templates/` — copy-to-start Design Components (`.dc.html`): `marketing-home`, `host-dashboard`, `participant-flow`, `admin-console`, `session-wizard`, `template-gallery`.
- `assets/` — brand marks + PWA icons.

> The `tokens/`, `styles.css`, `ui_kits/admin/`, `templates/`, `pricing.html`, and `qr.js` material was folded in on 2026-07 from the (now-removed) root `design-system/` working kit — see ADR-0071.

**Canonical specification:** [`SPEC_DESIGN_SYSTEM_OVERVIEW.md`](../../specifications/domain/SPEC_DESIGN_SYSTEM_OVERVIEW.md)

**Detailed UI contract:** [`WEBSITE_DESIGN_SPEC.md`](../../specifications/product/WEBSITE_DESIGN_SPEC.md)

**Voice & grid:** [`BRAND_VOICE.md`](../BRAND_VOICE.md), [`DESIGN_GRID_GUIDE.md`](../../architecture/DESIGN_GRID_GUIDE.md)

See also **`SKILL.md`** for agent-oriented usage.
