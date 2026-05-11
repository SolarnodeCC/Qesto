# Qesto — Website Design Spec

_Hub: [Documentation map](../README.md)._

_Last updated: 2026-04-19_
_Owner: Frontend + PO + Marketing_
_Status: Draft — pending review_
_Related: [`design-tokens.README.md`](./design-tokens.README.md) (token file + engineering rules), `docs/spec/SPEC_FRONTEND.md`, `docs/BACKLOG.md` (§12 Website Design Wave)_

---

## 1. Purpose & Scope

This document is the single source of truth for the visual, interaction, and narrative design of the public-facing Qesto website and the authenticated dashboard shell. It:

1. Captures the current-state design baseline (what ships in `src/`) and the gaps an external design review surfaced.
2. Defines the target-state design language — colour, typography, spacing, motion, component conventions.
3. Translates the review's recommendations into concrete, buildable backlog items.
4. Companion to `design-tokens.json` in this folder, which is the machine-readable token source.

Out of scope: presenter/voter runtime (see `docs/spec/SPEC_FRONTEND.md#routes--pages` and `docs/spec/SPEC_REALTIME.md`), admin panel redesign, mobile-remote UX.

---

## 2. Surfaces in scope

| Surface | Route | File | Audience |
|---|---|---|---|
| Landing (hero) | `/` | `src/pages/Home.tsx` | Unauthenticated visitors |
| Pricing | `/pricing` | `src/pages/Pricing.tsx` | Unauthenticated + trial users |
| Solutions | `/solutions/*` | `src/pages/scenarios/*` | Industry buyers |
| Login / Magic link | `/login`, `/auth/callback` | `src/pages/Login.tsx` | Returning users |
| Dashboard shell | `/dashboard` | `src/pages/Dashboard.tsx` + tabs | Authenticated hosts |
| Session Launchpad (pre-live) | `/session/:id/config` | `src/pages/SessionConfig.tsx` | Authenticated hosts — see §5.7 |
| Join flow | `/join/:code`, `/j/:code` | `src/pages/JoinPage.tsx` | Participants |

The presenter full-screen view (`/present/:sessionId`) inherits tokens but has its own component spec.

---

## 3. Current-state summary

Strengths validated in review (7.5/10 overall):

- Clean, minimalist layouts with generous whitespace and no visual clutter.
- Clear primary CTAs on the landing page (Join / Present).
- Teal → violet gradient is ownable and creates good visual separation.
- WCAG AA-level contrast on top flows.
- Dashboard is functional and readable.

Weaknesses the review flagged:

- **AI is invisible.** The landing page talks about "real-time decisions" but never names AI; the dashboard has no insights surface; the "+ New session" flow hides AI-powered question generation.
- **Dashboard feels transactional.** Sessions list without analytics, weak "0 / ~1 decisions this month" metric, no preview of themes or key insights.
- **Typography reads as system default.** Body text lacks a distinctive voice; a modern geometric or neo-grotesque would feel more premium.
- **Visual feedback on AI features is missing.** No sparkle / "AI-powered" badging, no hover state polish on the primary gradient button, logo could carry more weight.

Both the strengths and the gaps inform the design language in §4.

---

## 4. Design language (target state)

### 4.1 Brand narrative

Qesto helps teams feel the pulse of the room, amplified by AI. Every surface should reinforce three beats, in order:

1. **Real-time.** Something is happening right now, and we make it visible.
2. **AI-amplified.** Qesto doesn't just collect answers; it suggests, summarises, and surfaces.
3. **Private by default.** Anonymity modes, GDPR consent, no third-party AI.

The hierarchy matters: we never lead with AI at the cost of realism or trust. "Feel the pulse — AI amplifies it" is directionally what every surface should say in its own register.

### 4.2 Colour

The existing teal → violet brand holds. The review confirmed it feels modern and ownable. We formalise it:

| Role | Token | Hex | Notes |
|---|---|---|---|
| Primary 600 | `color.teal.600` | `#0D9488` | Default action, focused text |
| Primary 500 | `color.teal.500` | `#14B8A6` | Gradient start, hover of 600 |
| Primary 400 | `color.teal.400` | `#2DD4BF` | Tint / chart bar |
| Accent 600 | `color.violet.600` | `#7C3AED` | Gradient end, AI emphasis |
| Accent 500 | `color.violet.500` | `#8B5CF6` | AI badge fill, link secondary |
| Signal success | `color.signal.success` | `#22C55E` | Positive state |
| Signal warning | `color.signal.warning` | `#F59E0B` | Warning, non-blocking |
| Signal error | `color.signal.error` | `#DC2626` | Error, destructive |
| Signal info | `color.signal.info` | `#0EA5E9` | Info, tips |
| Pulse 50–900 | `color.pulse.*` | `#FAFAFA` → `#0A0F1E` | Neutral scale |

**Gradients**
- `gradient.brand`: `linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)` — primary CTA, hero.
- `gradient.brandSubtle`: `linear-gradient(135deg, #F0FDFA 0%, #F5F3FF 100%)` — card backdrops, empty states.
- `gradient.ai`: `linear-gradient(135deg, #8B5CF6 0%, #2DD4BF 100%)` — reserved for AI surfaces (inverted brand direction to read as "AI layer on top of product").

**AI surface rule.** Any component whose primary job is to surface AI output (Insights panel, AI-suggested question chip, themes preview) uses `gradient.ai` or `color.violet.500` as its dominant accent, accompanied by the sparkle mark (§4.6). This is how users learn "violet + sparkle = AI at work" across the product.

### 4.3 Typography

The review called out that the current stack reads as "system-like." We adopt a distinctive but neutral pairing that also already exists in `src/ui/tokens.ts`:

| Role | Family | Fallback | Usage |
|---|---|---|---|
| Display | `Syne` (600/700) | `ui-sans-serif, system-ui` | Hero headlines, page titles |
| Body | `Inter` (400/500/600) | `ui-sans-serif, system-ui` | All prose, UI labels |
| Mono | `JetBrains Mono` | `ui-monospace` | Session codes, short codes |

**Why Inter over DM Sans.** DM Sans (current body) is pleasant but reads generic at small sizes on dense dashboards. Inter has tighter forms at 13–15px and pairs better with Syne for headings. This replaces the `DM Sans` / `DM Mono` entries currently in `src/ui/tokens.ts`.

**Scale** (rem, 16px base):

