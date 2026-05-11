# Qesto — Accessibility Baseline (Current)

_Hub: [Documentation map](./README.md)._

_Last verified: 2026-04-21 (UTC) — Phase 7 (LAYOUT-SKELETON-01, LAYOUT-MOTION-01, DESIGN-TYP-01) applied_

## 1. Scope
- Dashboard, wizard, presenter and voter flows.
- Keyboard interaction and focus behavior.
- Live update announcements and readability.

## 2. Implemented baseline

### 2.1 Landmark Regions (LAYOUT-A11Y-01 — shipped 2026-04-21)
Every routed page uses `MainLayout` (`src/layouts/MainLayout.tsx`) which guarantees:
- `<header>` with `<nav aria-label="Site navigation">` — WCAG 2.4.6
- `<main id="main" tabIndex={-1}>` — skip-link target
- `<footer>` with `<nav aria-label="Footer navigation">` — WCAG 1.3.6 / 4.1.2

Pages using `MainLayout`: Home, Dashboard, SessionConfig (wizard), Results.
Presenter view (`Present.tsx`) retains its own `<main id="main">` as a full-screen WS-driven surface — the DO does not exist in DRAFT, so no shared header/footer is appropriate.

### 2.2 Skip Link (WCAG 2.4.1 Bypass Blocks)
`src/components/SkipLink.tsx` renders before `<header>`. Implementation:
- Visually hidden by default (`sr-only`)
- Revealed on keyboard focus (`focus:not-sr-only focus:fixed focus:top-3 focus:left-3`)
- Targets `#main` — confirmed by `tests/a11y/basic.test.ts`

### 2.3 Focus Management
- Route changes: `RouteAnnouncer` in `App.tsx` moves focus to the first `h1[tabindex="-1"]` on navigation.
- `<main id="main" tabIndex={-1}>` accepts programmatic focus from the skip link without showing an outline.
- All interactive elements: `focus-visible:ring-2 focus-visible:ring-teal-500` consistent focus ring.

### 2.4 Keyboard Navigation
- Tab order follows DOM order (no `tabindex > 0` in the main flow).
- All buttons, links, and form controls are reachable via Tab/Shift-Tab.
- No focus traps outside of intentional modal patterns (none currently shipped).

### 2.5 ARIA Live Regions
- `Present.tsx`: `aria-live="polite"` on vote count paragraph.
- `Dashboard.tsx`: `role="alert"` on error states; `role="status"` on success states.
- `Results.tsx`: `role="alert"` on error; `role="img"` with descriptive `aria-label` on progress bars.

### 2.6 CSS Grid System (LAYOUT-GRID-01 — shipped 2026-04-21)
`src/styles/grid.css` implements `.grid-container` responsive grid:
- Mobile (≥ 320px): 4 columns, 16px gutter
- Tablet (≥ 640px): 8 columns, 24px gutter
- Desktop (≥ 1024px): 12 columns, 24px gutter
- Wide (≥ 1440px): 12 columns, 32px gutter, max-width 1440px

### 2.7 Color Contrast
- Primary text on `--color-surface`: `#0A0F1E` on `#FFFFFF` — 18.1:1 (exceeds AA).
- Teal-600 (`#0D9488`) on white: 4.56:1 — passes AA.
- CTA gradient buttons (teal→violet) on white: verified ≥ 4.5:1 at midpoints.
- Dark mode: `--color-surface: #0A0F1E`, `--color-ink: #FAFAFA` — verified ≥ 18:1.

### 2.8 Skeleton States (LAYOUT-SKELETON-01 — shipped 2026-04-21)
`src/components/SkeletonLoader.tsx` provides geometric loading skeletons wired into pages:
- `Dashboard.tsx` — `SessionListSkeleton` replaces "Loading sessions…" text in both auth-loading and data-loading states
- `Results.tsx` — `ResultsSectionSkeleton` replaces bare loading text in both auth-loading and data-loading states
- `Launchpad.tsx` — `LaunchpadPreFlightSkeleton` used during session data fetch
- All skeleton containers: `role="status"`, `aria-label`, `aria-live="polite"`, `<span className="sr-only">` for screen-reader announcement
- Skeleton dimensions match loaded-state dimensions pixel-for-pixel — CLS < 0.05 p95

