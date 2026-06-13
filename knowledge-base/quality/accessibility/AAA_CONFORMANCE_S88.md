---
id: AAA_CONFORMANCE_S88
type: report
domain: accessibility
status: active
version: 1.0
created: 2026-06-13
sprint: S88
stories: [FE-AAA-GA-01, CANVAS-THEME-01, CANVAS-ADAPTIVE-VIZ-01]
---

# WCAG AAA Conformance — Sprint 88

## Summary

Sprint 88 targets WCAG AAA on **core flows**: join → vote → results and
presenter start → present. This document records which criteria were brought to
AAA, which remain at AA, and the rationale for each.

---

## Criteria brought to AAA in S88

### 1.4.6 Contrast (Enhanced) — AAA: 7:1

**High-contrast canvas theme** (`data-canvas-theme="high-contrast"`):

| Token pair | Ratio |
|---|---|
| `#000000` (text) on `#FFFFFF` (bg) | 21:1 |
| `#005C5C` (accent) on `#FFFFFF` (bg) | 7.82:1 |
| `#3B0764` (bar-2) on `#FFFFFF` | 14.1:1 |

All other themes meet AA (≥ 4.5:1). The default and dark themes achieve
18–19:1 and 17:1 respectively — well above AAA — but are not formally
claimed as AAA because the interactive-element accent colour (`#0F766E`) is
5.47:1, meeting AA but not AAA individually.

**Results page (Results.tsx)**:
- Winner option uses `text-teal-800` (`#115E59` = 7.58:1 on white) — AAA for
  the winner highlight text.

### 2.4.8 Location — AAA

Breadcrumb `<nav aria-label="Breadcrumb">` with `aria-current="page"` added to:
- `Results.tsx` — Dashboard / Results breadcrumb
- `JoinPage.tsx` (Voter component) — Qesto / [session-title] breadcrumb

### 2.4.9 Link Purpose (Link Only) — AAA

All links reviewed to ensure their text alone communicates purpose without
surrounding context:
- "← Back to home" (join error state) → unchanged, clear
- "View results →" (presenter panel) → clear
- "Dashboard" in breadcrumb replaces the ambiguous "← Dashboard"

### 1.4.8 Visual Presentation — partial AAA

Canvas themes include `--canvas-line-height` and `--canvas-letter-spacing`
tokens applied to canvas surfaces:
- Default: `line-height: 1.6`, `letter-spacing: 0em`
- High-contrast: `line-height: 1.75`, `letter-spacing: 0.01em`
- All canvas text uses `em`/relative units so the user can resize text without
  loss of content (SC 1.4.8 §4 — text can be resized up to 200% without
  assistive technology).
- The 1920×1080 letterboxed stage scales with CSS `transform: scale(N)` which
  preserves text at all viewport sizes.

**Remaining gap for 1.4.8**: width of text blocks is set by the fixed 1920px
canvas design. Users cannot override the line width without a tool that
intercepts the letterboxed transform. Marked as **AA-only** for that criterion
until a reflowable mode is added.

### 4.1.3 Status Messages — AAA

Live-result regions use `aria-live="polite"` so screen-reader users receive
dynamic updates without focus moving:
- `Display.tsx`: vote count `aria-live="polite"` + `aria-atomic="true"` on
  participant count.
- `Present.tsx` (via `AdaptiveVizResults`): result containers carry `aria-live="polite"`.
- `Results.tsx`: `<ul aria-live="polite">` on vote result list.
- `JoinPage.tsx`: participant count `aria-live="polite"` in the header.

### 2.2.6 Timeouts — AAA

The presenter soft timer (`useSoftTimer`) is fully under user control (they
start and stop it). No session data is lost on timeout. The voter session
connection reconnects automatically. No unannounced timeouts exist in the core
flows, satisfying 2.2.6 (users are warned by the visible timer arc).

---

## Criteria remaining at AA-only (with rationale)

| Criterion | Level | Rationale |
|---|---|---|
| 1.4.6 Contrast (Enhanced) default/dark accent | AA | `#0F766E` on white = 5.47:1. Upgrading to teal-800 (#115E59, 7.58:1) would reduce visual warmth. Planned for next sprint. |
| 1.4.8 Visual Presentation — block width | AA | 1920px fixed canvas stage. Reflowable mode is a roadmap item. |
| 2.4.7 Focus Visible | AA | AAA requires "highly visible" focus — current 3px teal ring meets enhanced visibility criteria but not the strict AAA spec's colour/size requirements. |
| 3.3.4 Error Prevention (Legal/Financial) | AA | No financial transactions in core flows. |
| 3.3.6 Error Prevention (All) | N/A | Not applicable to the voting interaction. |

---

## Testing approach

- **Contrast**: `tests/unit/canvas-contrast.test.ts` verifies all theme token
  pairs using WCAG luminance formula (pure TypeScript, no browser).
- **Theme logic**: `tests/unit/canvas-theme.test.ts` verifies storage
  persistence with jsdom.
- **Viz selection**: `tests/unit/adaptive-viz-selection.test.ts` verifies the
  selection rule for all branches.
- **WCAG AA audit**: `tests/a11y/wcag-audit.test.ts` (existing) — axe-core
  with wcag2aa/wcag21aa/wcag22aa tags on all core pages.

---

## Components updated

| File | Change |
|---|---|
| `src/styles/canvas-themes.css` | Fixed default accent from `#0D9488` (3.74:1, fail) to `#0F766E` (5.47:1, AA pass) |
| `src/components/AdaptiveVizResults.tsx` | New — aria-live, role="img" on every bar/segment |
| `src/pages/Display.tsx` | Canvas tokens applied, aria-live on vote count |
| `src/pages/Present.tsx` | Canvas tokens applied, AdaptiveVizResults wired |
| `src/pages/Results.tsx` | Breadcrumb (2.4.8), aria-live on results list, winner text upgraded to teal-800 |
| `src/pages/JoinPage.tsx` | Breadcrumb (2.4.8), aria-live on participant count |
