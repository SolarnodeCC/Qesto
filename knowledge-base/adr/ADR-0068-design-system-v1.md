---
id: ADR-0068
title: Design System v1 — Token patch, icon conventions, component radius
status: accepted
date: 2026-06-30
deciders: [remco.oostelaar@capgemini.com]
relates_to:
  - SPEC_DESIGN_SYSTEM_OVERVIEW
  - SPEC_FRONTEND
supersedes: []
---

# ADR-0068 — Design System v1: token patch, icon conventions, component radius

## Context

In June 2026 a set of portable HTML/CSS design kits were added to `design-system/` and `design_files/`. Those kits introduced semantic CSS custom-property aliases, a stricter icon policy (Lucide-only), and explicit radius rules for cards vs. interactive controls. The production React codebase was not yet aligned.

This ADR records the decisions made during the Polish Pass (2026-06-30) to bring `src/` into line with the design system.

---

## Decisions

### 1. Semantic token aliases in `src/styles.css`

**Decision:** Add a thin alias layer to `:root` (and `[data-theme="dark"]`) that maps short design-system names onto the existing palette:

```css
/* Added to :root */
--surface-elevated:  #FFFFFF;
--focus-ring:        0 0 0 3px rgba(20, 184, 166, 0.4);
--stagger-primary:   40ms;
--stagger-secondary: 20ms;
--lh-tight:   1.1;
--lh-snug:    1.3;
--lh-normal:  1.5;
--lh-relaxed: 1.6;

/* Added to [data-theme="dark"] */
--surface-elevated: #1C2540;
```

**Rationale:** The design kit uses these names throughout. Adding aliases avoids forking the tokens and keeps `src/styles.css` as the single source of truth.

**Consequence:** New components may use either the full `--color-*` names or these aliases interchangeably. Prefer aliases for surface/elevation roles; prefer full names for palette colors.

---

### 2. Lucide-only icon policy

**Decision:** All icons in `src/` **must** be imported from `lucide-react`. Inline `<svg>` markup for icons is forbidden.

```typescript
// ✅ Correct
import { Check, Loader2, Sparkles } from 'lucide-react'

// ❌ Forbidden
<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
```

**Single permitted exception:** The circular timer-arc progress indicator in `src/pages/Present.tsx`. It is a data-driven SVG (animated `strokeDashoffset`), not an icon, and has no Lucide equivalent.

**Rationale:**
- Lucide icons are tree-shaken, accessible, and sized via the `size` prop — no brittle `width`/`height` attributes.
- Inline SVGs bloat bundle size, are invisible to screen readers unless manually annotated, and drift from the design system when icons are updated.
- `lucide-react@1.22.0` (already a project dependency) covers all icons used across the codebase.

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
| Buttons, inputs, dropdown menus, badges | `rounded-lg` | 8 px |
| Pills / status badges | `rounded-full` | — |

**Rationale:** The design kit consistently uses 12 px for container surfaces and 8 px for interactive elements. Mixing `rounded-lg` on cards (previous default) produced visual inconsistency.

**Files updated in this pass:**
- `src/pages/dashboard/SessionCard.tsx` — card + thumbnail + skeleton: `rounded-lg` → `rounded-xl`
- `src/pages/join/QuestionVoteInput.tsx` — submit button: `rounded-lg` → `rounded-xl` (CTA primary, treated as card-weight element per design kit)

---

### 4. Launchpad component rebuild

All four Launchpad components were rebuilt to match the design kit:

| Component | Key changes |
|---|---|
| `JoinCodePanel` | Brand-gradient card, `text-gradient-brand` join code, unified CTA (Rocket/Zap/Loader2) |
| `PreFlightStrip` | `rounded-xl` card, `CircleCheckBig` header icon, divide-y check rows |
| `EnergizerPanel` | Violet icon well (`rounded-xl`), `STATE_BADGE` map |
| `QuestionList` | `GripVertical` drag handle, `KIND_BADGE` colored pills, AI generate panel |

---

## Consequences

- **CLAUDE.md rules 9 & 10** enforce these conventions for all future work (human and AI-agent).
- Any new component PR failing the Lucide-only or radius rules should be rejected at review.
- The design kit HTML files in `design-system/` and `design_files/` remain **reference only** — they use Lucide CDN links that must never be copied verbatim into production.
