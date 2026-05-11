# Qesto Design System — Portable overview

_Hub: [Documentation map](../README.md) · Technical specs: [INDEX.md](../SPEC_INDEX.md) · Detailed UI contract: [WEBSITE_DESIGN_SPEC.md](../product/WEBSITE_DESIGN_SPEC.md)_

> Qesto is a real-time interactive session platform — **feel the pulse of the room, amplified by AI**. Mentimeter-style live polling, ranking, wordclouds, and consent votes, with Workers AI-backed insights running on Cloudflare's edge.

The folders **`design-system/`** and **`design_files/`** at the repository root hold portable HTML/CSS kits (preview cards, UI kits, assets). This document is the **canonical prose overview** of brand foundations for those kits and for anyone wiring Qesto visuals outside the main app.

---

## Sources

All visual, copy, and token material was extracted from this repository (no Figma provided):

- **GitHub:** `SolarnodeCC/Qesto` @ `main` (private)
- **Key files referenced:**
  - [`design-tokens.json`](./design-tokens.json) — canonical token source (machine-readable)
  - [`WEBSITE_DESIGN_SPEC.md`](../product/WEBSITE_DESIGN_SPEC.md) — target-state visual and UX spec
  - [`../BRAND_VOICE.md`](../../governance/BRAND_VOICE.md) — tone, vocabulary, CTA rules
  - [`../DESIGN_GRID_GUIDE.md`](../../architecture/DESIGN_GRID_GUIDE.md) — 12/8/4 responsive grid, 4px baseline
  - `src/styles.css` — @theme block, motion, skeleton shimmer
  - `src/ui/components.tsx`, `src/ui/tailwind-theme.ts` — component primitives
  - `src/pages/Home.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Login.tsx`, `src/pages/Launchpad.tsx`, `src/pages/SessionConfig.tsx` — core surfaces
  - `src/components/AIBadge.tsx`, `JoinBar.tsx`, `Grid.tsx`, `SessionWizard.tsx` — component examples
  - `public/favicon.svg`, `public/icon-192.png`, `public/icon-512.png` — brand marks

---

## Product context

Qesto serves **two audiences across two surfaces**:

1. **Marketing website** (unauthenticated) — landing, pricing, solutions (HR, events, nonprofit, consulting), feature pages (AI insights, live polling, privacy). Template T1 (landing) / T3 (content). Sells Workers-AI + edge privacy story.
2. **Host dashboard + Session tooling** (authenticated) — dashboard, Session Creation Wizard (5 steps), Session Launchpad (pre-live staging), Present (full-viewport), Results, Team Settings, Admin. Templates T2 / T4 / T5 / T6.

The brand promise: **real-time · AI-amplified · private-by-default**, in that order. AI claims must always be anchored to "Workers AI on Cloudflare's edge" — never AI-powered alone.

---

## Content fundamentals

**Voice.** Confident, evidence-first, never breathless. Peer-to-peer — we address HR ops, facilitators, event producers, L&D leads, board secretaries who already know their craft. Architecture-aware: we name Cloudflare, Workers AI, anonymity modes, consent logs because those are the real differentiators.

**Casing.** Sentence case everywhere except proper nouns (Qesto, Cloudflare, Workers AI, Stripe). Never title case on buttons. Never ALL CAPS except the step-caption pattern (`QUESTIONS · STEP 2 OF 5`) and section labels (`JOIN CODE`).

**Person.** Second person ("you", "your team") for marketing and product. First person plural ("we") only for brand narrative ("we never lead with AI at the cost of trust"). Never first-person singular.

**Punctuation.** No exclamation points, ever. Em-dashes reserved for parenthetical asides — not for emphasis breaks. Oxford comma.

**Numbers rule.** Every number on a page must be defensible to a procurement reviewer. Either make it a measurable claim (`<90s` brief-to-draft), label it (`Illustrative target`), or drop it. Vague tiles that say "Higher" with no note get replaced or removed.

**AI mentions.** Every AI sentence pairs, in the same paragraph or next sentence, with one of:

- "on Cloudflare's edge" / "Workers AI on Cloudflare"
- "inside the same network as your session"
- "no third-party model providers"

If none is truthful for the feature, the AI claim doesn't belong on that page.

**CTAs.** Verb-first, page-specific, no exclamation. Good: `Launch your next session.`, `Review the consent model.`, `Run your first pulse.`, `Read the privacy policy`, `See the anonymity modes`. Bad: `Click here`, `Learn more`, `Get started!`.

**Banned vocabulary.** *revolutionary, best-in-class, world-class, seamless, leverage, synergy, unleash, next-generation, cutting-edge, AI-powered (alone), game-changing, empower (as filler)*.

