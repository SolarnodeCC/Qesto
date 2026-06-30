# Qesto Design System

**Qesto** is a privacy-first, real-time interactive session platform (Mentimeter-style). Hosts — facilitators, trainers, HR teams, event producers, board chairs, consultants — run rooms where participants vote, rank, and respond live. Results update on the edge in under 200ms, every session opens by letting the room pick its privacy posture, and AI drafts evidence-anchored recaps afterward. Tagline: *"Your pulse to your public."*

This project is the design system extracted from the real Qesto codebase: design tokens, foundation specimens, reusable React components, and high-fidelity UI-kit recreations of the four core surfaces (marketing site, host dashboard, projected Present view, mobile participant flow).

## Sources

Built by reading the production Qesto repository (private):

- **GitHub:** https://github.com/SolarnodeCC/Qesto
  - `docs/spec/design-tokens.json` — machine-readable token source (v1.0)
  - `design-system/colors_and_type.css` + `src/styles.css` — token CSS + dark canvas
  - `src/ui/components.tsx`, `src/ui/input-field-class.ts`, `src/ui/kind-picker.tsx` — primitive library
  - `src/pages/Home.tsx`, `Launchpad.tsx`, `JoinPage.tsx`, `Present.tsx` — the four core surfaces
  - `src/components/AIBadge.tsx`, `HeroPollPreview.tsx`, `src/styles/canvas-themes.css` — AI motif + Present canvas
  - `public/favicon.svg`, `icon-192/512.png` — brand mark + PWA icons

Explore the repo further to build higher-fidelity work — the live components carry exact paddings, focus rings, and dark-mode tokens this system distills.

---

## Content fundamentals — how Qesto writes

- **Confident, specific, tally-first.** Real numbers, real outcomes, real quotes — never "empower" or "unlock." "Results refresh in <200ms," not "blazing fast."
- **Second person, active.** Talks to *you* (the facilitator): "Feel the pulse of the room," "Run the room — and prove what it decided." Warm but precise; addressed to teachers, trainers, facilitators, team leaders.
- **Sentence case everywhere.** Headings, buttons, nav. The only uppercase is the tracked **eyebrow / step caption** (`FACILITATOR-FIRST`, `BEFORE WE BEGIN`).
- **CTAs reflect reality.** "Start free" (not "Sign up"), "Launch your next session" (not "Get started"), "Book a walkthrough" (not "Contact sales").
- **Privacy is a posture, not a promise.** Say what we do *and* what we don't: "No third-party AI, no data sold, no training on what your room shared." Privacy surfaces use parallel "what we do / what we don't" framing.
- **AI disclosure is non-negotiable.** Every AI output carries the violet sparkle badge + "AI recap / AI draft / AI assisted" + generation latency + evidence count. Quotes are shown verbatim, never paraphrased; clusters with <5 responses stay in outliers.
- **Emoji:** essentially none in product chrome. A single 🎉 appears on the "all done" celebration overlay — earned, not decorative. Don't add emoji elsewhere.
- **Vibe:** trustworthy instrument, not a toy. Evidence you can defend after the meeting ends.
- None technical; ensure that we do not use technical terms , or example cloudflare. everyone should understand the feauture of technology

## Visual foundations

- **Three brand scales.** **Teal** (primary action — `--teal-600` fill, `--teal-700` link/AA text), **Violet** (AI accent — `--violet-500` fill, `--violet-700` text), **Pulse** neutral (ink is `--pulse-900` `#0A0F1E`, a near-black navy, *never* pure black). Signal colors for success/warning/error/info.
- **The signature gradient** `--gradient-brand` (`#14B8A6 → #8B5CF6`, 135°) is the brand's one flourish. Use it *sparingly* — primary CTAs, hero/clipped display text, live tally fills, AI theme borders. Overuse flattens its meaning. `--gradient-ai` (violet→mint) marks AI-only surfaces; `--gradient-brand-subtle` softly backs cards.
- **Type pairing.** **Syne** (display, 500–800, tracking −0.02em) for hero, section heads, big numerics and projected questions — opinionated, intentional contrast. **Inter** (body, 400–700) for all copy, UI labels, and in-product H1–H3. **JetBrains Mono** (400–500, tabular-nums) for codes, latencies, vote counts, technical values. *Don't* swap Syne for Inter to "match."
- **Spacing** on a 4px baseline (4·8·12·16·24·32·48·64·96). **Radius:** sm 6 (chips) · md 10 (buttons/inputs) · lg 16 (cards) · xl 24 (hero/join panels/modals) · pill. **Cards:** white surface, 1px `--surface-border` hairline, `--shadow-card` resting → `--shadow-elevated` on hover; no heavy borders, no colored left-accent except the AI-disclosure pattern.
- **Backgrounds.** Mostly clean white / `--pulse-50` alternating sections. The signature backdrop is a soft **radial glow** of teal (top-left) and violet (bottom-right) at \~8% opacity — used on the hero and the Present stage. No photography ships yet (commission/stock it); the product leans on live data visuals (animated tally bars, the dark hero preview card) instead of imagery.
- **Elevation & glow.** Standard `card`/`elevated` shadows for surfaces; branded `teal`/`ai` colored glows for primary buttons (on hover) and AI surfaces.
- **Motion.** Three speeds: **120ms** `--ease-fast` (hover/press), **200ms** `--ease-standard` (tabs, tally bars), **300ms** `--ease-enter` (page/modal). Primary button hover = `scale(1.02)` + teal glow; press = `scale(0.98)`. Tally bars animate width on incoming votes. List items stagger 40ms. Everything collapses to \~1ms under `prefers-reduced-motion`.
- **Hover/press states.** Primary: shadow swap + lift. Secondary: teal-50 fill. Ghost: pulse-100 fill. Links: underline on hover. No opacity-dimming as the primary hover signal.
- **Focus.** A 3px teal ring (`rgba(20,184,166,0.4)`) on every interactive element — accessibility is first-class (WCAG AA across, AAA high-contrast canvas theme exists).
- **Transparency & blur.** Sticky nav is white at 80% opacity with `backdrop-filter: blur(12px)`, gaining a hairline bottom border only after scroll. Present overlays (paused) use a dark scrim + blur.
- **Dark mode / Present canvas.** A full dark token set (`[data-theme="dark"]`) exists; the projected **Present** view runs on a themeable canvas (default light, optional dark) with teal-400/violet-400 accents for contrast on near-black.