| Token | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `text.display.xl` | 3.75 (60) | 1.05 | 700 | Hero H1 |
| `text.display.l` | 3.00 (48) | 1.1 | 700 | Section H1 |
| `text.heading.l` | 2.00 (32) | 1.2 | 600 | Page H2 |
| `text.heading.m` | 1.50 (24) | 1.3 | 600 | Card H3 |
| `text.heading.s` | 1.25 (20) | 1.35 | 600 | Subhead |
| `text.body.l` | 1.125 (18) | 1.55 | 400 | Landing body |
| `text.body.m` | 1.00 (16) | 1.5 | 400 | Default body |
| `text.body.s` | 0.875 (14) | 1.5 | 400 | Dense UI, table |
| `text.caption` | 0.75 (12) | 1.4 | 500 | Badge, metadata |

### 4.4 Spacing & layout

4-pt base grid. Spacing token is the multiplier.

`space.0` 0 · `space.1` 4 · `space.2` 8 · `space.3` 12 · `space.4` 16 · `space.5` 24 · `space.6` 32 · `space.8` 48 · `space.10` 64 · `space.12` 96.

**Container widths**
- `container.prose`: max 680px — blog, legal, solutions detail.
- `container.content`: max 1120px — landing, pricing.
- `container.app`: max 1280px — dashboard.

