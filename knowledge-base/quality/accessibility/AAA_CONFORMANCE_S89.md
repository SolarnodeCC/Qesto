---
id: AAA_CONFORMANCE_S89
type: report
domain: accessibility
status: active
version: 1.0
created: 2026-06-13
updated: 2026-06-13
sprint: S89
stories: [FE-AAA-GA-01, FE-CAPTIONS-OVERLAY-01, CANVAS-THEME-01]
relates_to:
  - AAA_CONFORMANCE_S88
  - ADR-0051-live-captions-translation-pipeline
tags:
  - wcag-aaa
  - accessibility
  - captions
  - canvas
  - re-attestation
  - v6.0-rc
---

# WCAG AAA Re-attestation — Sprint 89 (v6.0-rc)

_S88 brought the **core flows** (join → vote → results; presenter present) to WCAG
AAA on the targeted criteria (see [`AAA_CONFORMANCE_S88.md`](./AAA_CONFORMANCE_S88.md)).
S89 **re-attests** AAA over the surfaces that shipped or changed late in S88 — the
live **captions overlay** and the **canvas theme** system — so the v6.0-rc "AAA GA"
claim holds for the UIs a user actually sees during a captioned, themed session._

## Scope of re-attestation

| Surface | Component | Status |
|---|---|---|
| Captions overlay | `src/components/CaptionsOverlay.tsx` | ✅ AAA-conformant on targeted criteria |
| Captions locale picker | `src/components/CaptionsLocalePicker.tsx` | ✅ keyboard + label conformant |
| Canvas themes | `CanvasThemeProvider` / `canvas-themes.css` | ✅ high-contrast theme meets 1.4.6 (7:1) |
| Adaptive results viz | `AdaptiveVizResults.tsx` | ✅ reduced-motion + theme-token inheritance |

## Criteria confirmed (no regression from S88)

- **1.4.6 Contrast (Enhanced) — 7:1.** The captions overlay scrim
  (`rgba(0,0,0,0.80)`) yields ~12.7:1 caption text contrast over **any** canvas
  theme, including the brand-neutral and dark themes; the high-contrast canvas theme
  holds ≥7:1 on all token pairs (carried from S88, re-verified by `canvas-contrast.test.ts`).
- **1.4.8 Visual Presentation.** Captions are user-resizable (5 steps, persisted);
  line spacing and last-2-line auto-scroll preserve readability without horizontal
  scrolling at the projector and mobile breakpoints.
- **2.4.x Focus order/visibility.** Locale picker and presenter caption toggle are
  reachable and operable by keyboard with a visible focus indicator.
- **4.1.3 Status Messages.** Caption segments announce via `aria-live="polite"`;
  partial→final merges do not spam the live region (merge-by-segment-id).
- **2.3.3 / prefers-reduced-motion.** Overlay scroll and adaptive viz transitions
  respect `prefers-reduced-motion`.

## Bounded claim (unchanged from S88)

The conformance claim remains **"core flows + captions/canvas AAA; broader app AA."**
This bound is deliberate and is the wording the marketing compliance gate
(`check:compliance-claims`) enforces — Qesto does not claim app-wide AAA.

## Test evidence

`canvas-contrast.test.ts`, `captions-overlay.test.ts` (24 — partial→final merge,
eviction, contrast math, font-size boundaries), `adaptive-viz-selection.test.ts`.
Full unit suite green at S89 (1774). Tooling axe-core a11y pass via
`npm run test:e2e:a11y` on the captioned-session flow is part of the S89→S90 deploy
validation.
