# Handoff: Qesto — Real-Time AI-Amplified Session Platform

## Overview

Qesto is a **privacy-first, real-time polling and session platform** built on Cloudflare Workers. Hosts (HR teams, event producers, board chairs, consultants) run rooms where participants vote, respond, and rank — with live tallies, AI-drafted recaps, and consent-round visibility controls. Every session starts by letting the room pick its privacy posture (identified / cohort-visible / anonymous), and every AI output is anchored to the raw evidence that produced it.

This handoff contains the complete design system, marketing website, product UI kits, and supporting docs for implementing Qesto in a real codebase.

## About the Design Files

**The HTML files bundled here are design references, not production code.** They are high-fidelity prototypes showing the intended look, interactions, content, and information architecture. Your job as the implementer is to **recreate these designs inside the target codebase's existing environment** — not to ship the HTML directly.

- If the target repo already uses a framework (React/Next.js, Vue, SvelteKit, SwiftUI, etc.), use its existing conventions, state management, and component library.
- If there is no existing environment yet, **Next.js (App Router) + Tailwind CSS + Radix primitives** is the recommended baseline — it matches the tokens in `colors_and_type.css` one-to-one and renders the edge-deployed Cloudflare Workers target naturally.
- The design tokens (CSS variables in `colors_and_type.css`) should be ported to your framework's equivalent — Tailwind config, Vanilla Extract, Panda CSS, or wherever makes sense.

## Fidelity

**High-fidelity (hifi).** Every screen is pixel-complete with final colors, typography, spacing, radii, shadows, icons, and copy. Recreate faithfully — but adapt to your codebase's component primitives (e.g., use the repo's existing `<Button>` if one exists, wired to the same token values).

## Screens / Views

### A. Marketing Website (`ui_kits/website/`)

Public-facing site. Next.js App Router pages, statically rendered.

| File | Route | Purpose |
|------|-------|---------|
| `index.html` | `/` | Homepage — hero, product shot, features, pricing preview |
| `pricing.html` | `/pricing` | Full pricing — 3 plans, comparison matrix, FAQ |
| `solutions/hr.html` | `/solutions/hr` | HR pulse use case — 360s, climate checks, DEIB listening |
| `solutions/events.html` | `/solutions/events` | Events use case — keynotes, panels, workshops |
| `solutions/nonprofits.html` | `/solutions/nonprofits` | Board motions — governance-grade votes, minutes export |
| `solutions/consulting.html` | `/solutions/consulting` | Consulting workshops — discovery, workshop, readout |
| `features/live-polling.html` | `/features/live-polling` | 8 question types, latency ladder, host controls |
| `features/ai-insights.html` | `/features/ai-insights` | AI clustering, evidence-anchored recaps, Workers AI only |
| `features/privacy.html` | `/features/privacy` | Consent-round card, guarantees, data lifecycle |
| `legal/privacy.html` | `/legal/privacy` | Privacy policy with sticky TOC |
| `legal/terms.html` | `/legal/terms` | Terms of service with sticky TOC |

Every page uses the shared chrome defined in `ui_kits/website/_shared.css`:
- Sticky blurred nav (64px) — brand mark left, links center, CTAs right; adds border on scroll
- Page hero with eyebrow + display heading + lede + CTA row
- Sections alternating white / `--pulse-50` backgrounds
- Full CTA band (`--pulse-900` background, 32px radius, centered)
- 4-column footer on `--pulse-900`

### B. Host Dashboard (`ui_kits/dashboard/index.html`)

Logged-in host interface. Sidebar (240px) + main content. Contains:
- **Launchpad** — empty/entry state with "New session" primary + templates grid
- **Session list** — rows with status pill, participant count, last-modified, recap button
- **Live metrics strip** — 4 tiles (active sessions, response rate, avg latency, consent opt-in)
- **AI recap preview panel** — evidence-anchored theme cards with edit-in-place
- **Session Wizard Step 2** — question builder with drag-reorder list

### C. Present Mode (`ui_kits/present/index.html`)

1920×1080 projected view for the room. Dark (`--pulse-900`) background, huge Syne type, live tally bars with gradient fills. Intended for full-screen on an auditorium display; the host console drives it over WebSocket.

### D. Participant Flow (`ui_kits/participant/index.html`)

Mobile-first (390px design width) join-to-thanks flow:
1. Join code entry (6-char alphanumeric, QR fallback)
2. Consent round — 3 radio options with clear stakes copy
3. Vote screen — question + options, bar tally optional
4. Thanks / waiting-for-next-question state

## Interactions & Behavior