**Breakpoints** (Tailwind defaults, formalised):
`sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536.

### 4.5 Radius, elevation, motion

| Token | Value | Use |
|---|---|---|
| `radius.sm` | 6px | Chips, tags |
| `radius.md` | 10px | Buttons, inputs |
| `radius.lg` | 16px | Cards |
| `radius.xl` | 24px | Hero panels, modals |
| `radius.pill` | 9999px | Pills, badges |
| `shadow.card` | `0 2px 8px rgba(10,15,30,0.06)` | Default card |
| `shadow.elevated` | `0 8px 24px rgba(10,15,30,0.10)` | Hover card, modal |
| `shadow.teal` | `0 4px 20px rgba(20,184,166,0.25)` | Primary CTA hover |
| `shadow.ai` | `0 4px 20px rgba(139,92,246,0.25)` | AI surface hover |
| `motion.fast` | 120ms `cubic-bezier(0.2, 0, 0, 1)` | Hover, focus |
| `motion.base` | 200ms `cubic-bezier(0.2, 0, 0, 1)` | Modals, sheets |
| `motion.slow` | 360ms `cubic-bezier(0.2, 0, 0, 1)` | Page transitions |

**CTA hover rule.** Primary gradient button scales 1.02, lifts `shadow.card` → `shadow.teal`, transitions in `motion.fast`. The review called this out explicitly as missing.

### 4.6 Iconography & the AI mark

- Base icon set: `lucide-react` (already installed). Stroke 1.75, size tokens `icon.s` 16, `icon.m` 20, `icon.l` 24.
- **AI mark.** A 4-point sparkle glyph (`Sparkles` from lucide, or a custom SVG if bespoke) renders in `color.violet.500` at `icon.s` and accompanies every AI surface. Rules:
  - Prefixes any AI-suggested content: "✦ AI suggested 3 follow-up questions".
  - Appears inside the "+ New session" button to hint the wizard uses AI.
  - Appears on dashboard cards that carry AI output (Insights, themes).

### 4.7 Logo

Current Qesto wordmark reads clean but light. Recommendation: increase optical weight by one step (Syne 700 instead of 600 at small sizes) and add a 6px cap-height sparkle to the left of the wordmark — reinforcing the "Qesto = feel the pulse, AI amplifies it" narrative.

---

## 5. Layout system

> This section is the structural backbone the rest of the spec leans on. Every component in §5.1 onward inherits grid, rhythm, density, and template rules from here. Layout drift between surfaces is the single biggest contributor to a "feels system-default" impression — the rules below exist to eliminate it.

### 5.0.1 Baseline rhythm

A **4-pixel baseline** governs every vertical measurement: line-heights, row heights, input heights, stack gaps. Multiples of 4 are the rule; 8 and 16 are the workhorses. Font line-heights in §4.3 round to 4-pixel values at our reference sizes (16→24, 18→28, 24→32, 32→40, 48→52, 60→64). This means a paragraph aligned to the baseline will visually lock to any adjacent element using the same token scale — the source of "designed, not assembled" feel.

All spacing tokens (`space.1` → `space.12`) are 4-multiples. Non-4 values are banned from production code; a lint rule should flag them (see `LAYOUT-GRID-01`).

### 5.0.2 Responsive column grid

A single column grid, re-binned at four breakpoints. Formula: `column = (containerWidth − 2·margin − (columns−1)·gutter) / columns`.

| Breakpoint | Range | Columns | Gutter | Margin | Container | Use |
|---|---|---|---|---|---|---|
| `mobile` | 320–639px | 4 | 16px | 16px | fluid | Phones |
| `tablet` | 640–1023px | 8 | 24px | 32px | fluid | Tablets, split laptop |
| `desktop` | 1024–1439px | 12 | 24px | 48px | max 1280px | Default |
| `wide` | ≥1440px | 12 | 32px | 80px | max 1280px (centered) | Large monitors |

The container ladder from §4.4 sits inside this grid:
- `container.prose` (680) = 8 of 12 columns at desktop, full 8 at tablet.
- `container.content` (1120) = full 12 at desktop, centered at wide.
- `container.app` (1280) = full 12 at desktop, saturated at wide.

**Rule:** every surface declares its column span at each breakpoint in the token or component definition; no surface uses raw pixel widths except media (see 5.0.9 aspect ratios).

### 5.0.3 Density tiers

Three density presets that apply to list/table/dense surfaces. Host sets density per workspace; default is Comfortable.

| Tier | Row height | Cell padding | Icon size | Font | Use |
|---|---|---|---|---|---|
| Compact | 32px | 8px | 16px | `body.s` | Admin tables, ops lists |
| **Comfortable** (default) | 48px | 12px | 20px | `body.m` | Dashboard sessions list, templates |
| Spacious | 64px | 16px | 24px | `body.l` | Marketing surfaces, empty states |

Density is a prop on list/card primitives, not a CSS override. Switching density does not shift the containing grid — only in-row measurements change. This keeps page section rhythm stable when users toggle density.

### 5.0.4 Page templates

Every surface maps to one of five templates. Templates are opinionated layouts with named slots; components go into slots.

**T1 · Landing** — full-bleed hero, centered max `container.content`, alternating sections at 96px vertical rhythm (`space.12`). Header is 72px fixed-top with 24px internal padding. Footer is 2-column at desktop, stacked below `md`.

**T2 · Dashboard** — left sidebar 240px collapsible to 64px, top bar 64px, main slot uses `container.app`, content gutters 32px at desktop. Tabs sit directly under the top bar with 16px horizontal padding.

**T3 · Content** — `container.prose` centered, left nav optional (240px), right TOC optional (200px). Max line-length 70ch enforced.

**T4 · Wizard (modal)** — centered modal, 640px width, 90vh max, internal grid is single-column with 24px horizontal padding and 32px vertical rhythm between step sections. See §5.6 for step-level detail. At `mobile` breakpoint the modal becomes a full-screen sheet (100vw × 100vh) with a fixed bottom action bar.

**T5 · Present (full-viewport)** — 100vw × 100dvh, safe-area aware, no scroll. Internal layout is a 3-row stack (header 72px / content fill / footer 96px) with 5% horizontal padding and centered content at max `container.content`.

**T6 · Session Launchpad (pre-live)** — two-column, left **action rail** 320px fixed, right **content rail** fluid to `container.content`. The action rail carries share controls, presenter remote, and the primary `Open lobby` CTA. The content rail carries session identity and the question list. Collapses to a single column stacked at `tablet`, with the action rail moving to the top; at `mobile` the `Open lobby` CTA becomes a fixed bottom action bar per §5.0.6. See §5.7.

Every template declares: header height, content max-width, vertical rhythm, side-padding per breakpoint, sticky regions, scroll container.

### 5.0.5 Section rhythm

Vertical spacing between page sections is one of three values, chosen for the section's semantic weight:

- `rhythm.tight` = 48px (`space.8`) — adjacent sections of the same hierarchy.
- `rhythm.base` = 96px (`space.12`) — default between major sections.
- `rhythm.loose` = 160px — hero-to-first-section on landing; marketing breakpoints.

At `tablet` all three compress by 25%, at `mobile` by 50%. Never interpolate between named values.

### 5.0.6 Sticky & affixed regions

Four things are allowed to be sticky; nothing else is.

| Region | Offset from top | Shadow on scroll | Z-index |
|---|---|---|---|
| Top bar | 0 | `shadow.card` appears after 8px scroll | `zIndex.sticky` |
| Section tabs (Dashboard) | 64px (below top bar) | none | `zIndex.sticky` |
| Wizard action bar (mobile) | bottom 0 | `shadow.elevated` (inverted) | `zIndex.overlay` |
| Toast stack | top 80px / bottom 16px (mobile) | `shadow.elevated` | `zIndex.toast` |

**Rule:** no sticky element may occlude the element that triggered it. Conformance to WCAG 2.2 SC 2.4.11 (Focus Not Obscured) is a release gate — `LAYOUT-A11Y-01`.

### 5.0.7 Focal hierarchy per viewport

Every surface declares three attention anchors in order: **primary** (one), **secondary** (up to two), **tertiary** (everything else). Visual weight rules:

- Primary: gradient surface OR `text.display.*` OR AI mark in full colour. Centered or upper-left per F-pattern.
- Secondary: `heading.l/m`, outline button, icon-only accent.
- Tertiary: `body.m/s`, neutral text, subdued controls.

A surface that has two things competing to be primary — per the original review's "dashboard feels transactional" critique — is broken. Review gate: list every surface's primary anchor in a one-row table before ship.

### 5.0.8 Skeleton, empty, error, loading parity

Every async surface must ship four states at parity of geometry. Drift between loaded and skeleton is the #1 cause of layout jank.

| State | Geometry rule |
|---|---|
| Loaded | Baseline |
| Skeleton | Same grid, same heights, shimmer gradient `linear-gradient(90deg, {color.pulse.100} 0%, {color.pulse.200} 50%, {color.pulse.100} 100%)` animating 1.4s linear infinite |
| Empty | Same grid, centered illustration or icon (80×80), heading `heading.s`, supporting `body.m`, one primary CTA |
| Error | Same grid, error illustration, `heading.s` headline, `body.m` explanation + retry CTA, optional `View details` disclosure |

Surfaces this applies to: dashboard sessions list, templates tab, teams tab, Insights tab (all four), session results, AI generate in wizard, decisions search, admin tables.

### 5.0.9 Media & aspect ratios

Media never uses raw pixel dimensions; it uses ratio tokens and fills its column span.

- `ratio.square` 1:1 — avatars, small cards.
- `ratio.portrait` 4:5 — people photos, feature cards.
- `ratio.landscape` 16:9 — screenshots, video embeds.
- `ratio.wide` 21:9 — hero imagery only.
- `ratio.golden` 1.618:1 — feature panels where nothing else fits.

All images are AVIF with webp fallback and a blurhash placeholder that matches the skeleton shimmer.

### 5.0.10 Motion choreography

Motion is layout — things arriving and leaving are part of the composition. Rules:

- **Entry direction.** Page transitions: 8px upward fade-in, `motion.base` duration, `motion.easing.enter`. Modals: scale 0.98→1 + fade, same easing. Toasts: 8px inward from their edge.
- **Stagger.** Lists of ≤6 items stagger children at 40ms. Lists of 7–20 stagger at 20ms. Over 20, no stagger (perceived as slow).
- **Spring.** For draggable re-ordering and chip accept/dismiss: spring `stiffness 280, damping 28, mass 1`. All other motion uses the eased timing tokens.
- **Respect `prefers-reduced-motion: reduce`.** All non-essential motion resolves to instantaneous state change; opacity fades ≤60ms are allowed for perceived continuity.

### 5.0.11 Accessibility as layout

- Every page defines landmark regions in this order: `banner` (top bar), `navigation` (sidebar or tabs), `main` (primary content), `complementary` (right rail if any), `contentinfo` (footer).
- A skip-link ("Skip to main content") is the first focusable element on every template; visually hidden until focused, then pinned top-left with `shadow.teal`.
- Focus order follows visual order; no `tabindex > 0`. Focus ring uses `shadow.focusRing`, minimum 3:1 contrast against any adjacent background.
- Modal wizards trap focus within the modal; `Esc` closes; focus returns to the invoking element.
- Minimum tap target: 44×44px (iOS HIG) on `mobile` and `tablet`; 32×32 acceptable on `desktop` for secondary controls.

### 5.0.12 Optical alignment rules

Small things, big impact:

- Icons paired with text share an optical baseline, not geometric. Lucide icons at 16px need a 1px downward nudge to align with `body.m` x-height.
- Numeric columns in tables right-align; labels left-align; currency uses tabular figures (`font-variant-numeric: tabular-nums`).
- Buttons with icon-and-label use 8px gap for `body.m`, 6px for `body.s`.
- Card edges snap to the column grid; inner padding does not. A 16-unit `space.4` inner padding is standard for cards.
- Headings have `text-wrap: balance`; body has `text-wrap: pretty`.
- Section dividers are 1px `{color.surface.border}`, never shadows.

### 5.0.13 Layout review checklist (release gate)

Before any design-wave PR merges, a reviewer answers yes to all:

1. Does every surface declare its column span per breakpoint?
2. Do all vertical measurements land on the 4px baseline?
3. Is there exactly one primary attention anchor?
4. Do async surfaces have all four states at geometric parity?
5. Do sticky regions honour 2.4.11 Focus Not Obscured?
6. Are landmark regions and a skip-link present?
7. Does motion respect `prefers-reduced-motion`?
8. Are density tiers honoured on list surfaces without shifting page rhythm?
9. Do media elements use ratio tokens rather than pixel dimensions?
10. Does the surface's primary CTA hover state conform to §4.5?

One "no" blocks the merge.

---

## 5.1–5.6 — Component specs (net-new or updated)

_All components below inherit the grid, rhythm, density, and template rules from §5.0. Column spans and slot placement are called out per component._

### 5.1 Landing — Hero

**Current:** Clean hero, clear Join / Present CTAs, no AI mention.

**Template:** T1 Landing. **Column span:** 8 of 12 at desktop (centered), full at tablet, full at mobile. **Section rhythm:** `rhythm.loose` to next section. **Primary anchor:** the gradient H1. **Secondary anchors:** Join / Present CTAs. **Tertiary:** feature strip, subhead.

**Target:**

- H1 (`text.display.xl`): retains product promise. Text spans columns 3–10 at desktop; `text-wrap: balance`.
- **Subhead (new):** "AI-powered questions. Real-time insights. Private by default." — `text.body.l`, `color.pulse.600`. Max 52ch to preserve rhythm.
- **Feature strip (new):** three-up row below CTAs, each with sparkle icon:
  1. AI suggests follow-ups
  2. Real-time analysis
  3. Instant PowerPoint reports

  Stacks to a single column below `md`. Items entry-stagger at 40ms (§5.0.10).
- CTAs unchanged in placement; primary button receives new hover state (§4.5). CTAs occupy columns 5–8 at desktop; full-width at mobile with 16px gap stacked.
- Background: `gradient.brandSubtle` lower band with a faint radial pulse animation (opacity 0.06, 6s loop) — respects `prefers-reduced-motion`.
- **Skeleton / empty / error:** Landing is static — not applicable. But the Solutions pages linked from here follow §5.0.8 parity.

**Acceptance criteria:**
- Given a user lands on `/`, when hero renders, then subhead names "AI" within the first viewport.
- Given a user with `prefers-reduced-motion: reduce`, when hero renders, then the radial pulse is static.
- Given a keyboard user, when they tab into the CTA, then focus ring is visible at 3:1 contrast minimum.

### 5.2 Dashboard — Insights tab (new)

A fourth tab alongside Sessions / Templates / Teams named **Insights**.

**Template:** T2 Dashboard. **Column span:** 12 at desktop. **Density:** Comfortable. **Primary anchor:** Top themes card. **Secondary:** Summary strip, trend spark.

Default state shows:

- **Summary strip:** 3 metric cards — "Decisions this month," "Avg. participants," "AI-detected themes (30d)." Each card spans 4 columns at desktop, 4 of 8 at tablet, full at mobile. AI mark appears when metric is AI-derived. Each card has a skeleton row at 48px height per §5.0.8.
- **Top themes card (AI):** list of up to 5 themes detected across recent sessions with a confidence chip ("AI confidence: 92%"). Spans columns 1–8 at desktop, stacks below `md`. Empty state: centered illustration, heading "No themes yet", body "Run your first session and we'll surface what your team talked about.", primary CTA `View templates` — geometry identical to loaded state per §5.0.8.
- **Trend spark:** 30-day line of participant count. Spans columns 9–12 at desktop. Empty state shares the same grid slot.

Stagger: summary strip cards enter at 40ms, themes and trend at 60ms offset from strip.

Backed by `useInsights(teamId)` hook — extends the existing `src/hooks/useInsights.ts` which today only accepts a `sessionId`. See backlog §12 items **DX-INSIGHTS-01** and **DX-INSIGHTS-02**.

### 5.3 Dashboard — Sessions list card (updated)

**Template:** T2 Dashboard. **Density:** Comfortable default, host can switch to Compact. **Column span:** 12 at desktop. **Primary anchor per row:** session title.

Each session row gains:

- An **AI badge** when the session was built with AI-suggested questions ("✦ AI-assisted"). Placed on the same baseline as the title, 8px optical gap (§5.0.12).
- A **quick insight chip** after close ("Top theme: Onboarding"). Clickable → deep link to session results.
- The current "Decisions this month: 0/~1" metric is replaced by the Insights tab summary strip — this metric does not carry its weight on the Sessions view.

Row height: 48px (Comfortable) / 32px (Compact). Switching density does not change the surrounding grid per §5.0.3. Skeleton, empty, error per §5.0.8. Empty-state copy: "Your sessions will live here. Start one from a template — it's the fastest path."

### 5.4 "+ New session" button (updated)

- Gains the sparkle mark to the left of the label.
- Hover reveals a tooltip: "AI will suggest questions based on your topic."
- Opens the wizard where AI suggestions appear inline as chips the host can accept, edit, or dismiss (see backlog **AI-VIS-02**).

### 5.5 AI badge component (new)

A reusable `<AIBadge variant="assisted" | "generated" | "analyzed" />` primitive:

- `assisted` — ✦ AI-assisted (teal on violet).
- `generated` — ✦ AI-generated (violet on white).
- `analyzed` — ✦ AI-analyzed (violet with teal dot).
- Radius `radius.pill`, padding `space.1 space.2`, text `text.caption`.
- Accessible: always renders visible text, never icon-only.

### 5.6 Session Creation Wizard (detailed flow)

The "+ New session" wizard is the single most important host-facing flow: it sets up the question bank, energizer, settings, and opens the lobby. A host who completes this wizard will, in almost all cases, run a live session. Every friction point here compresses the funnel.

**Template:** T4 Wizard (modal). **Column grid:** single-column, 592px content width inside a 640px modal (24px horizontal padding each side). **Vertical rhythm:** 32px between step sections, 24px between field groups, 16px between label and input. Field heights land on 4px baseline (40px inputs, 48px buttons).

The wizard is a modal dialog anchored on the dashboard, width 640px, radius `radius.xl`, shadow `shadow.elevated`, with a dimmed backdrop at `rgba(10,15,30,0.48)` and a top-right close control. At `mobile` the modal becomes a full-screen sheet with a fixed bottom action bar (Back / Next) per §5.0.6.

**Step indicator.** A caption reading `QUESTIONS · STEP 2 OF 5` in `text.caption` with `color.pulse.500` letter-spacing `0.08em` uppercase. Step count is 5 across all flows. Progress is linear — a thin 2px bar at the top of the modal fills `gradient.brand` left-to-right proportional to step.

**Navigation controls.** `Back` (secondary button, left) and `Next` (primary gradient button, right) are always visible on steps 1–5. `Next` is disabled until the step's required fields validate. On step 5 the primary CTA reads `Start session` and triggers DRAFT → LIVE.

All step copy lives under the `wizard` i18n namespace (`public/locales/<lang>/wizard.json`). Five locales in parity: EN, NL, DE, FR, ES.

#### Step 1 · Basics — "What is the session about?"

Two inputs, both bound to the DRAFT session record:

| Field | Required | Validation | Token |
|---|---|---|---|
| Session title | Yes | 3–80 chars | `text.body.m` input |
| Goal of the session | Yes | 10–400 chars, multi-line | `text.body.m` textarea |

The goal is required because the AI sub-flow uses it as grounding context (§ Step 2 AI). Placeholder copy: "e.g. Team reflection Q2" and "e.g. Gain insight into how the team experienced the sprint...". On `Next`, the wizard calls `POST /api/sessions` (DRAFT-API) and stores the returned `sessionId` in wizard state.

**Acceptance criteria:**
- Given an empty title, when the user clicks `Next`, then the `Next` button remains disabled and the title input shows `aria-invalid="true"` with inline message "Give your session a title".
- Given a valid title and goal, when the user clicks `Next`, then a DRAFT session is persisted and the wizard advances to step 2.

#### Step 2 · Questions — "How do you want to add questions?"

Three-up radio-card picker. Each card is 100% wide of the modal content area, radius `radius.lg`, padding `space.4`, border `1px solid {color.surface.border}`, hover state lifts border to `{color.surface.borderStrong}` and raises shadow from `shadow.card` to `shadow.elevated` over `motion.fast`.

| Option | Icon | Subcopy | Downstream |
|---|---|---|---|
| Write yourself | pencil | Write and manage your own questions | Manual editor |
| **AI generate** | ✦ sparkle (`color.violet.500`) | Give a prompt, we generate questions | AI sub-flow below |
| From template | clipboard | Choose from proven question sets | Template picker |

The AI card carries the sparkle mark per §4.6. This is the single most important surface for making AI visible (pairs with backlog **AI-VIS-02**).

#### Step 2a · AI sub-flow

Selecting **AI generate** transitions the step-2 pane (without advancing the step counter) to the AI-generation surface. The flow is:

**1. Consent gate (blocking).** A checkbox with label "I agree that my session title and goal will be processed by AI" is unchecked by default. Until it is checked, the `Generate now` and `Send` buttons are disabled and a tooltip explains why. Consent is logged via the existing GDPR audit trail (`AUDIT_KV`) with the event `wizard_ai_consent_granted`, session id, and UTC timestamp. Host can revoke by unchecking, which also revokes any staged generation.

**2. Grounding summary.** An info panel in `color.surface.backgroundSubtle` echoes the goal back: `I see session "<title>" with goal: "<goal>". Tell me which aspect to focus on, or click 'Generate now'.` This serves two purposes — it confirms what AI sees, and it reassures the host no other data is used.

**3. Two paths to generate.**
- **`Generate now`** button, primary, uses `gradient.ai` (violet → teal) with the sparkle mark. This generates from title + goal alone.
- **Refine prompt** — a text input with a `Send` secondary button lets the host add focus ("team morale", "sprint velocity blockers", etc.). Enter submits. Max 200 chars.

Both paths call Workers AI via `c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', …)` per CLAUDE.md hard rule #1. Never Anthropic API. The prompt is templated server-side so the client only sends `{sessionId, refinement?}`.