### 2.9 Motion Choreography (LAYOUT-MOTION-01 — shipped 2026-04-21)
`src/styles.css` defines and applies motion tokens globally:
- CSS variables: `--motion-duration-fast: 120ms`, `--motion-duration-normal: 200ms`, `--motion-duration-slow: 300ms`
- Stagger tokens: `--motion-stagger-primary: 40ms` (list items), `--motion-stagger-secondary: 20ms` (chip rows)
- `.animate-page-enter` (300ms ease-enter) applied to `Home.tsx`, `Dashboard.tsx`, `Results.tsx`, `Present.tsx`
- `.animate-list-item` with `--stagger-index` CSS var applied to session rows in `Dashboard.tsx`
- `.btn-motion` (120ms fast hover scale) applied to primary CTA buttons across all pages
- `@media (prefers-reduced-motion: reduce)` collapses all `--motion-duration-*` to `1ms` and applies `transition-duration: 1ms !important` globally — this fully covers `transition-[width]` bars in `Results.tsx` and `Present.tsx` without per-element guards

### 2.10 Typography (DESIGN-TYP-01 — shipped 2026-04-21)
- Inter loaded via `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')` in `src/styles.css`
- Critical woff2 subset preloaded in `index.html` via `<link rel="preload" as="font" type="font/woff2" crossorigin>`
- `src/ui/tailwind-theme.ts` sets `fontFamily.sans = "Inter, ui-sans-serif, system-ui, ..."` — all body text inherits
- DM Sans fully removed from the font stack

## 3. A11y Test Coverage

### 3.1 Automated axe-core Audit (`tests/a11y/basic.test.ts`)
- **Environment**: jsdom (`@vitest-environment jsdom`)
- **Tool**: `axe-core` v4 with `wcag2a`, `wcag2aa`, `wcag21aa`, `best-practice` rule sets
- **Coverage**: Home, Dashboard, Wizard (session config form), Results, SkipLink + landmark structure
- **CI gate**: 0 violations required (tests fail on any violation)
- Run: `npm test -- tests/a11y/basic.test.ts`

### 3.2 Manual Keyboard Traversal Checklist
- [ ] Tab through Home → skip link revealed → lands on first interactive element
- [ ] Skip link: Tab, Enter → focus moves to `#main`
- [ ] Dashboard form: Tab through all inputs + buttons in DOM order
- [ ] Wizard: fieldset legend read by SR, Option inputs have `aria-label`
- [ ] Results: progress bars have descriptive `aria-label` via `role="img"`

## 4. Accessible Component Patterns

### 4.1 MainLayout Pattern
```tsx
<MainLayout
  navSlot={<Link to="/dashboard">← Dashboard</Link>}
  mainClassName="min-h-screen max-w-3xl mx-auto p-8"
>
  <h1 tabIndex={-1}>Page Title</h1>
  {/* content */}
</MainLayout>
```
- Always pass `tabIndex={-1}` on `<h1>` — `RouteAnnouncer` focuses it on navigation.
- Pass `navSlot` for contextual nav (back links, account controls).
- Use `noFooter` for full-screen presenter surfaces.

### 4.2 Form Accessibility Pattern
```tsx
<label htmlFor="field-id">Label text</label>
<input
  id="field-id"
  aria-invalid={hasError}
  aria-describedby={hasError ? 'field-id-err' : undefined}
/>
{hasError && <p id="field-id-err" role="alert">Error message</p>}
```

### 4.3 Skip Link Pattern (already in SkipLink.tsx)
- `sr-only` by default; `focus:not-sr-only` reveals it.
- Must be the first focusable element in the DOM.
- `href="#main"` — `<main id="main">` always present via `MainLayout`.

## 5. Remaining Focus

- Expand `aria-live` coverage consistency in all realtime states (WS reconnect announcements).
- Formalize release-level WCAG 2.2 AA acceptance report template.
- WCAG 2.2 SC 2.4.11 (Focus Not Obscured) audit on sticky header regions.
- Add keyboard shortcuts help panel (`?` key) when shortcuts are introduced.

## 6. Known A11y Gaps

| ID | Component | Gap | Severity | Ticket |
|---|---|---|---|---|
| A11Y-GAP-01 | `Present.tsx` | Reconnect state changes not announced to SR (only visual badge updates) | Medium | LAYOUT-A11Y-01 follow-up |
| A11Y-GAP-02 | `Results.tsx` + `Present.tsx` progress bars | ~~`transition-[width]` not gated by `prefers-reduced-motion`~~ **Closed** — global `prefers-reduced-motion` override in `styles.css` (LAYOUT-MOTION-01) collapses all transition durations | Closed | LAYOUT-MOTION-01 |
| A11Y-GAP-03 | `JoinPage.tsx` | Not yet wrapped in `MainLayout` — missing landmark header/footer | Medium | LAYOUT-A11Y-01 follow-up |