### Navigation & routing
- Nav links are normal `<a>` tags — use `next/link` (or framework equivalent).
- Active state: `.active` class on current page link → `color: var(--text-primary); font-weight: 600;`
- Nav adds `.scrolled` class (1px bottom border) when `scrollY > 8`.

### Buttons (exact spec in `_shared.css`)
- **Primary**: `var(--gradient-brand)` background, white text, `var(--shadow-card)` resting, `var(--shadow-teal)` on hover + `scale(1.02)`.
- **Secondary**: white background, `inset 0 0 0 1px var(--surface-border)` ring, darker ring on hover.
- **Ghost**: transparent, `var(--pulse-100)` background on hover.
- Transition: `all 120ms var(--ease-fast)`.
- `.btn-lg` = 17px / 14px 28px padding.

### Consent posture picker (privacy page, participant flow)
- 3 radio-style cards: Identified / Cohort-visible / Anonymous.
- Active card: 2px `var(--teal-500)` border + `var(--teal-50)` background + filled radio dot.
- One-of selection only.

### Live tallies
- Bars animate width on incoming vote (200ms `var(--ease-standard)`).
- Fill uses `var(--gradient-brand)`.
- Count (`tabular-nums`) updates with value.
- Bars stay hidden until minimum tally (default 5) is met — show a "X of 5 voices needed" inline message below the question.

### AI-generated content
- **Always labeled.** Violet badge with sparkles icon + "AI-generated" text + generation latency.
- Violet left-border (`3px solid var(--violet-500)`) + `var(--violet-50)` background on theme cards.
- Every cluster shows an evidence count and exemplar verbatim quotes (never paraphrase).
- Host edits are tracked and shown in the recap footer.

### Forms
- Input ring: 1px `var(--surface-border)` → 2px `var(--teal-500)` on focus, plus `var(--shadow-focus-ring)`.
- Error: `var(--signal-error)` ring + 14px helper text below.

### Animation timings
- Fast UI (hover, press): `120ms var(--ease-fast)`
- Standard transitions (panels, tally bars): `200ms var(--ease-standard)`
- Entry animations (toast, modal): `300ms var(--ease-enter)`

## State Management

### Client state
- **Session state**: current session ID, question index, active question state-machine step (`draft | open | paused | closed`).
- **Consent posture**: per-participant, stored in session-scoped JWT — never localStorage.
- **Tally cache**: last-known tally per question for instant paint on reconnect.

### Server state (Cloudflare Durable Object per session)
- Authoritative source of truth. One DO per session, pinned to the colo of the first participant.
- WebSocket fan-out from the DO for every tally update.
- Persisted to R2 on session close.

### Data fetching pattern
- Marketing pages: static.
- Dashboard: SWR / React Query against `/api/sessions/*` (Cloudflare Worker routes).
- Session pages (Present + Participant): WebSocket subscription, no polling.

## Design Tokens

All tokens live in `colors_and_type.css` as CSS custom properties. Port them verbatim.

### Brand colors
- **Teal** (primary): `--teal-50` `#F0FDFA` → `--teal-900` `#134E4A`; primary action = `--teal-600` `#0D9488`.
- **Violet** (AI accent): `--violet-50` `#F5F3FF` → `--violet-900` `#4C1D95`; AI emphasis = `--violet-600` `#7C3AED`.
- **Pulse** (neutral): `--pulse-50` `#FAFAFA` → `--pulse-900` `#0A0F1E` (near-black ink).
- **Signal**: success `#22C55E`, warning `#F59E0B`, error `#DC2626`, info `#0EA5E9`.

### Gradients
- `--gradient-brand`: `linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)` — CTAs, hero text, tally fills.
- `--gradient-brand-subtle`: `linear-gradient(135deg, #F0FDFA 0%, #F5F3FF 100%)` — card backdrops.
- `--gradient-ai`: `linear-gradient(135deg, #8B5CF6 0%, #2DD4BF 100%)` — AI-only surfaces.

### Typography
- **Display**: Syne 500/600/700/800 — hero, section heads, large numerics.
- **Body**: Inter 400/500/600/700 — all body copy, UI labels.
- **Mono**: JetBrains Mono 400/500 — latencies, session IDs, technical values, table data.

Load from Google Fonts via the `@import` in `colors_and_type.css`, or self-host via `next/font`.

### Scale (rem, 16px base)
```
display-xl 60px · display-l 48px
heading-l 32px · heading-m 24px · heading-s 20px
body-l 18px · body-m 16px · body-s 14px · caption 12px
```

### Spacing (4px baseline)
```
4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96
```

### Radius
`sm 6px · md 10px · lg 16px · xl 24px · pill 9999px`