**4. Streaming state.** While generating, the `Generate now` button shows an inline spinner, the question list area fades to a shimmer placeholder (three skeleton rows at 80%, 65%, 90% width). Time budget: 4s p95. On timeout (>12s) the wizard shows "Generation is slow — try again?" and stays on this surface.

**5. Review & edit (new surface, still step 2).** Once generation returns, the host sees the drafted questions as an editable list. Each row is an **AI-generated question card** with three affordances:

| Affordance | Control | Behaviour |
|---|---|---|
| Edit the prompt text | Inline editable `<textarea>`, autosave on blur | Saves to wizard state; does not trigger re-generation |
| Change question type | Segmented control: **Multiple choice · Ranking · Open (Wordcloud)** | Switching type validates constraints (see below) |
| Accept / dismiss | Check (accept, default) / X (dismiss the whole row) | Dismissed rows are soft-hidden with an `Undo` link for 6s |

A footer strip reads "✦ AI generated N questions — edit, reorder, or regenerate" with a secondary `Regenerate` button that re-runs generation (host keeps accepted rows by default; toggle reveals "Replace all").

**6. Per-type validation.** When the host switches question type on a row, the wizard enforces:

- **Multiple choice:** exactly **3 to 5 answer options**. On generate, AI produces 4 by default. If fewer than 3 after edits, the row shows an inline error "Multiple choice needs 3–5 answer options" and `Next` is disabled. Options are editable and reorderable; a "+ Add option" appears when count < 5, and a per-option "✕" appears when count > 3.
- **Ranking:** 3–8 items. Default 5.
- **Open (Wordcloud):** no options; the row collapses the options panel and shows a placeholder "Participants will type a single word or short phrase". Optional constraint: `maxChars` (default 20) — editable in an advanced disclosure.