**Favoured vocabulary.** *decision evidence · consent log · anonymity mode (full / cohort / identified) · edge inference · Workers AI · facilitator-first · session-level · audit-ready · ranked Q&A · consent round · join code · same-day recap.*

**Rhythm.** Hero subheadline ≤30 words, one promise + one differentiator. Pain points: 3 items ≤22 words. Features: 3–4 items ≤24 words. Proof tiles: value ≤18 chars, label ≤30 chars, note ≤18 words. FAQ answers ≤80 words.

**Emoji.** Used sparsely on marketing surfaces (`Home.tsx` hero feature strip uses ✨📊🔒). Not used in dashboard UI chrome. Preferred: lucide icons (see Iconography).

---

## Visual foundations

**Colour.** Teal (#0D9488 / #14B8A6) is the primary brand. Violet (#7C3AED / #8B5CF6) is the AI accent — every AI-derived surface uses violet or the AI gradient. Pulse is the neutral ramp from `#FAFAFA` to `#0A0F1E` (near-black ink). Signal colours for success/warning/error/info are unsaturated, not neon.

**Gradients.** Three, no improvising:

- `gradient-brand` — `135deg, #14B8A6 → #8B5CF6` — primary CTAs, hero H1 fill, launch cards.
- `gradient-brand-subtle` — `135deg, #F0FDFA → #F5F3FF` — card backdrops, empty-state panels.
- `gradient-ai` — `135deg, #8B5CF6 → #2DD4BF` — **reserved** for AI surfaces. Direction inverted intentionally to read as "AI layer on top of product".

**Type.** Syne (display, 600/700) for hero headlines and section H1s. Inter (body, 400/500/600/700) for everything else. JetBrains Mono for session/join codes only. Inter replaced DM Sans during the design wave — DM Sans read too generic at 13–15px.

**Spacing.** Strict 4-pixel baseline. Scale: 0, 4, 8, 12, 16, 24, 32, 48, 64, 96. Non-4 values (5px, 10px, `gap-1.5`) are banned and lint-flagged. 8 and 16 are the workhorses.

**Grid.** 12-column responsive grid with breakpoint re-bins: 4 cols at mobile (16px gutter, 16px margin), 8 cols at tablet (24px, 32px), 12 cols at desktop (24px, 48px), 12 cols at wide (32px, 80px). Content containers: prose 680px, content 1120px, app 1280px.

**Backgrounds.** Predominantly white (`#FFFFFF`) or subtle pulse-50 (`#FAFAFA`). Gradient backdrops only on hero lower-band (`gradient-brand-subtle` with opacity 0.06 radial pulse) and empty-state panels. **No full-bleed photography, no repeating patterns, no hand-drawn illustrations.** Imagery is product screenshots (16:9 landscape) and lucide icons.

**Animation.**

- Durations: `fast` 120ms (hover/focus), `normal`/`base` 200ms (modals/sheets), `slow` 300–360ms (page transitions).
- Easing: `standard` `cubic-bezier(0.2, 0, 0, 1)`, `enter` `(0, 0, 0.2, 1)`, `exit` `(0.4, 0, 1, 1)`.
- **Page enter:** 8px upward translate + fade, 300ms, enter-ease.
- **Modal enter:** scale 0.97→1 + fade, 200ms.
- **List stagger:** ≤6 items at 40ms; 7–20 at 20ms; >20 no stagger.
- **Spring** (drag, chip accept/dismiss only): stiffness 280, damping 28, mass 1.
- All non-essential motion collapses to ≤1ms under `prefers-reduced-motion: reduce`.

**Hover states.**

- Primary gradient button: scale 1.02 + shadow `card` → `teal`, 120ms fast ease.
- Secondary button: border `pulse-200` → `pulse-300`.
- Card hoverable: shadow `card` → `elevated`.
- Link: underline appears.

**Press / active states.** Buttons scale 0.98 at 80ms. No colour darkening — elevation and scale do the work.

**Borders.** 1px solid. Default `--surface-border` (`#E5E5E5`). Strong `--surface-border-strong` (`#D4D4D4`) on hover. Accent borders only on AI-differentiated controls (remote-QR border is `violet-400`, selected wizard option is `1.5px teal-500`).

**Shadows.** Five named tokens, no bespoke values:

- `card` — `0 2px 8px rgba(10,15,30,0.06)` — default card rest.
- `elevated` — `0 8px 24px rgba(10,15,30,0.10)` — hover, modal.
- `teal` — `0 4px 20px rgba(20,184,166,0.25)` — primary CTA hover.
- `ai` — `0 4px 20px rgba(139,92,246,0.25)` — AI surface hover.
- `focus-ring` — `0 0 0 3px rgba(20,184,166,0.4)` — keyboard focus.

**Corner radii.** `sm` 6 (chips, tags) · `md` 10 (buttons, inputs) · `lg` 16 (cards) · `xl` 24 (hero panels, modals) · `pill` 9999 (badges). Never mix.

**Cards.** White background, `radius-lg` (16), `shadow-card`, `space-5` (24) internal padding. No left-border accent colour cards. AI-derived cards may carry a 3–4px left accent bar using `gradient-ai`, otherwise plain.

**Transparency / blur.** Modal backdrop `rgba(10,15,30,0.48)`, no backdrop-filter blur. Hero radial pulse at opacity 0.06. No glassmorphism.

**Colour of imagery.** Product screenshots kept at native saturation — no filters. The palette brings its own warmth; images don't need B&W or grain treatments.

**Layout rules.** Four sticky regions permitted: top bar (offset 0), section tabs (offset 64 below topbar), wizard bottom action bar (mobile only), toast stack. Nothing else sticky. WCAG 2.2 SC 2.4.11 (Focus Not Obscured) is a release gate.

---

## Iconography

**Primary icon set:** `lucide-react` (already a dep). Stroke width **1.75**. Sizes: `icon-s` 16, `icon-m` 20, `icon-l` 24. Geometric, open, two-tone-friendly.

**The sparkle.** A 4-point sparkle glyph (lucide `Sparkles` or equivalent) in `violet-500` at `icon-s` is the **AI mark**. It prefixes any AI-suggested content, sits inside the `+ New session` button, and accompanies every AI badge variant. Users learn: **violet + sparkle = AI at work**.

**CDN.** Lucide is used via the package in the codebase. For standalone HTML artefacts under `design-system/` / `design_files/`, link via `<script src="https://unpkg.com/lucide@latest"></script>` then `<i data-lucide="sparkles"></i>` + `lucide.createIcons()`. This is a **CDN substitution** of the bundled package — the glyphs are identical.

**Emoji.** Used in one place only — the Home.tsx hero feature strip (✨ 📊 🔒). Not part of the system proper; can be replaced by lucide `Sparkles` / `BarChart3` / `Lock` for more polish. Do **not** introduce emoji elsewhere.

**Unicode.** `•` for bullet separators in metadata strips (`By Ada · 3 days ago`). `←`/`→` arrows are rendered as lucide `ArrowLeft`/`ArrowRight` glyphs, not unicode.

**Logo / wordmark.** The Qesto mark (see portable `assets/favicon.svg` under each kit folder) is an abstract composition: three leaf shapes (teal → violet gradient) plus a C-arc, an embedded bar chart, and a trending-up arrow — encoding **growth, organic pulse, and measurement** in one glyph. Wordmark: `Syne 700` set in `--text-primary`. For small sizes use Syne 700 (per the design wave's optical-weight bump); for hero contexts, apply `gradient-brand` as text fill.

No bespoke illustrations exist in the repo — empty states use lucide glyphs at 80px.

---

## Portable kit folders (`design-system/`, `design_files/`)

Each folder mirrors the same idea:

- **`README.md`** — entry stub linking here (design-system only; design_files uses `DESIGN_SYSTEM.md` as stub).
- **`SKILL.md`** — Claude Code skill entry point where present (`design-system/`).
- **`colors_and_type.css`** — CSS custom properties for token dump + semantic type roles.
- **`assets/`** — brand marks (`favicon.svg`, etc.).
- **`preview/`** — small HTML cards (design-system).
- **`ui_kits/`** — marketing site, dashboard, present, participant HTML kits.

**`copy_deck.md`** — canonical copy snippets (heroes, CTAs, empty states, errors, AI disclosures, consent microcopy).

---

## Caveats & substitutions (flagged)

1. **Fonts — Google Fonts only.** The repo references Inter, Syne, JetBrains Mono, all loaded from Google Fonts. No self-hosted woff2s were shipped in the repo; `colors_and_type.css` imports from `fonts.googleapis.com`. If you want offline/CSP-safe bundles, self-host equivalents.
2. **Icons — CDN swap.** The codebase uses `lucide-react`; standalone HTML artefacts load lucide via unpkg. Same glyphs; different delivery.
3. **No bespoke imagery.** The repo has no product screenshots, illustrations, or marketing photography checked in. Preview cards and UI kits use neutral placeholders (skeleton blocks, lucide icons). Ship real screenshots or illustrations before claiming realism.
4. **No Figma access.** All visual decisions come from the codebase + spec documents under `docs/spec/`.