### Shadow
```
--shadow-card:      0 2px 8px rgba(10,15,30,0.06)
--shadow-elevated:  0 8px 24px rgba(10,15,30,0.10)
--shadow-teal:      0 4px 20px rgba(20,184,166,0.25)
--shadow-ai:        0 4px 20px rgba(139,92,246,0.25)
--shadow-focus-ring:0 0 0 3px rgba(20,184,166,0.4)
```

### Motion
- Durations: `120ms` / `200ms` / `300ms`
- Easing: `--ease-standard: cubic-bezier(0.2, 0, 0, 1)` (default)
  `--ease-enter: cubic-bezier(0.0, 0, 0.2, 1)`
  `--ease-exit: cubic-bezier(0.4, 0, 1, 1)`
  `--ease-fast: cubic-bezier(0.2, 0, 0.4, 1)` (hover/press)

## Voice & Copy

Full voice guide in `DESIGN_SYSTEM.md` + canonical snippets in `copy_deck.md`. Key rules:

- **Confident, specific, tally-first.** Never "empower" or "unlock." Use real numbers, real outcomes, real quotes.
- **Privacy is a posture, not a promise.** Say what we do *and* what we don't. The privacy page has parallel "what we do / what we don't" columns for this reason.
- **AI disclosure is non-negotiable.** Every AI output carries the sparkles badge + violet accent + "AI-generated" text. No exceptions.
- **Anti-slop AI prompts.** Refuse to invent. If a theme has fewer than 5 evidence responses, leave it in outliers. Never paraphrase quotes.
- **CTAs reflect reality.** "Start free" (not "Sign up"), "Book a walkthrough" (not "Contact sales"), "Launch your first poll" (not "Get started").

## Assets

Source assets are in `design_files/assets/`:
- `favicon.svg` — Qesto mark (teal→violet gradient on rounded square, 28×28).
- `icon-192.png`, `icon-512.png` — PWA icons.

**No real product imagery exists yet.** The prototypes use neutral placeholders and inline SVG/CSS visuals. The implementer should:
- Commission or stock-source: hero imagery for each solution page, customer logos, team photos.
- Use Lucide icons throughout (already in use via CDN in prototypes — swap to `lucide-react` npm package).
- Avoid emoji unless it's earned.

## Files Included

```
design_handoff_qesto/
├── README.md                     ← this file
└── design_files/
    ├── DESIGN_SYSTEM.md          ← full design system doc (voice, visual, motion, icons)
    ├── colors_and_type.css       ← ported verbatim into target codebase
    ├── copy_deck.md              ← canonical UI copy snippets
    ├── assets/                   ← favicon + PWA icons
    └── ui_kits/
        ├── website/              ← 11 marketing pages + _shared.css
        ├── dashboard/            ← host dashboard reference
        ├── present/              ← projected 1920×1080 reference
        └── participant/          ← mobile participant flow reference
```

## Implementation Order (Suggested)

1. **Port `colors_and_type.css` → Tailwind config / CSS vars.** Run `tailwind.config.ts` extensions off the same `--teal-*` / `--violet-*` / `--pulse-*` scale.
2. **Build primitives first**: `Button` (primary/secondary/ghost/lg), `Card`, `EyebrowTag`, `ConsentPicker`, `TallyBar`, `AIBadge`, `StickyNav`, `PageHero`, `CTABand`, `Footer`.
3. **Marketing pages** are mostly static composition of primitives — ship homepage + pricing + privacy feature page first for trust posture.
4. **Dashboard** requires auth + session state — integrate with the Cloudflare Worker backend noted in `DESIGN_SYSTEM.md`.
5. **Present + Participant** are the real-time surfaces — wire WebSocket → Durable Object last, once the dashboard can create sessions.

## Notes for Claude Code

- The existing Qesto repo (referenced in `DESIGN_SYSTEM.md`) already has many of the backend pieces and some shadcn components. **Prefer extending what's there** over rewriting. Check `docs/spec/design-tokens.json` and `src/styles.css` first — if they exist and match this handoff, you're aligned.
- Lucide icons are used throughout. The prototypes load them via CDN; in the app, use `lucide-react` (already a dep per `package.json` last seen).
- Syne is the display font. It's an opinionated choice; don't swap it for Inter "to match the body" — the contrast is intentional.
- The `--gradient-brand` is the signature. Use it sparingly (CTAs, hero text, AI theme borders, key tally fills) — overuse flattens its meaning.
- **Every AI output is labeled.** If you're tempted to hide the badge to make a surface feel cleaner, don't. It's a compliance signal, not a decoration.