Switching types preserves the question prompt but clears option state with a one-time confirmation when options exist ("Switch to Wordcloud? Your 4 answer options will be removed.").

**7. Instrumentation.**

| Event | When | Properties |
|---|---|---|
| `wizard_ai_consent_granted` | Consent checkbox ticked | `sessionId` |
| `wizard_ai_generate_clicked` | `Generate now` or `Send` | `sessionId`, `refinementPresent`, `regenerated` |
| `wizard_ai_generate_returned` | Generation resolves | `sessionId`, `durationMs`, `questionCount` |
| `wizard_ai_question_edited` | Row text blur changed | `sessionId`, `questionIndex` |
| `wizard_ai_question_type_changed` | Segmented control | `sessionId`, `from`, `to` |
| `wizard_ai_question_dismissed` | Row ✕ clicked | `sessionId`, `questionIndex` |

**Acceptance criteria (selected):**
- Given the host has not ticked the consent checkbox, when they click `Generate now`, then the button remains disabled and an inline tooltip reads "Please confirm AI processing first".
- Given a multiple-choice question with 2 options, when the host clicks `Next`, then `Next` remains disabled and the row shows the 3–5 validation error.
- Given generation takes >12s, when the host is on the generate surface, then a retry affordance appears and no partial questions are persisted.
- Given the host changes a question from MC to Wordcloud with existing options, when they confirm, then options clear and the row collapses to the Wordcloud state.
- Given the host dismisses a row then clicks `Undo` within 6s, when undo resolves, then the row is restored with the same content.

