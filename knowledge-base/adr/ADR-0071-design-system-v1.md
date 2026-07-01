---
id: ADR-0071
title: Design System v1 — Token aliases, Lucide-only icons, component radius
status: accepted
date: 2026-06-30
deciders: [remco.oostelaar@capgemini.com]
relates_to:
  - SPEC_DESIGN_SYSTEM_OVERVIEW
  - SPEC_FRONTEND
---

# ADR-0071 — Design System v1: token aliases, icon policy, component radius

## Context

In May–June 2026 a set of portable HTML/CSS design kits were added under `design-system/` and `design_files/`. Those kits introduced semantic CSS aliases, a Lucide-only icon policy, and explicit radius rules for cards vs. controls. The production `src/` codebase was not yet aligned. This ADR records the decisions made during the Polish Pass (2026-06-30).

---

## Decisions

### 1. Semantic token aliases in `src/styles.css`

**Decision:** `src/styles.css` already had `--color-surface-elevated`, `--shadow-focus-ring`, and `--motion-stagger-primary` before this pass. The design kit uses shorter names (`--surface-elevated`, `--focus-ring`, `--stagger-primary`) that don't match those. Rather than rename every production token, this pass added a thin alias layer to `:root` (and `[data-theme="dark"]`) — `--surface-elevated`, `--focus-ring`, `--stagger-primary`, `--stagger-secondary`, `--lh-tight`, `--lh-snug`, `--lh-normal`, `--lh-relaxed` — so design-kit markup can be copied into `src/` without a find-and-replace pass on token names.

**Consequence:** Two names now resolve to (mostly) the same value: `--color-surface-elevated` / `--surface-elevated`, `--shadow-focus-ring` / `--focus-ring`, `--motion-stagger-primary` / `--stagger-primary`. New production components should keep using the existing longer names (`--color-surface-elevated`, `--shadow-focus-ring`, `--motion-stagger-primary`); the short aliases exist for design-kit portability, not as the preferred production API.

---

### 2. Lucide-only icon policy

**Decision:** All icons in `src/` **must** be imported from `lucide-react`. Inline `<svg>` markup for icons is forbidden.

```typescript
// ✅ Correct
import { Check, Loader2, Sparkles, X } from 'lucide-react'

// ❌ Forbidden — never write raw icon SVG in component files
<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
```

**Single permitted exception:** The circular timer-arc progress indicator in `src/pages/Present.tsx`. It is a data-driven SVG (animated `strokeDashoffset`), not an icon, and has no Lucide equivalent.

**Rationale:** Lucide icons are tree-shaken, accessible, and sized via the `size` prop. Inline SVGs bloat bundle size, are invisible to screen readers unless manually annotated, and drift from the design system when icons change. `lucide-react@1.22.0` (existing project dependency) covers all icons used across the codebase.

**Files updated in this pass:**

| File | Change |
|---|---|
| `src/pages/dashboard/AllSessionsSection.tsx` | `<svg>` search → `<Search>` |
| `src/pages/join/WaitingScreen.tsx` | `<svg>` clock → `<Clock>` |
| `src/pages/join/QuestionVoteInput.tsx` | `<svg>` checkmark → `<Check>` |
| `src/pages/join/PostVoteResults.tsx` | `<svg>` checkmark → `<Check>` |
| `src/pages/join/LiveEnergizerPanels.tsx` | `<svg>` checkmark → `<Check>` |
| `src/pages/SessionConfig.tsx` | `<svg>` spinner → `<Loader2>`, sparkle → `<Sparkles>` |
| `src/components/SessionWizard.tsx` | `<svg>` close ✕ → `<X>` |

---

### 3. Component border-radius convention

**Decision:** Strict two-tier radius rule:

| Element type | Tailwind class | CSS value |
|---|---|---|
| Cards, panels, modals, info boxes | `rounded-xl` | 12 px |
| Buttons, inputs, dropdown menus, small badges | `rounded-lg` | 8 px |
| Pills / status badges | `rounded-full` | — |

**Files updated:** `src/pages/dashboard/SessionCard.tsx` (card + skeleton: `rounded-lg` → `rounded-xl`), `src/pages/join/QuestionVoteInput.tsx` (primary CTA submit: `rounded-lg` → `rounded-xl`).

---

### 4. Launchpad component rebuild

All four Launchpad components were rebuilt to match the design kit:

| Component | Key changes |
|---|---|
| `src/components/launchpad/JoinCodePanel.tsx` | Brand-gradient card, `text-gradient-brand` join code, unified CTA (Rocket/Zap/Loader2), Share2 button |
| `src/components/launchpad/PreFlightStrip.tsx` | `rounded-xl` card, `CircleCheckBig` header icon, divide-y check rows, amber error banner |
| `src/components/launchpad/EnergizerPanel.tsx` | Violet icon well (`rounded-xl`), `STATE_BADGE` color map |
| `src/components/launchpad/QuestionList.tsx` | `GripVertical` drag handle, `KIND_BADGE` colored pills, Sparkles AI generate panel |

---

## Consequences

- **CLAUDE.md Hard Rules 9 & 10** enforce these conventions for all future work (human and AI-agent).
- Any new component PR containing inline `<svg>` icons or `rounded-lg` on a card-level element should be rejected at review.
- The design kit HTML files in `design-system/` and `design_files/` remain **reference only** — they load Lucide via unpkg CDN and must never be copied verbatim into production.