## Iconography

- **Lucide** is the icon system, used throughout the live app (CDN in prototypes, `lucide-react` in production). Stroke icons, 2px weight, \~16–22px in UI and larger on the Present stage. The UI kits here load Lucide from CDN (`unpkg.com/lucide`) and render `<i data-lucide="…">` placeholders — match that set for any new work.
- **No icon font, no PNG icon sprite** — all icons are inline SVG via Lucide.
- **Unicode** is used only for tiny trend arrows (▲ ▼) in metric tiles. **Emoji** is avoided except the single 🎉 celebration overlay.
- **Brand mark** (`assets/qesto-mark.svg`): a gradient ribbon "Q" wrapping tally bars and a rising arrow — pulse + growth. Teal→blue→mint gradient. Pairs with the **Syne** wordmark "Qesto". PWA icons in `assets/qesto-icon-192/512.png`.

---

## Index / manifest

**Foundations**

- `styles.css` — the single entry point consumers link (import list only)
- `tokens/` — `fonts.css` · `colors.css` · `semantic.css` · `typography.css` · `layout.css`
- `assets/` — `qesto-mark.svg`, `qesto-icon-192.png`, `qesto-icon-512.png`
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand) shown on the Design System tab

**Components** (`window.QestoDesignSystem_<hash>` after the bundle compiles)

- `components/core/` — **Button**, **Card**, **Badge**, **AIBadge**, **Eyebrow**
- `components/forms/` — **TextInput**, **EntryCodeField**, **ConsentPicker**, **Select**, **Radio**, **Checkbox**, **Switch**, **Textarea**
- `components/data/` — **TallyBar**, **MetricCard**, **StatCard**
- `components/feedback/` — **Toast**, **Dialog**, **Tooltip**, **Skeleton**

**UI kits** (`ui_kits/<product>/index.html`)

- `website/` — marketing homepage (sticky nav, hero + live preview, feature grid, CTA band, footer) + `pricing.html` (plan tiers + comparison)
- `dashboard/` — host dashboard + Launchpad (sidebar, metrics strip, session list, AI recap, pre-flight, join panel)
- `present/` — 1920×1080 projected room view (big Syne question, live tallies, real QR join panel) — light/dark canvas toggle
- `participant/` — mobile join → consent → vote → thanks flow
- `admin/` — superadmin Platform admin console (health strip, stat grid, live metrics, P95 latency trend, historical table, audit log; 5 tabs)
- `qr.js` — shared real-QR renderer used by the kits

**Templates** (`templates/<slug>/` — copy-to-start artifacts for consuming projects)

- `marketing-home/` — the marketing homepage as a Design Component
- `host-dashboard/` — the host workspace as a Design Component (Sessions + Templates views, dark toggle, AI "Ask AI")
- `participant-flow/` — the mobile participant flow as a Design Component
- `admin-console/` — the superadmin platform console as a Design Component (5 tabs, dark toggle)
- `session-wizard/` — the AI session-creation wizard as a Design Component (5 steps; Step 2 = AI question generator: consent → chat → streaming generation → review chips)
- `template-gallery/` — the public `/templates` marketing gallery as a Design Component (hero, industry + theme filters, template cards, signup CTA)

**Other**

- `SKILL.md` — Agent-Skills-compatible entry for using this system in Claude Code
- `assets/fonts/` — drop-in folder + instructions for self-hosting the webfonts

> **Font note:** Syne, Inter, and JetBrains Mono are loaded from Google Fonts (no self-hosted binaries) — exactly as the live app loads them. If you need offline/self-hosted webfonts, ask and I'll add `@font-face` files.