#### Step 3 · Energizer — "Add energizer?"

Binary choice card pair at the top (`Yes, please` / `No, skip`). Selecting `Yes, please` reveals a 2×2 grid of energizer formats below:

| Format | Subcopy | Maps to component |
|---|---|---|
| Emoji Poll | Quick sentiment check via emojis | `src/components/energizers/EmojiPulse.tsx` |
| Fastest Finger | Who's quickest with the right answer? | `SpeedRound.tsx` |
| Team Quiz | Short competitive warm-up quiz | existing speed-round variant |
| Wordcloud | Participants type one word, shared live | reuses wordcloud question type |

Selecting `No, skip` advances directly. Energizer choice is stored on the DRAFT session and runs as the first round when the session goes LIVE.

#### Step 4 · Settings — "Session settings"

Three grouped controls:

**Anonymity** (radio, default Fully anonymous): Fully anonymous · Partially anonymous · Not anonymous. Maps to `AnonymityMode` in `types.ts`.

**Voting policy** (radio, default One vote): One vote · Multiple votes · Reactions. Maps to `allowMultipleVotes` and reaction-mode flags.

**Session mode** (card pair): **Reflection Mode** · **Fun Mode**. Reflection tunes timers longer and defaults energizers off; Fun enables leaderboards and shorter timers. Current screenshot shows raw i18n keys `step4.mode.fun_title` / `step4.mode.fun_desc` — captured as **I18N-BUG-01** in the backlog and must land before this wave ships.

#### Step 5 · Overview — Review & save

Read-only summary grouped by the four preceding steps. Four cards, each with a small pencil-edit affordance that jumps the host back to the relevant step without losing state. At the bottom a primary `Save & review` button (`gradient.brand`) commits the DRAFT and routes to the **Session Launchpad** at `/session/:id/config` — the staging page where the host can share the join code, get the presenter remote, add a last-minute question, and then actually open the lobby (see §5.7). The wizard modal closes as part of this transition.

This separation — wizard commits DRAFT, Launchpad opens LIVE — is deliberate. It gives the host a pre-live staging surface to share the QR with the room, hand out the remote, and settle before the lobby opens. It also matches the realities of presenting: hosts rarely want "wizard done" and "lobby open" to be the same moment.

**Final acceptance criteria:**
- Given a completed DRAFT, when the host clicks `Save & review`, then the session remains in DRAFT state, the wizard closes, and the host lands on `/session/:id/config` (Launchpad) with all setup preserved.
- Given a partial DRAFT (host closes modal mid-wizard), when the host returns, then the wizard reopens on the last completed step with all prior inputs restored.
- DRAFT → LIVE transition is owned by the Launchpad's `Open lobby` CTA, not the wizard — see §5.7.

#### End-to-end KPIs

- Wizard completion rate (open → `Start session`) ≥ **65%**.
- Median time-to-start from step 1 open: ≤ **90s** for the AI path, ≤ **180s** for the Write-yourself path.
- AI-generated question acceptance rate (rows kept at step 5): ≥ **50%**.
- `Next` disabled-click rate: ≤ **8%** per step (signals validation friction).

#### Tracked in backlog

- `WIZ-AI-01` — AI generate: consent gate, grounding echo, generate/refine CTAs, streaming state, Workers AI wiring.
- `WIZ-AI-02` — Per-question editor with type switcher and MC 3–5 validation.
- `WIZ-OVERVIEW-01` — Step 5 overview with edit-jump affordances.
- `I18N-BUG-01` — Missing `step4.mode.fun_title` / `step4.mode.fun_desc` keys across 5 locales.

### 5.7 Session Launchpad (pre-live)

The staging surface a host sees after completing the wizard and before they open the lobby. Route: `/session/:id/config` (existing `SessionConfig.tsx`), DRAFT state only. This is the first moment the host has the join code, the QR, and the presenter remote in one place — and it's the last moment they can tweak questions before the room fills up. It's also the one surface that today mixes Dutch and English copy in the same view (see **I18N-BUG-02** in the backlog).

**Template:** T6 Session Launchpad. **Primary anchor:** `Open lobby` primary CTA. **Secondary anchors:** join code / QR, question list. **Tertiary:** presenter remote, metadata. **Density:** Comfortable.

**Column grid:** At desktop a two-rail layout — **action rail** 320px fixed-left, **content rail** fills remaining, bounded by `container.content`, 48px horizontal page padding. At tablet the action rail stacks above the content rail with the QR + code on the left and the remote + CTA on the right. At mobile a single column with the `Open lobby` CTA as a fixed bottom action bar (§5.0.6).

#### Left — action rail (320px)

Vertically stacked cards with `space.5` between. Each card uses `shadow.card`, `radius.lg`, `space.5` internal padding.

**1. Share card (primary share surface).**
- Heading: `JOIN CODE` (`caption`, `color.pulse.500`, uppercase).
- Join code display: the 4-digit code rendered at `text.display.l`, weight 700, letter-spacing `0.12em`, each digit on the 4px baseline. Digits are separated visually by `space.3` to aid dictation. Screen-readers receive an `aria-label` spelling the code ("Join code four six zero four").
- QR code: 200×200 (down from the current ~280 — its job is recognition, not decoration), `ratio.square`, centered. Surrounded by `space.3` inner padding on a `color.surface.background` panel with `radius.md`. The QR image has descriptive alt-text: `Scan to join — or go to qesto.cc and enter code 4604`.
- Helper text: `text.body.s`, `color.text.secondary` — "Scan the QR or go to **qesto.cc** and enter the code." `qesto.cc` is a link.
- Secondary button: `Copy short link` — copies the participant short URL, shows a 2s "Copied" confirmation inline.

