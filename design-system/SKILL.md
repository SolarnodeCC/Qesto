# Qesto Design System — skill entry

This skill gives Claude and Claude Code the instructions to produce Qesto-branded design and UI artifacts that match the system shipped in this project.

## When to use

Use this skill whenever the user asks for something Qesto-branded:
- a marketing page, landing hero, or pricing card
- a host dashboard, session wizard step, launchpad, present screen, or results view
- a polling / wordcloud / ranked-Q&A surface
- anything that mentions **Workers AI on Cloudflare**, **consent rounds**, **anonymity modes**, **join codes**, or **facilitator-first** language

Do **not** use it for generic web UI unrelated to the Qesto product.

## How to use

1. Read `README.md` in full before producing anything — it defines content voice, casing, banned vocabulary, visual rules, motion, iconography, and source truth.
2. Link `colors_and_type.css` (relative path from your artifact) at the top of every HTML file. It imports Inter, Syne, JetBrains Mono from Google Fonts and exposes the full token set as CSS custom properties. Reference tokens via `var(--teal-600)`, `var(--radius-lg)`, `var(--gradient-brand)`, etc. — do not re-declare hexes.
3. Load lucide from CDN (`<script src="https://unpkg.com/lucide@latest"></script>` + `lucide.createIcons()`). Stroke 1.75, sizes 16/20/24. The sparkle glyph at `violet-500` is the AI mark — prefix every AI-derived surface.
4. Use the Qesto mark at `assets/favicon.svg`. Pair with the Syne 700 wordmark.
5. Study the UI kits before composing anything new:
   - `ui_kits/website/index.html` — marketing-site patterns.
   - `ui_kits/dashboard/index.html` — host dashboard, AI recap card, Launchpad, Session Wizard step.
   - `ui_kits/present/index.html` — projected 1920×1080 polling surface.
   - `ui_kits/participant/index.html` — 4-screen mobile join flow.
6. For any user-facing text, open `copy_deck.md` first. Hero lines, CTAs, empty states, errors, AI disclosures, and consent microcopy are canonical there — paste and edit minimally.

## Hard rules (ship-blockers)

- **Palette.** Teal (primary), Violet (AI only), Pulse (neutral). No new hues, no Tailwind-default blues.
- **Gradients.** Only the three tokenised gradients — `gradient-brand`, `gradient-brand-subtle`, `gradient-ai`. Never invent a fourth.
- **Type.** Syne for display/hero only. Inter everywhere else. JetBrains Mono only for join/session codes.
- **Spacing.** Strict 4px baseline. Values of 5, 10, 14, 18 are banned.
- **Radii.** Pick from `sm 6 / md 10 / lg 16 / xl 24 / pill`. Don't mix on one element.
- **Shadows.** Use the five named tokens; never hand-write a `rgba()` shadow.
- **AI claims.** Every AI sentence pairs with "Workers AI on Cloudflare's edge" / "inside the same network as your session" / "no third-party model providers". Never "AI-powered" alone.
- **Casing.** Sentence case. No title case on buttons. No exclamation points anywhere.
- **CTAs.** Verb-first, page-specific (`Launch your next session`, not `Get started`).
- **Banned vocabulary.** revolutionary, seamless, leverage, synergy, next-generation, cutting-edge, unleash, game-changing.
- **Numbers.** Every number must be a measurable claim, labelled `Illustrative`, or removed.
- **Motion.** 120ms hover, 200ms modal, 300ms page. Collapse to ≤1ms under `prefers-reduced-motion`.
- **Accessibility.** Focus ring is `--shadow-focus-ring` (teal @ 40% alpha). WCAG 2.2 SC 2.4.11 applies to every sticky surface.

## Defaults for new artifacts

- Background: `#FFF` on marketing, `var(--pulse-50)` on dashboard.
- Card: `#FFF`, `radius-lg`, `shadow-card`, `space-5` (24px) padding.
- Primary CTA: `gradient-brand` fill, white text, `radius-md`, hover → `shadow-teal` + `scale(1.02)` @ 120ms.
- AI surface: violet tint or 3px `gradient-ai` left-bar; sparkle prefix; violet-700 text.

## File map

- `README.md` — full system documentation (read this first).
- `colors_and_type.css` — tokens + semantic type roles. `@import` or `<link>` it.
- `assets/` — brand marks (favicon.svg, icon-192.png, icon-512.png).
- `preview/` — ~16 small cards visualising each token group.
- `ui_kits/website/` — marketing site UI kit.
- `ui_kits/dashboard/` — host dashboard UI kit.

## Caveats

- No self-hosted font bundles — Google Fonts import only. Swap to woff2 for CSP-sensitive deployments.
- No product screenshots or photography in the system. Use the skeleton/lucide placeholder patterns from the UI kits when the user hasn't provided imagery.
- `lucide-react` in the codebase is substituted with the lucide CDN in standalone HTML. Glyphs and strokes match.
- No Figma file was attached — all visual decisions sourced from the repo's `docs/specs/*` and `src/`. Refs are listed in `README.md`.