**2. Presenter remote card.**
- Heading: `QESTO CONTROL` (same caption style).
- Secondary QR: 140×140, visually distinct by a 1px `color.violet.400` border to signal "different purpose" — this controls the presenter view from a phone.
- Helper: "Scan to control the session from your phone."
- Two secondary buttons side-by-side at tablet+, stacked at mobile: `Copy remote link` · `Open in new screen`.

**3. Launch card (sticky inside the rail, bottom).**
- Pinned to the bottom of the rail at desktop; it scrolls with the rail only if the rail exceeds viewport height. At tablet it floats above the content stack; at mobile it becomes the bottom action bar.
- Primary CTA: **`Open lobby →`** — full-width inside the card, 48px height, `gradient.brand`, hover state per §4.5 (`shadow.teal` + 1.02 scale). Icon: right arrow (`lucide ArrowRight`), 8px optical gap from label.
- Secondary link beneath: **`← Back to questions`** — `body.s`, `color.teal.600`, underline on hover. Routes to wizard step 2 with state preserved (wizard re-opens as a modal on top of the Launchpad; closing without changes returns to Launchpad unchanged).

The launch card also renders a **pre-flight check** strip — three small inline indicators in `text.caption`:
- ✓ Questions ready (n)
- ✓ Energizer set (or "None")
- ✓ Settings saved

If any check fails (e.g. 0 questions), the primary CTA disables and the failing indicator turns `color.signal.warning` with a tooltip explaining why.

#### Right — content rail

Single column, `space.6` vertical rhythm between blocks.

**1. Session identity block.**
- Title: `heading.l`, `color.text.primary`, `text-wrap: balance`, max 80 chars enforced from the wizard.
- Description: `body.l`, `color.text.secondary`, max 400 chars. If empty, this line is hidden entirely (no empty-state placeholder — it would distract from questions).
- Right-aligned on the same baseline: a small pencil-icon button `Edit details` that re-opens wizard step 1 with state preserved.

**2. Questions block.**
- Heading row: `Questions (n)` (`heading.m`) on the left, `+ Add question` primary-outline button on the right. At mobile the button moves below the heading.
- List: each row is a `listRow` primitive with `density.comfortable` measurements — 48px height, 12px padding, drag handle on the left (`::` glyph, reveal on hover), question number, question text (`body.m`, truncate with ellipsis at 1 line), type chip on the right (`Open · MC · Ranking · Wordcloud`).
- Click on a row → inline editor expands (same component used in wizard step 2's review surface, §5.6 step 2a).
- Drag handle → reorders within the list; re-ordering is optimistic, persisted via `PUT /api/sessions/:id/questions/reorder`.
- Empty state (0 questions — only possible if the host deletes all and lingers): centered in the content rail, illustration + "Add at least one question to open the lobby" + `Back to questions` CTA. Geometry matches the loaded state per §5.0.8.

**3. Danger zone (collapsed by default).**
- Collapsible disclosure at the bottom of the content rail: `Delete draft session` in `color.signal.error`. Prevents accidental deletion of a configured DRAFT that the host spent time building.

#### Responsive rules

| Breakpoint | Layout |
|---|---|
| `mobile` (<640) | Single column. Order: identity → questions → fixed bottom Open lobby bar. Share + remote available via a top-right `Share` icon that opens a bottom sheet with the QR + code + copy buttons. |
| `tablet` (640–1023) | Action rail collapses to a top-row 2-column card (share left, remote right), launch card becomes full-width below. Content rail sits beneath. |
| `desktop` (≥1024) | Two-rail as described. |
| `wide` (≥1440) | Same as desktop, content rail capped at `container.content` (1120), extra space flows to page margins per §5.0.2. |

#### Focus order

`Back to dashboard` (top-left) → Session title (skip-link target) → Questions heading → Question rows in order → `+ Add question` → `Open lobby` → Share card controls → Remote card controls → Danger zone.

Rationale: reviewing content first, launching second, sharing third. The host almost never reaches share controls with a keyboard because they're already scanning the QR with their phone by the time they're here.

#### Acceptance criteria

- Given a host lands on `/session/:id/config` from the wizard, when the Launchpad renders, then the join code is visible without scrolling at `desktop`, and `Open lobby` is visible without scrolling at every breakpoint.
- Given 0 questions in the DRAFT, when the host attempts `Open lobby`, then the CTA is disabled and the pre-flight strip shows the failing check in `color.signal.warning`.
- Given a host clicks `Back to questions`, when wizard re-opens, then the wizard lands on step 2 with all previous edits intact, and closing without changes returns the host to the Launchpad unchanged.
- Given a host clicks `Open lobby`, when the API call succeeds, then the session transitions DRAFT → LIVE, the `SessionRoom` Durable Object is instantiated, and the host is routed to `/present/:sessionId` with the lobby visible.
- Given a keyboard-only user, when they tab through the page, then focus order matches the order above and the `Open lobby` CTA is reachable within 4 tab stops of the page top.
- Given a user with `prefers-reduced-motion`, when the page enters, then there is no stagger; all content appears at once with a 120ms fade.

#### i18n

All copy under `launchpad` namespace in `public/locales/<lang>/launchpad.json`, five locales in parity: EN, NL, DE, FR, ES. The current screenshot shows mixed Dutch ("Deelnamecode", "Scan de QR-code of ga naar qesto.cc en voer de code in") and English copy on the same surface — captured as **I18N-BUG-02** and must land before this wave ships. Likely root cause: hard-coded Dutch strings that were never moved into the namespace; CI missing-key gate should extend to detect non-keyed literals.

#### Instrumentation

| Event | When | Properties |
|---|---|---|
| `launchpad_view` | Page enter | `sessionId`, `questionCount`, `timeFromWizardCompleteMs` |
| `launchpad_share_copied` | Copy short link | `sessionId` |
| `launchpad_remote_copied` | Copy remote link | `sessionId` |
| `launchpad_remote_opened` | Open in new screen | `sessionId` |
| `launchpad_question_added` | + Add question committed | `sessionId`, `type` |
| `launchpad_back_to_questions` | Back to questions clicked | `sessionId` |
| `launchpad_open_lobby_clicked` | Open lobby clicked | `sessionId`, `questionCount`, `timeOnLaunchpadMs` |

#### KPIs

- Median time-on-Launchpad before `Open lobby`: 20–60s. Below 20s suggests the Launchpad is being skipped (in which case the wizard should auto-open lobby); above 90s suggests friction.
- `Open lobby` success rate ≥ **99.5%** (failed DRAFT→LIVE transitions indicate realtime infra issues).
- ≥ **15%** of hosts add at least one question on the Launchpad (validates the `+ Add question` affordance).
- 0 raw Dutch strings visible to a non-NL user.

#### Tracked in backlog

- `LAUNCHPAD-01` — T6 template, action rail, content rail, pre-flight strip, responsive rules.
- `LAUNCHPAD-02` — Back-to-questions state preservation, inline Add-question editor, question reorder.
- `I18N-BUG-02` — Move Dutch strings to `launchpad` namespace across 5 locales; extend CI to detect non-keyed literals.

---

## 6. Accessibility & inclusion

- Colour contrast: body ≥ 4.5:1, large text ≥ 3:1, focus ring ≥ 3:1 against adjacent background. Violet accent on white meets both.
- Motion: all non-essential animation respects `prefers-reduced-motion: reduce`.
- Language: i18n keys for every new string land in `public/locales/en/*.json` plus the four other supported locales (NL, DE, FR, ES). See `docs/I18N_GLOSSARY.md`.
- AI transparency: every AI surface carries the sparkle + a tooltip explaining what model / data produced the output. Supports GDPR Art. 22-style transparency.

---

## 7. Measurement

Every change lands with an instrumented event:

| Event | Where | Why |
|---|---|---|
| `landing_hero_ai_subhead_view` | Hero section | Validate AI narrative lands |
| `dashboard_insights_tab_view` | Insights tab open | Validate appetite for insights |
| `dashboard_top_theme_click` | Theme card | Downstream engagement |
| `wizard_ai_suggestion_accept` | + New session wizard | Validate AI question value |
| `wizard_ai_consent_granted` | Wizard step 2 — AI sub-flow | Prove lawful basis on audit trail |
| `wizard_ai_generate_returned` | Wizard step 2 — after AI call | Latency p95 + volume |
| `wizard_completed` | Wizard step 5 — Start session | Top-funnel conversion |
| `wizard_step_abandoned` | Close X or backdrop click | Pinpoint drop-off per step |
| `ai_badge_tooltip_view` | Any AI badge | Transparency uptake |

KPI targets, measured 30 days post-ship:
- +20% visitor-to-signup conversion on `/`.
- ≥40% of hosts open the Insights tab at least once in their first 7 days post-signup.
- ≥30% acceptance rate on AI-suggested questions in wizard.

---

## 8. Recommendations rolled up from the review

Cross-linked to backlog items in §12 of `docs/BACKLOG.md`.

1. **Make AI visible on the landing page.** New subhead + feature strip. → `AI-VIS-01`.
2. **Surface AI inside the + New session wizard.** Inline suggestion chips, accept/edit/dismiss affordances. → `AI-VIS-02`.
3. **Add an Insights tab to the dashboard.** Top themes, confidence, trend spark. → `DX-INSIGHTS-01` + `DX-INSIGHTS-02`.
4. **Introduce an AI badge primitive.** Sparkle + label, three variants, WCAG-safe. → `AI-VIS-03`.
5. **Typography refresh: DM Sans → Inter.** Update `src/ui/tokens.ts` + Tailwind config + preload. → `DESIGN-TYP-01`.
6. **Primary CTA hover polish.** Scale + shadow + motion. → `DESIGN-POLISH-01`.
7. **Logo optical weight bump + sparkle.** → `DESIGN-POLISH-02`.
8. **Design-token source of truth.** Move tokens to JSON (this folder) and generate `src/ui/tokens.ts`. → `DESIGN-TOK-01`.
9. **Session Creation Wizard AI sub-flow.** Consent → grounding → generate/refine → streaming → review. → `WIZ-AI-01`.
10. **Per-question editor with type switcher.** MC (3–5), Ranking (3–8), Wordcloud. Validation enforced before `Next`. → `WIZ-AI-02`.
11. **Step 5 overview with edit-jump.** Read-only summary, pencil affordance to re-open any prior step without state loss. → `WIZ-OVERVIEW-01`.
12. **Fix step 4 i18n key leak.** `step4.mode.fun_title` / `step4.mode.fun_desc` missing across 5 locales. → `I18N-BUG-01`.
13. **Layout system foundation.** 12/8/4 responsive grid, 4px baseline, density tiers, page templates, §5.0 review checklist. → `LAYOUT-GRID-01`.
14. **State parity on async surfaces.** Skeleton + empty + error at geometric parity. → `LAYOUT-SKELETON-01`.
15. **Accessibility as layout.** Landmark regions, skip-link, WCAG 2.2 SC 2.4.11 on sticky. → `LAYOUT-A11Y-01`.
16. **Density tiers on list surfaces.** Compact / Comfortable / Spacious. → `LAYOUT-DENSITY-01`.
17. **Motion choreography.** Page / modal entry, stagger, spring, reduced-motion. → `LAYOUT-MOTION-01`.
18. **Session Launchpad (pre-live).** T6 template, unified left action rail with share + remote + Open lobby + Back to questions, pre-flight strip, responsive rules. → `LAUNCHPAD-01`.
19. **Launchpad state preservation.** Back-to-questions returns to wizard step 2 with edits intact; inline add-question editor; reorder. → `LAUNCHPAD-02`.
20. **Fix launchpad i18n mixing.** Dutch strings ("Deelnamecode", QR helper) leaking into English UI; move to `launchpad` namespace, CI gate for non-keyed literals. → `I18N-BUG-02`.

---

## 9. Open questions

- Does the "AI analyzed" state require on-device inference to keep the privacy-by-default promise, or is Workers AI acceptable with explicit consent? (Security + AI strategy to resolve before `AI-VIS-02` starts.)
- Should the Insights tab be gated by plan tier? Current assumption: free/starter see last 7 days, team/enterprise see 30 days with theme detection.
- Do we need a dark-mode pass in this wave or defer to a follow-up sprint? `useColorScheme` already exists; tokens support it.

---

## 10. References

- `docs/spec/SPEC_FRONTEND.md` — current routes, hooks, token baseline.
- `docs/ACCESSIBILITY_GUIDE.md` — a11y requirements.
- `docs/I18N_GLOSSARY.md` — translation conventions.
- `docs/BACKLOG.md` §12 — Website Design Wave items.
- `docs/spec/design-tokens.json` — machine-readable tokens.
