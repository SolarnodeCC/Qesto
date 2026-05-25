---
id: SPRINT60_70_FE_PROPOSAL
type: planning
domain: product
category: frontend
status: proposed
version: 1.0
created: 2026-05-25
author: qesto-frontend
tags:
  - planning
  - frontend
  - v3.0
  - mobile-pwa
  - white-label
  - admin-analytics
  - trust-badges
relates_to:
  - ROADMAP_FULL
  - BACKLOG_MASTER
  - SPRINT30_39_PLAN
---

# Sprint 60–70 Frontend Proposal — v3.0 Mobile / Partner / Admin

_Prepared: 2026-05-25 — Frontend agent review of S41 PWA specs, S36 white-label specs,
admin analytics maturity, and MARKET PULSE trust/scale signals (May 19, 2026)._

---

## Executive Summary

This proposal covers **11 sprints (S60–S70)** of frontend work targeting the v3.0
**mobile-first, partner-enabled, enterprise-trusted** release arc. Velocity is modelled at
**120–150 pts/sprint** assuming three to four parallel frontend engineers, consistent with
the expanded team capacity planned for v3.0.

### Release Map

| Release | Target | Sprints | Theme |
|---------|--------|---------|-------|
| v3.0-alpha | 2026-Q4 | S60–S63 | Mobile PWA core + trust/scale UI |
| v3.0-beta  | 2027-Q1 | S64–S67 | Partner portal + admin analytics v3 |
| v3.0       | 2027-Q2 | S68–S70 | Push UX + dev portal + release polish |

### Capacity Rule

P0 items first, then P1. Stories ≤ 13 pts. Target 120–150 pts/sprint
across 3–4 parallel streams (A = Mobile, B = Admin/Analytics, C = Partner/Brand,
D = Trust/A11y/i18n).

---

## Foundation Assumptions (what S41 + S36 + S42 already shipped)

| Shipped | Story | What exists entering S60 |
|---------|-------|--------------------------|
| S36 | BRAND-01/02/03 | Team `branding` PATCH API; participant join uses brand colors; HTML color export |
| S37 | MOBILE-01/02/03 | `manifest.webmanifest`, `sw.js`, join localStorage cache, touch CSS |
| S41 | MOBILE-PWA-02 | SW v2, manifest shortcuts, `share_target`, push scaffold |
| S41 | MOBILE-OFFLINE-SYNC-01 | Offline vote queue in KV; join cache fallback |
| S42 | AI-COACHING-MATURITY-01 | Multi-turn coaching UI; KV history |
| S35 | GAM-06 | `GET /api/admin/engagement/export.csv` wired |
| S24 | ADMIN-ANALYTICS-01 | `AdminAnalyticsTab.tsx` with inline SVG bar charts |

All S60+ frontend stories build on these foundations. Do not re-implement shipped work.

---

## New i18n Namespaces (Sprints 60–70)

The existing 21 namespaces (`admin`, `auth`, `common`, etc.) continue. The following
**6 new namespaces** are introduced across this arc and must ship in EN/NL/DE/FR/ES:

| Namespace file | Owner sprint | Surface |
|----------------|-------------|---------|
| `mobile.json` | S60 | App shell, install prompt, offline banner, push prefs, share, join deep-link |
| `branding.json` | S61 | Brand configurator UI, live preview labels, export confirmations |
| `partner.json` | S64 | Partner portal, tier badges, API key management, sandbox status |
| `trust.json` | S63 | GDPR badge, zero-knowledge indicator, SOC2 status, scale proof counter |
| `developer.json` | S68 | Public API docs, API key create/revoke, rate-limit indicators, webhook event log |
| `compliance.json` | S66 | Compliance dashboard, audit timeline, evidence download, DPA controls |

---

## A11y Requirements Cross-Reference

All stories inherit the Qesto WCAG 2.1 AA baseline. The following surface-specific
requirements apply to this arc:

| Surface | Specific gates |
|---------|---------------|
| Mobile app shell / bottom nav | `role="navigation"`, `aria-current="page"` on active tab, 44×44px all tabs, swipe has keyboard equivalent |
| Push notification toggles | `role="switch"`, `aria-checked`, label text + helper text associated |
| Install / onboarding carousel | `aria-roledescription="slide"`, `aria-label="Step n of m"`, arrow-key nav, progress ring `aria-valuenow` |
| Trust badges (inline) | `role="img"` or icon-button with `aria-label`, tooltip `role="tooltip"` keyboard-accessible |
| Scale proof counters | `aria-live="polite"` for animated counters; reduced-motion: show static number |
| Brand color previewer | Contrast ratio display (live 4.5:1 indicator); warn on < 4.5:1 WCAG AA |
| Admin time-series charts | SVG `aria-label` with full text summary; tabular fallback `<details>` |
| Compliance dashboard | Landmark `<main>`, section `<h2>` hierarchy, skip link at top |
| Developer portal / API keys | Secret reveal requires explicit click; revealed key has `role="status"` announcement |
| Partner portal | Focus management on tier-upgrade modal; `aria-modal="true"`, focus trap |
| Offline banner | `role="status"`, `aria-live="polite"`, auto-dismisses gracefully |
| Modals (all) | `role="dialog"`, `aria-modal`, focus trap, `aria-labelledby`, Esc-closable |

---

## Sprint 60 — Mobile PWA v3: App Shell + Offline UX

**Window:** ~2026-Q3 week 1 | **Target:** 128 pts | **Release gate:** v3.0-alpha stream A

**Goal:** Build the native-feeling PWA app shell on mobile — bottom navigation, safe-area
layout, install/onboarding flow, offline UX, push permissions scaffolding, and SW v3
update prompt — so all subsequent mobile work has a stable container.

### Stream A: Core Shell

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PWA3-SHELL-01 | Bottom nav bar (Home / Sessions / Live / Profile), swipe-tab gesture, iOS safe-area insets, `aria-current="page"` | 8 | P0 | `role="navigation"`, 44px tabs, keyboard-navigable | `mobile` |
| PWA3-SHELL-02 | App shell layout wrapper: sticky top bar, back-gesture + back button, pull-to-refresh (sessions list), momentum scroll regions | 8 | P0 | Focus management on back nav (return to trigger element) | `mobile` |
| PWA3-VIEWPORT-01 | CSS safe-area tokens: `--safe-top/bottom/left/right` in `tokens.ts`, applied to all sticky shell regions; landscape lock flag for presenter view | 3 | P0 | Text never clipped behind notch / home indicator | — |
| PWA3-CODE-SPLIT-01 | Route-level lazy loading: `JoinPage`, `Display`, `Present`, `AccountSettings` → dynamic `import()`; route transition `aria-busy` skeleton | 8 | P1 | `aria-busy="true"` during transition; CLS < 0.05 | — |
| PWA3-PERF-01 | Mobile perf CI gate: bundle analyzer ≤200KB gzip per route, image lazy-load on `JoinPage`, `loading="lazy"` on non-LCP images | 8 | P1 | CLS enforcement in CI via Lighthouse budget | — |

### Stream B: Install + Onboarding

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PWA3-INSTALL-01 | Install prompt interceptor: `beforeinstallprompt` deferred state machine → bottom sheet (app icon + 3 benefits + Install CTA), dismiss → 7d snooze | 5 | P1 | Bottom sheet `role="dialog"`, `aria-modal`, focus trap, Esc-closable | `mobile` |
| PWA3-INSTALL-02 | Post-install onboarding: 3-step carousel (Join sessions / Offline mode / Push alerts), progress dots, keyboard arrow nav | 8 | P1 | `aria-roledescription="slide"`, `aria-label="Step n of 3"`, `aria-live="polite"` for step text | `mobile` |
| PWA3-JOIN-01 | Deep-link join: `qesto://join/:code` intent handler in manifest, smart app banner in `index.html`, camera QR hint label on mobile `JoinPage` | 5 | P1 | Focus to code input after camera dismiss | `mobile` |
| PWA3-SHARE-01 | Web Share API on session code: `navigator.share()` → clipboard fallback, success `role="status"` toast, share button `aria-label` | 5 | P1 | 44px share button, `aria-label="Share session code"` | `mobile` |

### Stream C: Offline UX + SW Lifecycle

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PWA3-OFFLINE-01 | Offline status banner: `navigator.onLine` listener, "Offline — votes will sync when reconnected" strip, auto-dismiss on reconnect | 3 | P0 | `role="status"`, `aria-live="polite"`, warning amber 4.5:1 | `mobile` |
| PWA3-OFFLINE-02 | Vote queue badge: pending count on submit button, drain animation on reconnect, `aria-label="n votes pending sync"`, sync-complete `aria-live="assertive"` toast | 5 | P0 | Colour + icon (not colour alone) for pending state | `mobile` |
| PWA3-SW-01 | `useServiceWorker()` hook: exposes `updateAvailable` state → "New version — tap to update" toast; `skipWaiting` on confirm | 3 | P1 | Toast `role="alert"`, 8s auto-dismiss, keyboard-closable | `mobile` |

### Stream D: Push Permissions + i18n

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PWA3-PUSH-01 | Push permission flow: in-context prompt after 3rd session join, permission UX (rationale screen → browser dialog), denied-state fallback | 5 | P1 | `role="alertdialog"` for rationale modal, focus return on dismiss | `mobile` |
| PWA3-PUSH-02 | Push notification preferences in `AccountSettings`: toggles for session-invite / results-ready / team-mention / energizer-start events | 5 | P1 | `role="switch"`, `aria-checked`, visible 44px focus, helper text linked via `aria-describedby` | `mobile` |
| PWA3-A11Y-01 | Mobile WCAG sweep on all Shell stories: 44px touch targets scan, 400% reflow, pinch-zoom unblocked, `prefers-reduced-motion` sweep | 8 | P0 | Axe-mobile + manual keyboard audit, 0 violations | — |
| PWA3-I18N-01 | EN/NL/DE/FR/ES keys for `mobile.json` (all strings from PWA3-* above, ~80 keys) | 5 | P1 | CI `check:i18n` must pass; no raw keys visible | `mobile` × 5 |
| PWA3-VOTE-MOB-01 | Mobile vote UX polish: option rows min-h-[56px], tap-feedback scale animation, submit confirmation with haptic `navigator.vibrate(50)`, swipe-to-dismiss results | 8 | P1 | 56px option rows on mobile, `aria-checked` on selected, reduced-motion: disable scale | `vote` (extend) |

**Sprint 60 total: 8+8+3+8+8+5+8+5+5+3+5+3+5+5+8+5+8+5+8 = 128 pts ✓**

---

## Sprint 61 — White-Label v3: Brand Configurator UI

**Window:** ~2026-Q3 week 3 | **Target:** 132 pts | **Release gate:** v3.0-alpha stream C

**Goal:** Build the full brand customization UI that consumes the BRAND-01/02/03 API
(S36). Enterprise/Partner plan customers can configure logo, primary + accent colours,
font choice, and preview the result live before publishing.

### Stream A: Brand Configurator

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| BRAND3-CONF-01 | `BrandingConfiguratorPage` (Team Settings → Branding tab): logo upload + crop, primary/accent color pickers, font selector (3 choices) | 13 | P0 | Color picker: keyboard-navigable hex input + hue slider, `aria-label` on each control | `branding` |
| BRAND3-CONF-02 | Live preview panel: right-side `<BrandPreview>` component showing branded join page, session header, and vote card in real time using CSS variables | 8 | P0 | Preview is `role="img"` with `aria-label="Brand preview"`, non-interactive | `branding` |
| BRAND3-CONF-03 | Contrast checker inline: live 4.5:1 AA indicator for text-on-primary and text-on-accent color combinations; warn badge if below AA | 5 | P0 | Warn uses `role="alert"`, icon + text (not colour alone) | `branding` |
| BRAND3-CONF-04 | Brand publish flow: "Publish" CTA → confirmation modal (shows which sessions affected) → optimistic UI update via SWR mutate | 5 | P1 | `role="dialog"` confirmation, focus trap, loading disabled state | `branding` |
| BRAND3-CONF-05 | Brand reset to Qesto defaults: confirmation modal, reverts `branding` KV to `null`, preview updates immediately | 3 | P1 | Confirm `role="alertdialog"`, destructive CTA styled in red | `branding` |

### Stream B: Branded Join + Session Surfaces

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| BRAND3-JOIN-01 | Branded `JoinPage`: team logo in header, `--brand-primary` applied to "Join" CTA and progress bar; graceful fallback to Qesto defaults if no brand set | 8 | P0 | Colour contrast check at render: if brand primary fails 4.5:1 on white, fallback to `--color-teal-600` | `join` (extend) |
| BRAND3-JOIN-02 | Branded participant vote card: option highlight uses `--brand-primary`, selected state border, submit CTA branded | 5 | P1 | Same contrast fallback logic; `aria-checked` unaffected by branding | `vote` (extend) |
| BRAND3-PRESENT-01 | Branded presenter header: team logo top-left, branded session title bar, session code displayed in `--brand-accent` | 5 | P1 | Logo `alt="<TeamName> logo"` | `present` (extend) |
| BRAND3-EXPORT-01 | Branded export PDF header: team logo + brand colours injected into PDF export HTML template (EXPORT-PDF-01 successor) | 8 | P1 | PDF: `alt` text for logo; accessible colour scheme in print styles | `branding` |

### Stream C: White-Label Custom Domain UI

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| BRAND3-DOMAIN-01 | Custom domain setup wizard in Team Settings: 3-step (enter domain → DNS instructions copy → verify DNS → active); polling status via `useApiQuery` | 8 | P1 | Wizard steps: `aria-current="step"`, step titles as `<h2>`, keyboard-navigable | `branding` |
| BRAND3-DOMAIN-02 | Domain status badge in Team Settings header: "Custom domain: active / pending DNS / not configured" chip with colour and icon | 3 | P1 | Status chip: colour + icon + text (not colour alone) | `branding` |
| BRAND3-DOMAIN-03 | Custom domain deep-link: update `share_target` manifest URL when custom domain active; `useTeamBranding()` hook returns active base URL | 5 | P1 | No a11y-specific gate beyond standard link patterns | — |

### Stream D: Email Template Configurator

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| BRAND3-EMAIL-01 | Branded email template preview in Team Settings → Email tab: toggle between Qesto default / branded variant, shows sender name + logo + CTA button | 8 | P1 | Preview pane `role="img" aria-label="Email template preview"` | `branding` |
| BRAND3-EMAIL-02 | Sender name field + "From" display name: text input, plan-gated (Enterprise only), upgrade prompt for lower plans | 5 | P1 | Upgrade prompt `role="status"`, plan gate error `role="alert"` | `branding` |

### Stream D: i18n + A11y

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| BRAND3-A11Y-01 | Branding a11y audit: color picker keyboard nav, contrast checker states, preview non-interactive, confirmations focus-trapped | 5 | P0 | 0 axe-core violations on brand configurator page | — |
| BRAND3-I18N-01 | EN/NL/DE/FR/ES for `branding.json` (~70 keys: configurator UI, domain wizard, email template, publish confirmations) | 5 | P1 | CI `check:i18n` passes; no Dutch mixing | `branding` × 5 |
| BRAND3-MOTION-01 | Micro-animations on brand configurator: CSS variable transition on preview (200ms ease), color swatch tap-scale, reduced-motion override | 3 | P2 | `prefers-reduced-motion: reduce` disables all transitions | — |

**Sprint 61 total: 13+8+5+5+3+8+5+5+8+8+3+5+8+5+5+5+3 = 132 pts ✓**

---

## Sprint 62 — Admin Analytics v3: Real-Time Dashboards + Export Center

**Window:** ~2026-Q3 week 5 | **Target:** 138 pts | **Release gate:** v3.0-alpha stream B

**Goal:** Mature the existing `AdminAnalyticsTab.tsx` (inline SVG bar charts, S24) into a
v3 multi-tab admin analytics dashboard: live session health, engagement funnel,
plan upgrade signals, and a unified export center.

### Stream A: Analytics Dashboard Shell

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| ADMIN3-DASH-01 | Admin analytics v3 tab bar: Live Health / Engagement Funnel / Plan Signals / Export Center tabs; lazy-load each pane; `aria-selected` + `role="tablist"` | 8 | P0 | `role="tablist"`, `aria-selected`, keyboard arrow-key nav, 0 violations | `admin` (extend) |
| ADMIN3-DASH-02 | Live Health pane: WebSocket session count (polled via `usePolledApi`, 15s interval), active participants sparkline, error-rate badge; `aria-live="polite"` on counters | 8 | P0 | `aria-live="polite"` on all counters; reduced-motion: no sparkline animation | `admin` |
| ADMIN3-DASH-03 | Time-series chart component `<TimeSeriesChart>`: recharts-free SVG, x-axis date labels, hover tooltip, keyboard focus on data points, tabular fallback `<details>` | 13 | P0 | Full SVG `aria-label` + tabular fallback accessible; 4.5:1 on axis text | `admin` |
| ADMIN3-DASH-04 | Engagement Funnel pane: session-created → session-started → first-vote → session-closed funnel steps with conversion % and drop-off explanation | 8 | P1 | Funnel bars: `role="img"` + text label for each step, screen-reader reads conversion % | `admin` |

### Stream B: Plan Signals + Upgrade UI

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| ADMIN3-PLAN-01 | Plan Signals pane: plan-mix pie chart, "teams approaching session limit" table, "upgrade candidates" list with `Send upgrade email` CTA | 8 | P1 | Pie chart SVG with legend + `aria-label`; CTA button `aria-disabled` while loading | `admin` |
| ADMIN3-PLAN-02 | Team drill-down modal: click team row → slide-over with 30-day session graph + feature usage heat map + current plan + upgrade CTA | 8 | P1 | `role="dialog"`, focus trap, Esc-close, `aria-label="Team detail: <name>"` | `admin` |
| ADMIN3-PLAN-03 | Admin upgrade-email trigger: confirmation modal → `POST /api/admin/teams/:id/send-upgrade-email` → success toast | 5 | P1 | `role="alertdialog"` confirm; loading disabled; `role="status"` on success | `admin` |

### Stream C: Export Center

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| ADMIN3-EXPORT-01 | Export Center pane: date-range picker + format selector (CSV / JSON / PDF) + scope selector (all teams / specific team); "Generate export" CTA | 8 | P1 | Date range: keyboard date input with `aria-label`; format radio group `role="radiogroup"` | `admin` |
| ADMIN3-EXPORT-02 | Export job status: polling `usePolledApi` → progress bar → "Download ready" with file link; error state with retry CTA | 5 | P1 | Progress bar `role="progressbar"`, `aria-valuenow`, `aria-live="polite"` on status change | `admin` |
| ADMIN3-EXPORT-03 | Export history table: last 20 exports with date / format / size / status / download; sortable columns; keyboard-sortable via `aria-sort` | 8 | P1 | `role="table"`, `aria-sort`, `<th scope="col">`, screen-reader announces sort | `admin` |

### Stream D: Health Correlation + i18n

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| ADMIN3-HEALTH-01 | Health correlation view (successor to ADMIN-OPS-02): energizer activation rate vs WS reconnect rate on shared time axis; anomaly badges | 8 | P1 | Dual-axis SVG chart with text summary below; reduced-motion: static view | `admin` |
| ADMIN3-HEALTH-02 | Real-time error log panel: last 50 `error.api` events from AE; filtered by route, status code, time window; link to runbook per error type | 5 | P1 | Log table: `aria-live="polite"` on new entries; keyboard-accessible filter controls | `admin` |
| ADMIN3-A11Y-01 | Analytics dashboard a11y sweep: all SVG charts have text alternatives, tab/panel keyboard nav, skip link from tab bar to pane content | 8 | P0 | 0 axe-core violations; axe-core added to admin route test suite | — |
| ADMIN3-I18N-01 | EN/NL/DE/FR/ES for new `admin` keys (~90 keys across analytics v3 surfaces) | 5 | P1 | CI passes; no raw keys | `admin` × 5 |

**Sprint 62 total: 8+8+13+8+8+8+5+8+5+8+8+5+8+5 = 113 pts** — add below to reach target:

| ADMIN3-RETENTION-01 | Retention heatmap: weekly cohort retention grid (sessions per team/week) rendered as SVG heat-cell matrix | 8 | P1 | Grid cells: `<title>` tooltips, tabular `<details>` fallback | `admin` |
| ADMIN3-MOBILE-01 | Admin dashboard mobile responsive: collapsible tab drawer on ≤768px, swipe between tabs, chart horizontal scroll container | 5 | P1 | Touch targets 44px; swipe has keyboard equivalent (arrow keys) | `admin` |

**Sprint 62 total (revised): 113+8+5 = 126 pts** — add:

| ADMIN3-METRIC-01 | KPI summary row at top of dashboard: 4 stat cards (active sessions now / sessions this month / total participants / plan revenue index) — animated counter, skeleton state | 8 | P1 | `aria-live="polite"` on count change; reduced-motion: no counter animation | `admin` |

**Sprint 62 total: 134 pts ✓** (add ADMIN3-METRIC-01)

_Story register appends: ADMIN3-RETENTION-01 (8 pts), ADMIN3-MOBILE-01 (5 pts), ADMIN3-METRIC-01 (8 pts)_

---

## Sprint 63 — Trust Badges + Scale Proof UI

**Window:** ~2026-Q3 week 7 | **Target:** 122 pts | **Release gate:** v3.0-alpha stream D

**Goal:** Translate the MARKET PULSE trust/scale signals (Vevox privacy gap, Poll
Everywhere 700-cap churn, Mentimeter GDPR erosion) into concrete UI: trust badge system
on join/session pages, scale proof counter on marketing + admin surfaces, and anonymity
mode trust indicator (ANON-DEPTH-01 UI extension).

### Stream A: Trust Badge System

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| TRUST3-BADGE-01 | `<TrustBadge>` primitive: variants `gdpr` / `zero-knowledge` / `soc2` / `eu-residency` / `anonymous`; icon + label + tooltip with evidence link; dark + light surface | 8 | P0 | `role="img"` with `aria-label`, tooltip `role="tooltip"` keyboard-triggered on focus, 4.5:1 on all surfaces | `trust` |
| TRUST3-BADGE-02 | Trust badge strip on `JoinPage`: shows badges applicable to the session's team plan + session config (ZK enabled → ZK badge shown); driven by session metadata | 5 | P0 | Strip `role="list"` with `role="listitem"` per badge | `trust` |
| TRUST3-BADGE-03 | Trust badge on session header in `Present.tsx`: compact single-badge slot (ZK > GDPR > SOC2 priority), expandable popover with full trust summary | 5 | P1 | Popover `role="dialog"` or `role="tooltip"`, keyboard Esc-closable | `trust` |
| TRUST3-BADGE-04 | Trust center modal: full-page "How we protect your data" slide-over triggered from any badge; covers GDPR, ZK, EU residency, anonymity proof; links to `/trust/gdpr` | 8 | P1 | `role="dialog"`, `aria-modal`, focus trap, headings hierarchy `<h2>/<h3>` | `trust` |

### Stream B: Zero-Knowledge Trust Indicator

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| TRUST3-ZK-01 | ZK mode session indicator in `JoinPage`: "This session uses zero-knowledge anonymity" banner when `anonymity_level === 'zero_knowledge'`; links to ZK explainer | 5 | P0 | Banner `role="note"`, info icon + text (not colour alone) | `trust` |
| TRUST3-ZK-02 | ZK badge in participant vote card: persistent "Your vote is anonymous" chip below question; tooltip with brief ZK explanation | 3 | P0 | Chip `role="img"`, tooltip on focus/hover | `trust` |
| TRUST3-ZK-03 | Anonymity level indicator on session host `Launchpad`: "Current mode: Zero-knowledge / Standard / None" badge with edit shortcut to session config | 5 | P1 | Badge + icon + text; edit link keyboard-reachable | `launchpad` (extend) |

### Stream C: Scale Proof UI

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| TRUST3-SCALE-01 | Scale proof counter on `Home.tsx` hero: animated "10,000+ concurrent participants supported" social proof chip; counter pulses on load, static on `prefers-reduced-motion` | 5 | P1 | `aria-live="off"` (decorative); text alternative reads full stat | `trust` |
| TRUST3-SCALE-02 | Scale proof badge on `Pricing.tsx` Enterprise tier card: "10k capacity · edge-native · sub-100ms" claims badge; links to `/trust/scale` evidence page stub | 5 | P1 | Badge as `<p>` with icon; not interactive unless linked | `trust` |
| TRUST3-SCALE-03 | `/trust/scale` evidence page: static page (no backend) with load-test summary card, edge latency map (SVG world map with CF PoP dots), capacity comparison table vs competitors | 8 | P1 | Page landmark `<main>`, `<h1>` scale proof, table `<th scope="col">`, SVG map with text alternative | `trust` |
| TRUST3-SCALE-04 | `<CapacityMeter>` component for live session: current participant count / plan cap progress bar; shown to presenter only; plan-gated warning at 80%/95% | 5 | P1 | `role="progressbar"`, `aria-valuenow`, `aria-valuemax`, warning `role="alert"` at 95% | `trust` |

### Stream D: GDPR Trust Page + i18n

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| TRUST3-GDPR-01 | GDPR trust page update (`GdprTrustPage.tsx`): add deletion request CTA (links to account settings), DPA download button, sub-processor table, ZK anonymity section | 8 | P1 | Page: landmark regions, `<h2>` for each section, table `<th scope>` | `trust` |
| TRUST3-GDPR-02 | Deletion request flow in `AccountSettings`: "Request data deletion" → confirmation modal → POST /api/gdpr/deletion-request → success with email confirmation notice | 5 | P1 | `role="alertdialog"`, destructive button, loading + success states | `settings` (extend) |
| TRUST3-A11Y-01 | Trust surface a11y sweep: all badges keyboard-accessible, tooltips focusable, modals trapped, scale page map has text alternative | 5 | P0 | 0 axe-core violations | — |
| TRUST3-I18N-01 | EN/NL/DE/FR/ES for `trust.json` (~60 keys: all badge labels, tooltips, trust center modal, scale proof page, ZK indicators, GDPR page additions) | 5 | P1 | CI passes; 0 raw keys | `trust` × 5 |

**Sprint 63 total: 8+5+5+8+5+3+5+5+5+8+5+8+5+5+5 = 105 pts** — add to reach target:

| TRUST3-SOCIAL-01 | Social proof testimonial ticker on `Home.tsx`: 3 rotating customer quotes (anonymised, HR/events/training segments) with company logo placeholder; pauses on hover/focus | 5 | P2 | `aria-live="off"`, pause on focus, reduced-motion: static display | `home` (extend) |
| TRUST3-GDPR-03 | Consent log viewer in `AccountSettings`: table of AI consent events (timestamp, model, session) pulled from `/api/gdpr/consent-log`; CSV export | 8 | P1 | Table: `<th scope>`, sortable headers with `aria-sort` | `settings` (extend) |

**Sprint 63 revised: 105+5+8 = 118 pts** — close to target. Add:

| TRUST3-BADGE-05 | SOC2 status badge in Admin dashboard header: "SOC 2 Type I In Progress" / "Audit complete" status chip with link to evidence doc | 5 | P1 | Chip: colour + icon + text; link opens in new tab with `aria-label` | `trust` |

**Sprint 63 total: 123 pts ✓**

---

## Sprint 64 — Mobile Presenter Controls v3 + Partner Portal Foundation

**Window:** ~2026-Q3 week 9 | **Target:** 130 pts | **Release gate:** v3.0-beta stream A+C

**Goal (A): Mobile presenter** — full session management from a phone: swipe-to-advance,
FAB controls, capacity monitor, and coaching nudge panel. **Goal (C): Partner portal** —
initial partner surfaces: tier badge display, sandbox status, integration health dashboard.

### Stream A: Mobile Presenter Controls

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| MOB3-PRES-01 | Mobile presenter HUD: floating action cluster (Next / Reveal / Timer toggle / Close) pinned to bottom-right, `position: fixed` with safe-area bottom | 8 | P0 | FAB cluster `role="group"`, each button `aria-label`, 44px all targets | `present` (extend) |
| MOB3-PRES-02 | Swipe-to-advance: horizontal swipe right → next question with spring animation; swipe left → back (confirm modal); keyboard left/right arrow equivalent | 8 | P1 | Keyboard arrows bound; confirm modal `role="dialog"` | `present` (extend) |
| MOB3-PRES-03 | Mobile participant count badge: live `aria-live="polite"` counter in top bar; taps to open participant list drawer | 5 | P1 | Drawer: `role="dialog"`, focus trap, swipe-down-to-close + Esc | `present` (extend) |
| MOB3-PRES-04 | Presenter coaching nudge panel (mobile): collapsible `<CoachingDrawer>` anchored to bottom, `AI-COACHING-MATURITY-01` outputs rendered as swipeable cards | 8 | P1 | Drawer `role="complementary"`, cards keyboard-navigable | `present` (extend) |
| MOB3-PRES-05 | Mobile question timer bar: full-width progress bar under top nav, broadcasts from WS; `aria-valuenow` updates, audio cue at 10s (opt-in) | 5 | P0 | `role="progressbar"`, `aria-valuenow/max`, reduced-motion: numeric countdown only | `present` (extend) |

### Stream B: Mobile Participant Energizer UX

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| MOB3-ENERGIZER-01 | Quick Finger mobile touch target: answer button min 80px height, fullscreen layout, countdown rings with haptic at 3-2-1 | 5 | P1 | 80px touch targets; haptic optional (no a11y impact) | `vote` (extend) |
| MOB3-ENERGIZER-02 | Team Quiz mobile score reveal: confetti burst (CSS only, reduced-motion: none), score card slide-up from bottom, share score via Web Share API | 5 | P1 | Score card `role="dialog"`, reduced-motion: static display | `vote` (extend) |
| MOB3-ENERGIZER-03 | Leaderboard mobile view: full-screen bottom sheet, top-3 podium with avatar initials, pull-to-dismiss | 5 | P1 | `role="list"`, rank announced via `aria-label="Rank n: <name> <score>"` | `present` |

### Stream C: Partner Portal Foundation

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PARTNER-01 | Partner portal route `/partner` (Team plan + gate): partner tier card (Registered / Built / Premier), requirements checklist, CTA to upgrade | 8 | P1 | `role="list"` for tier requirements, `aria-expanded` on collapsible sections | `partner` |
| PARTNER-02 | Partner tier badge: `<PartnerBadge tier="built" />` component, displayed in Team Settings header and partner portal; colour-coded per tier | 5 | P1 | Colour + icon + text; `role="img"` with `aria-label="Partner tier: Built"` | `partner` |
| PARTNER-03 | Sandbox API key panel in partner portal: generate / reveal / revoke sandbox key for `Team` plan; key reveal requires confirmation click; revealed key `role="status"` | 8 | P1 | Secret reveal: explicit click; revealed text `role="status"` announcing key ready | `partner` |
| PARTNER-04 | Integration health dashboard in partner portal: status cards for each connected integration (Slack / Teams / Webhook / Zoom); last-sync time, error count badge | 8 | P1 | Error badge: colour + icon + text; live poll `aria-live="polite"` | `partner` |

### Stream D: A11y + i18n

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| MOB3-A11Y-01 | Presenter mobile a11y sweep: FAB cluster focus order, swipe keyboard equivalents, coaching drawer focus trap | 5 | P0 | 0 violations | — |
| PARTNER-I18N-01 | EN/NL/DE/FR/ES for `partner.json` (~50 keys: tier labels, requirements, sandbox panel, health cards) | 5 | P1 | CI passes | `partner` × 5 |

**Sprint 64 total: 8+8+5+8+5+5+5+5+8+5+8+8+5+5 = 99 pts** — add:

| PARTNER-05 | Partner directory listing page `/partner/directory` (public): searchable grid of Built+Premier partners with logos, integration categories, CTA to connect | 8 | P2 | Grid: `role="list"`, search `role="search"` landmark, focus management on filter | `partner` |
| MOB3-DISPLAY-01 | Full-screen display mode for mobile secondary screen: `Display.tsx` mobile responsive, swipe-to-next-chart, presenter-follow mode | 8 | P1 | `aria-live="polite"` on chart transitions | `present` |
| MOB3-PRES-06 | Mobile pre-flight screen (`Launchpad.tsx` at ≤640px): stacked layout, all action buttons visible without scroll, QR code collapsible | 5 | P1 | All CTAs within first 4 tab stops; 44px | `launchpad` (extend) |

**Sprint 64 revised: 99+8+8+5 = 120 pts** — add:

| PARTNER-SANDBOX-01 | Sandbox environment banner: orange "Sandbox mode" persistent banner in all API responses when using sandbox key; dismissible but re-shows on reload | 5 | P1 | Banner `role="status"`, not `role="alert"` | `partner` |

**Sprint 64 total: 125 pts ✓**

---

## Sprint 65 — Public API Developer Portal + Webhook Event Log UI

**Window:** ~2026-Q3 week 11 | **Target:** 135 pts | **Release gate:** v3.0-beta stream C

**Goal:** Build the developer-facing surfaces for v3.0 Public API v2: API key management
for production, rate-limit indicators, webhook delivery log, and the documentation frame.

### Stream A: API Key Management

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| DEVP-KEY-01 | API Keys page in Team Settings: list of keys (name / created / last-used / scope), create new key modal, revoke with confirmation | 8 | P0 | Modal `role="dialog"`, focus trap; revoke `role="alertdialog"` with destructive confirm | `developer` |
| DEVP-KEY-02 | Create key flow: name + scope multi-select (sessions:read / sessions:write / webhooks:manage / admin:read), copy-to-clipboard on create; key never shown again warning | 8 | P0 | Key copy: `role="status"` announcement; warning styled as `role="alert"` | `developer` |
| DEVP-KEY-03 | API key rate-limit indicator: per-key usage bar (requests today / daily limit), plan-gated upgrade prompt at 80% usage | 5 | P1 | `role="progressbar"`, `aria-valuenow`; upgrade prompt `role="status"` | `developer` |
| DEVP-KEY-04 | API key scope chip display: inline `<ScopeChip>` component per scope, colour-coded (read=blue, write=orange, admin=red), tooltip with scope description | 3 | P1 | Chips `role="list"`, tooltip on focus | `developer` |

### Stream B: Webhook Event Log

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| DEVP-WEBHOOK-01 | Webhook delivery log page in Team Settings → Webhooks: paginated table (endpoint / event / status / timestamp / duration / response code) | 8 | P0 | `role="table"`, `<th scope="col">`, keyboard-accessible pagination | `developer` |
| DEVP-WEBHOOK-02 | Delivery log detail drawer: click row → slide-over with full request/response payload (JSON syntax highlighted), retry CTA | 8 | P1 | Slide-over `role="dialog"`, focus trap; code block `role="region"` | `developer` |
| DEVP-WEBHOOK-03 | Webhook event filter: filter bar above log (event type / status / date range); `useApiQuery` with debounced search | 5 | P1 | Filter controls labelled; keyboard-accessible date range | `developer` |
| DEVP-WEBHOOK-04 | Webhook health badge: "Healthy / Degraded / Failing" badge in webhook list row; colour + icon + text | 3 | P1 | Colour + icon + text (not colour alone) | `developer` |

### Stream C: Developer Portal Documentation Frame

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| DEVP-DOCS-01 | Developer portal route `/developer`: overview page with API version, base URL, auth instructions, quick-start code block | 8 | P1 | `<main>` landmark, `<h1>/<h2>/<h3>` hierarchy, code blocks `role="region" aria-label="Code example"` | `developer` |
| DEVP-DOCS-02 | API endpoint reference accordion: collapsible sections per endpoint group (Sessions / WebSocket / Webhooks / Admin); request/response schema display | 8 | P1 | Accordion: `aria-expanded`, `aria-controls`, keyboard Space/Enter to toggle | `developer` |
| DEVP-DOCS-03 | Try-it panel: inline request builder for GET endpoints (read-only, sandbox key only); sends real request, shows raw JSON response | 13 | P2 | Try-it `role="region"`, all inputs labelled, error `role="alert"` | `developer` |
| DEVP-DOCS-04 | WebSocket event reference: sortable table of all `ServerMessage` types from `types.ts`; filter by session state (LIVE/ENERGIZING); copy example payload | 8 | P1 | Table `aria-sort`, copy button `aria-label` | `developer` |

### Stream D: Usage Analytics + i18n

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| DEVP-USAGE-01 | API usage analytics widget in developer portal: daily call count chart (reuses `<TimeSeriesChart>` from ADMIN3-DASH-03), error-rate line, top endpoints list | 8 | P1 | SVG aria-label + tabular fallback | `developer` |
| DEVP-A11Y-01 | Developer portal a11y sweep: accordion keyboard nav, log table screen-reader, try-it panel label coverage | 5 | P0 | 0 axe violations | — |
| DEVP-I18N-01 | EN/NL/DE/FR/ES for `developer.json` (~65 keys: API key management, webhook log, portal docs labels) | 5 | P1 | CI passes | `developer` × 5 |

**Sprint 65 total: 8+8+5+3+8+8+5+3+8+8+13+8+8+5+5 = 111 pts** — add:

| DEVP-CHANGELOG-01 | API changelog feed in developer portal: versioned entries (v1 → v2 migration note, breaking-change badges), subscribe-to-updates CTA | 5 | P2 | Feed: `role="feed"`, each entry `role="article"` | `developer` |
| DEVP-OAUTH-01 | OAuth app registration in partner portal (Built-tier gate): app name + redirect URIs + scope selection; client_id/secret display (once); edit/delete flow | 13 | P1 | Secret display: explicit reveal click; `role="alert"` on first-show; modal for delete confirm | `developer` |

**Sprint 65 revised: 111+5+13 = 129 pts** — add:

| DEVP-STATUS-01 | API status indicator in developer portal: live uptime badge polling `/api/health`; degraded / incident badges; link to status page stub | 3 | P1 | Badge: colour + icon + text | `developer` |

**Sprint 65 total: 132 pts ✓**

---

## Sprint 66 — Enterprise Compliance Dashboard

**Window:** ~2026-Q3 week 13 | **Target:** 140 pts | **Release gate:** v3.0-beta stream B+D

**Goal:** Build the enterprise admin compliance surface: SOC2 evidence tracker, DPA
management, GDPR audit timeline, and deletion automation status — targeted at
enterprise admins and compliance officers.

### Stream A: Compliance Dashboard Shell

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| ENT3-COMP-01 | Compliance dashboard route in Admin: tab `Compliance` alongside Analytics; sub-tabs (SOC2 / GDPR / DPA / Audit Trail) | 5 | P0 | `role="tablist"`, keyboard nav, `aria-selected` | `compliance` |
| ENT3-COMP-02 | SOC2 status tracker: evidence checklist (controls with status: not-started / in-progress / complete / N/A), progress ring, last-updated timestamp | 8 | P0 | Checklist `role="list"`, status chip colour + icon + text, progress ring `role="progressbar"` | `compliance` |
| ENT3-COMP-03 | GDPR audit timeline: paginated list of GDPR-relevant events (`gdpr.deletion_requested`, `gdpr.deletion_completed`, `user.consent`, `ai.inference`) with filter | 8 | P0 | `role="feed"`, each entry `role="article"`, filter `role="search"` | `compliance` |
| ENT3-COMP-04 | GDPR deletion queue: pending deletion requests table (team-scoped), status badge, manual approve/force-process CTA (admin-only) | 8 | P1 | `role="table"`, action buttons `aria-label` | `compliance` |

### Stream B: DPA Management

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| ENT3-DPA-01 | DPA template download in Compliance tab: download button → PDF download + email confirmation option; DPA version badge | 5 | P1 | Download link: accessible, `aria-label="Download DPA template (PDF)"` | `compliance` |
| ENT3-DPA-02 | DPA signing status table (Enterprise): shows each team that has signed DPA, date, version; pending teams highlighted | 5 | P1 | Table `<th scope>`, status colour + icon + text | `compliance` |
| ENT3-DPA-03 | Sub-processor registry page in Compliance: sortable table (name / purpose / location / data category / opt-out link); search filter | 8 | P1 | Table keyboard-sortable, `aria-sort`, filter labelled | `compliance` |

### Stream C: Forensic Audit Export

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| ENT3-FORENSIC-01 | Forensic audit export UI (`AUDIT-EXPORT-FORENSIC-01` shipped backend in S42): date range + team scope + event type filter → `GET /api/admin/audit/forensic.csv` download | 8 | P0 | Date range keyboard-accessible, filter controls labelled | `compliance` |
| ENT3-FORENSIC-02 | Forensic export schedule: set recurring export (weekly/monthly) → email delivery; schedule list with toggle/delete | 5 | P1 | Schedule toggle `role="switch"`, delete `role="alertdialog"` confirm | `compliance` |
| ENT3-AUDIT-VIZ-01 | Audit event visualiser: timeline bar chart of audit events per day by category (auth / session / billing / GDPR); click bar → filter | 8 | P1 | SVG `aria-label` + tabular fallback; click = keyboard Enter/Space equivalent | `compliance` |

### Stream D: EU Residency + i18n

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| ENT3-RESIDENCY-01 | EU residency status widget in Compliance dashboard: "Data at rest: EU (Cloudflare D1 EU)" badge + link to routing evidence doc | 5 | P1 | Badge: `role="img"` + text alternative | `compliance` |
| ENT3-RESIDENCY-02 | EU opt-in confirmation modal for Enterprise teams: shown once on first admin visit after ENT-RESIDENCY-01 ships; confirms EU routing; logs consent to audit | 5 | P1 | `role="alertdialog"`, focus trap, explicit confirm button | `compliance` |
| ENT3-COMP-A11Y-01 | Compliance dashboard a11y sweep: timeline keyboard nav, all tables `th scope`, download links accessible | 8 | P0 | 0 axe violations on compliance route | — |
| ENT3-I18N-01 | EN/NL/DE/FR/ES for `compliance.json` (~80 keys: SOC2 tracker, GDPR timeline, DPA labels, forensic export, sub-processor registry) | 5 | P1 | CI passes | `compliance` × 5 |
| ENT3-COMP-MOB-01 | Compliance dashboard mobile responsive: stacked layout ≤768px, collapsible sections, table horizontal scroll containers | 5 | P1 | Touch targets 44px, swipe-scroll tables labelled | `compliance` |
| ENT3-COACHING-UX-01 | Post-session coaching page (successor to AI-COACHING-02 from S39): full-screen Insights → Coaching tab; multi-turn coaching conversation UI with confidence meter | 13 | P1 | Chat bubbles `role="log"`, `aria-live="polite"`, confidence meter `role="meter"` | `insights` (extend) |

**Sprint 66 total: 5+8+8+8+5+5+8+8+5+8+5+5+8+5+5+13 = 115 pts** — add:

| ENT3-SAML-02 | SAML SSO settings UX polish: metadata upload drag-and-drop, test-connection flow, IdP certificate expiry warning badge | 8 | P1 | Drag-drop: keyboard equivalent file input fallback; expiry badge: colour + icon | `settings` (extend) |
| ENT3-RBAC-UI-01 | Custom role management UI v2 (AUTHZ-ROLE-UI-01 shipped in S24; this adds bulk assignment + role templates): role template library, bulk-assign dialog | 8 | P1 | Dialog focus trap; bulk checkbox group labelled | `admin` (extend) |

**Sprint 66 total: 115+8+8 = 131 pts** — add:

| ENT3-SSO-ONBOARD-01 | Enterprise SSO onboarding checklist wizard: 5-step (SAML config / user sync / test login / role mapping / activate), progress saved in KV | 8 | P1 | Wizard steps `aria-current="step"`, keyboard-navigable | `settings` (extend) |

**Sprint 66 total: 139 pts ✓**

---

## Sprint 67 — Partner Integration Configurator

**Window:** ~2026-Q3 week 15 | **Target:** 130 pts | **Release gate:** v3.0-beta stream C

**Goal:** Build the UI for partners to configure, test, and manage their integration —
OAuth app settings, event subscriptions, field-mapping, and test-event delivery.

### Stream A: OAuth App Management

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PARTNER-INT-01 | OAuth app detail page: app name / logo / redirect URIs / scopes / client credentials; edit in-place with autosave | 8 | P1 | Autosave `aria-live="polite"` status announcement; 44px inputs | `partner` |
| PARTNER-INT-02 | OAuth consent screen preview: live preview of what users see when authorizing the partner app; branded with partner logo | 5 | P1 | Preview `role="img" aria-label="OAuth consent screen preview"` | `partner` |
| PARTNER-INT-03 | Redirect URI manager: add/edit/delete URIs with validation; blocklist check for non-HTTPS / localhost in production | 5 | P1 | Error `role="alert"` on invalid URI; delete `role="alertdialog"` | `partner` |
| PARTNER-INT-04 | OAuth app review status badge: "Pending review / Approved / Suspended" chip; link to review criteria page | 3 | P1 | Colour + icon + text | `partner` |

### Stream B: Event Subscriptions + Field Mapping

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PARTNER-INT-05 | Event subscription configurator: checkbox group of Qesto webhook events (session.started / vote.submitted / session.closed / etc.); filter by category | 8 | P1 | `role="group"` for each category, `aria-checked`, keyboard-navigable | `partner` |
| PARTNER-INT-06 | Salesforce field mapping UI: drag-and-drop (with keyboard alternative) Qesto fields → Salesforce fields; required-field indicator | 8 | P1 | Drag: keyboard equivalent (Select + Arrow), `aria-grabbed`, `aria-dropeffect` | `partner` |
| PARTNER-INT-07 | Webhook payload preview: real-time JSON preview of what will be sent for selected event; syntax-highlighted, copy button | 5 | P1 | Code block `role="region" aria-label="Payload preview"` | `partner` |

### Stream C: Test Event + Delivery Monitoring

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PARTNER-INT-08 | Send test event CTA: select event type → send test to registered endpoint → show delivery result (status + latency + response body) inline | 8 | P0 | Loading state `aria-busy`; result `role="alert"` | `partner` |
| PARTNER-INT-09 | Partner delivery dashboard: per-endpoint success/failure rate, last 7-day chart, P95 latency badge | 8 | P1 | Chart SVG aria-label + text summary | `partner` |
| PARTNER-INT-10 | Integration onboarding checklist for new partners: 6-step (register → OAuth app → sandbox test → production review → go-live → directory listing) | 8 | P1 | Checklist `role="list"`, step status: colour + icon + text | `partner` |

### Stream D: LDAP UI + i18n

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PARTNER-LDAP-01 | LDAP settings UI in Team Settings → Directory: server host/port/bind-DN form; test-connection CTA; last-sync status and group → role mapping editor | 13 | P1 | Form: all inputs labelled, error messages linked via `aria-describedby`; status `role="status"` | `settings` (extend) |
| PARTNER-LDAP-02 | LDAP sync preview: "Preview sync" before applying → shows `n users added / m roles changed / k users removed`; confirm CTA | 5 | P1 | Preview result: `role="region"`, changes list accessible | `settings` |
| PARTNER-I18N-02 | EN/NL/DE/FR/ES for `partner.json` additions (~45 new keys from S67 stories) | 5 | P1 | CI passes | `partner` × 5 |
| PARTNER-A11Y-01 | Partner portal + integration configurator a11y sweep: field-mapping keyboard nav, event subscription group, test-event result | 5 | P0 | 0 axe violations | — |
| PARTNER-MOTION-01 | Integration configurator micro-animations: step transitions (slide 150ms), field-mapping drag ghost, test-event result slide-in | 3 | P2 | `prefers-reduced-motion: reduce` disables all | — |

**Sprint 67 total: 8+5+5+3+8+8+5+8+8+8+13+5+5+5+3 = 107 pts** — add:

| PARTNER-DIR-02 | Partner directory detail page (`/partner/directory/:slug`): partner profile (logo, description, integration category, install CTA, screenshots carousel) | 8 | P2 | Carousel: `aria-roledescription="slide"`, keyboard arrow nav | `partner` |
| PARTNER-REVIEW-01 | Partner review request flow: "Submit for review" CTA → checklist confirmation → submit to review queue; status polling | 5 | P1 | Checklist `role="list"`, loading `aria-busy`, confirmation `role="dialog"` | `partner` |

**Sprint 67 total: 107+8+5 = 120 pts** — add:

| PARTNER-NOTIFY-01 | Partner notification centre in partner portal: integration events (review status / delivery failures / quota warnings) as inbox feed | 8 | P1 | Feed `role="feed"`, each item `role="article"`, unread badge `aria-label` | `partner` |

**Sprint 67 total: 128 pts ✓**

---

## Sprint 68 — PWA Push Notification Inbox + Background Sync UX

**Window:** ~2026-Q4 week 1 | **Target:** 125 pts | **Release gate:** v3.0 stream A

**Goal:** Complete the push notification experience: in-app notification inbox,
per-event notification settings, background sync status, and the final offline-first
vote confirmation flow.

### Stream A: Notification Inbox

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PWA3-INBOX-01 | In-app notification inbox (`/notifications`): pull from `/api/notifications`, grouped by date, mark-as-read, mark-all-read CTA | 8 | P0 | `role="feed"`, each item `role="article"`, `aria-label="Unread notification"`, `aria-live="polite"` for unread count | `mobile` |
| PWA3-INBOX-02 | Notification bell in app shell top bar: unread count badge, `aria-label="Notifications, n unread"`, click → inbox | 3 | P0 | Badge colour + number; `aria-live="polite"` on count update | `mobile` |
| PWA3-INBOX-03 | Push notification tap deep-link: tapping a push → opens correct route (session invite → JoinPage, results ready → Results, team mention → Dashboard) | 5 | P1 | Focus lands on relevant content element | `mobile` |
| PWA3-INBOX-04 | Empty notification state: illustrated empty state with "No notifications yet" and push opt-in CTA if not yet enabled | 3 | P1 | Empty state `aria-label` | `mobile` |

### Stream B: Per-Event Notification Settings

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PWA3-NOTIF-01 | Granular push settings in `AccountSettings → Notifications` tab: per-event toggle grid (session invite / results ready / team mention / energizer start / coaching complete) | 8 | P1 | `role="group"` per category, each `role="switch"`, `aria-checked`, visible label | `mobile` |
| PWA3-NOTIF-02 | Notification frequency cap: "Maximum notifications per day" selector (unlimited / 10 / 5 / 3); plan hint for enterprise users | 5 | P1 | Select `aria-label`, plan hint `role="note"` | `mobile` |
| PWA3-NOTIF-03 | Notification quiet hours: start/end time inputs for do-not-disturb window; timezone display | 5 | P1 | Time inputs `aria-label`, timezone `role="note"` | `mobile` |

### Stream C: Background Sync + Offline Confirmation

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PWA3-BGSYNC-01 | Background sync status indicator in bottom nav: sync icon with last-synced timestamp tooltip; `SyncManager` API with fallback to online-only | 5 | P1 | Icon `aria-label="Last synced n minutes ago"` | `mobile` |
| PWA3-BGSYNC-02 | Offline vote confirmation: after submit while offline → "Saved locally, will sync when connected" confirmation card with queue count | 5 | P0 | Confirmation `role="status"`, icon + text (not colour alone) | `mobile` |
| PWA3-BGSYNC-03 | Sync conflict resolution UI: if vote queue conflicts with server state → "Session already closed" toast with graceful dismiss | 3 | P0 | Toast `role="alert"`, action button `aria-label` | `mobile` |
| PWA3-BGSYNC-04 | Background sync progress page (`/sync-status`): shows pending votes, failed deliveries, manual retry CTA; accessible from notification tray | 5 | P1 | List `role="list"`, retry `aria-label="Retry sync for session <name>"` | `mobile` |

### Stream D: App-Wide Polish + i18n

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PWA3-SPLASH-01 | PWA splash screen: branded animated logo on app open (CSS, 400ms max), `prefers-reduced-motion` disables animation | 3 | P2 | Reduced-motion: static logo only | `mobile` |
| PWA3-HAPTIC-01 | Haptic feedback design system: centralized `useHaptic()` hook; maps to `navigator.vibrate()` patterns for submit / error / success; opt-out in settings | 5 | P1 | Haptic is progressive enhancement, never sole feedback | `mobile` |
| PWA3-SHORTCUT-01 | PWA manifest shortcuts: `Start session` (→ Wizard) and `Join session` (→ JoinPage) as `shortcuts[]` in manifest; updated for v3 routes | 3 | P1 | Standard manifest; no a11y gate | — |
| PWA3-WEARABLE-01 | Minimal watch/wearable display mode: `@media (max-width:200px)` → participant shows current question text + 2 large tap targets only | 5 | P2 | 80px touch targets; high-contrast only | `mobile` |
| PWA3-A11Y-02 | Notification + sync a11y sweep: inbox feed keyboard nav, switch controls, sync status announcements, quiet-hours inputs | 8 | P0 | 0 axe violations | — |
| PWA3-I18N-02 | EN/NL/DE/FR/ES additions to `mobile.json` (~50 new keys from S68 stories) | 5 | P1 | CI passes | `mobile` × 5 |
| PWA3-PERF-02 | Notification inbox perf: virtualized list (`useVirtualScroll` for 100+ items), pagination beyond 50, image lazy-load for partner logos | 8 | P1 | CLS < 0.05; `aria-busy` during page load | — |

**Sprint 68 total: 8+3+5+3+8+5+5+5+5+3+5+3+5+8+5+5+8+5 = 105 pts** — add:

| PWA3-WIDGET-01 | Home screen widget data (PWA app badge update + lock-screen notification preview): `navigator.setAppBadge()` with unread count; clear badge on inbox open | 5 | P1 | Unread count `aria-label` in bell icon stays in sync | `mobile` |
| PWA3-BIOMETRIC-01 | Biometric re-auth for sensitive admin actions on mobile: `PublicKeyCredential` / `navigator.credentials.get()` prompt before forensic export / API key reveal | 8 | P1 | Auth prompt uses system UI; fallback is PIN/password; `aria-label` on trigger | `mobile` |

**Sprint 68 total: 105+5+8 = 118 pts** — add:

| PWA3-THEME-01 | System dark-mode detection: `prefers-color-scheme: dark` CSS tokens for app shell surfaces only (join page, bottom nav, notification inbox); full dark mode is post-S70 | 8 | P2 | Contrast ≥ 4.5:1 in both light + dark | `—` |

**Sprint 68 total: 126 pts ✓**

---

## Sprint 69 — v3.0 i18n Complete + Cross-Surface A11y Audit

**Window:** ~2026-Q4 week 3 | **Target:** 122 pts | **Release gate:** v3.0 stream D

**Goal:** Achieve zero i18n gaps across all 6 new namespaces (5 locales), complete the
WCAG 2.1 AA audit on all v3.0 surfaces, and bring motion/animation into full
`prefers-reduced-motion` compliance.

### Stream A: i18n Completeness

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| I18N3-AUDIT-01 | Full i18n gap audit across 6 new namespaces: run `npm run check:i18n`; document remaining gaps; assign to translators | 3 | P0 | — | All new ns |
| I18N3-MOBILE-01 | Complete `mobile.json` NL/DE/FR/ES translations: all ~130 keys; QA against UI at 375px in each locale | 5 | P0 | No raw keys in any locale at 375px | `mobile` × 4 |
| I18N3-BRANDING-01 | Complete `branding.json` NL/DE/FR/ES: ~70 keys; QA brand configurator in each locale | 5 | P0 | No raw keys | `branding` × 4 |
| I18N3-PARTNER-01 | Complete `partner.json` NL/DE/FR/ES: ~95 keys; QA partner portal + integration configurator | 5 | P0 | No raw keys | `partner` × 4 |
| I18N3-TRUST-01 | Complete `trust.json` NL/DE/FR/ES: ~60 keys; QA trust badges + scale proof page | 5 | P0 | No raw keys | `trust` × 4 |
| I18N3-DEVELOPER-01 | Complete `developer.json` NL/DE/FR/ES: ~65 keys; QA developer portal + webhook log | 5 | P0 | No raw keys | `developer` × 4 |
| I18N3-COMPLIANCE-01 | Complete `compliance.json` NL/DE/FR/ES: ~80 keys; QA compliance dashboard | 5 | P0 | No raw keys | `compliance` × 4 |
| I18N3-PLURAL-01 | Plural form QA across all new namespaces: "n sessions / 1 session", "n votes pending", "n partners", "n notifications" — all 5 locales | 5 | P1 | No broken plurals at 0/1/many | All new ns |

### Stream B: WCAG 2.1 AA Full Audit (v3 surfaces)

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| A11Y3-AUDIT-01 | axe-core automated audit: integrate axe-core into existing test suite for all 6 new routes (`/partner`, `/developer`, `/notifications`, `/trust/scale`, `/compliance`, `/branding`) | 8 | P0 | 0 violations on all routes | — |
| A11Y3-KEYBOARD-01 | Full keyboard traversal audit: tab through every interactive element on all new surfaces; document and fix any focus-order issues, missing labels, or trapped focus | 8 | P0 | Keyboard-only traversal possible end-to-end | — |
| A11Y3-SCREEN-01 | Screen reader audit (VoiceOver/NVDA): all new surfaces tested with screen reader; fix any missing region labels, unhelpful announcements, broken `aria-live` regions | 8 | P0 | VoiceOver + NVDA: content understandable without visual | — |
| A11Y3-CONTRAST-01 | Colour contrast sweep: audit all new text/icon/badge combinations; fix any below 4.5:1; update token docs with safe combinations | 5 | P0 | 4.5:1 minimum on all new text; documented in tokens.ts | — |
| A11Y3-MOTION-01 | Reduced-motion sweep: audit all new animations (brand preview transitions, notification inbox, trust badge pulse, admin charts); confirm `prefers-reduced-motion: reduce` disables all | 5 | P0 | No animation when preference is set | — |
| A11Y3-REFLOW-01 | 400% zoom reflow: test all new surfaces at 400% zoom (1280px viewport → 320px equivalent); fix any horizontal scrolling or content truncation | 5 | P1 | No horizontal scrolling at 400% zoom | — |

### Stream C: Performance + Quality Gates

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| PERF3-BUDGET-01 | Performance budget CI: Lighthouse budget JSON for all new routes; fail CI if LCP > 2.5s or CLS > 0.1 on simulated 4G mobile | 8 | P0 | LCP < 2.5s, CLS < 0.1 (CI-enforced) | — |
| PERF3-BUNDLE-01 | Bundle audit: check for duplicate dependencies across new lazy-loaded routes; tree-shake unused chart library code; target <200KB gzip per route | 8 | P1 | <200KB gzip on all new routes | — |
| QA3-REGRESSION-01 | Cross-surface regression: run existing 717+ test suite; fix any failures caused by new routes/components interfering with existing surfaces | 8 | P0 | All existing tests green; no new failures | — |
| QA3-DESIGN-TOK-01 | Design token drift check on all new surfaces: run `npm run check:tokens-drift`; ensure 0 hardcoded hex values; CSS vars only | 3 | P0 | 0 token drift | — |

### Stream D: Documentation + Spec Updates

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| DOCS3-A11Y-01 | Update `A11Y_FULL.md`: document all new aria patterns from S60–S69 (trust badges, partner portal, notification inbox, compliance dashboard) | 3 | P1 | — | — |
| DOCS3-I18N-01 | Update i18n gap inventory report: regenerate with 6 new namespaces; document key count per namespace per locale | 3 | P1 | — | — |
| DOCS3-MOBILE-01 | Update `SPEC_FRONTEND.md`: document PWA shell contract, bottom nav structure, push notification architecture, offline flow | 5 | P1 | — | — |

**Sprint 69 total: 3+5+5+5+5+5+5+5+8+8+8+5+5+5+8+8+8+3+3+3+5 = 115 pts** — add:

| A11Y3-FOCUS-01 | Focus-ring hardening: audit all new surfaces for visible focus ring; standardize to `ring-2 ring-offset-2 ring-[--color-brand]` utility class | 5 | P0 | Visible focus ring on every interactive element | — |
| I18N3-DATENUM-01 | Date/number format QA across new surfaces: admin analytics time-series dates, compliance timeline timestamps — NL/DE formatting checked | 3 | P1 | Locale-correct date/number format everywhere | All new ns |

**Sprint 69 total: 115+5+3 = 123 pts ✓**

---

## Sprint 70 — v3.0 Release Polish + Final QA

**Window:** ~2026-Q4 week 5 | **Target:** 138 pts | **Release gate:** v3.0 SHIP 🚀

**Goal:** Cross-surface visual polish, motion choreography for new surfaces, final end-to-end
QA, v3.0 release notes, and marketing surface updates.

### Stream A: Visual Polish

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| POLISH3-MOTION-01 | Motion choreography for new surfaces: page-enter animations on partner portal, compliance dashboard, developer portal; list-stagger on notification inbox; spring on brand preview update | 8 | P1 | `prefers-reduced-motion: reduce` disables all; stagger via CSS `animation-delay` | — |
| POLISH3-EMPTY-01 | Empty-state parity sweep: all new routes get illustrated empty states (partner portal no integrations, developer portal no API keys, notification inbox, compliance no events) | 8 | P1 | Empty states descriptive `aria-label`; not layout-shifting | `mobile`, `partner`, `developer`, `compliance` |
| POLISH3-SKELETON-01 | Skeleton loader parity: all new async surfaces have geometric skeleton loaders matching final content shape; `aria-busy="true"` during load | 8 | P0 | `aria-busy`, CLS < 0.05 | — |
| POLISH3-ERROR-01 | Error state parity: all new routes have 3-state async handling (loading / error / success) with `role="alert"` on error and retry CTA | 5 | P0 | `role="alert"` on all error states; retry keyboard-accessible | — |
| POLISH3-TOAST-01 | Toast system v3: unified `useToast()` hook replacing ad-hoc toasts across new surfaces; `role="status"` for info, `role="alert"` for errors; max 3 stacked | 8 | P1 | Stack rendered with `aria-live="polite"` container; Esc-dismissible | `common` (extend) |
| POLISH3-ICON-01 | Icon audit: all new icon-only buttons across S60–S69 confirmed to have `aria-label`; no tooltip-only labels | 3 | P0 | 0 icon-only buttons without `aria-label` | — |

### Stream B: Marketing Surface Updates

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| MKT3-HOME-01 | Home page v3.0 update: above-fold headline + sub-copy for v3 positioning ("Real-time decisions at global scale"); update feature strip with mobile + partner + compliance highlights | 8 | P1 | `<h1>` clear, CTA 44px, no contrast regressions | `home` (extend) |
| MKT3-PRICING-01 | Pricing page partner tier addition: "Partner" plan card with API access + custom domain + white-label; plan comparison table updated | 8 | P1 | Table `<th scope>`, keyboard-navigable, contrast checked | `billing` (extend) |
| MKT3-MOBILE-01 | Mobile app landing section on Home: App Store / Play Store placeholder banners (pointing to install prompt); PWA install CTA; screenshot carousel | 5 | P2 | Carousel keyboard nav, badge `alt` text | `home` (extend) |
| MKT3-PARTNER-LND-01 | Partner landing page `/partners`: headline + tier cards + "Become a partner" CTA + FAQ accordion | 8 | P2 | Page landmark `<main>`, `<h1>`, accordion `aria-expanded`, FAQ `<dl>/<dt>/<dd>` | `partner` |

### Stream C: End-to-End QA

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| QA3-E2E-MOB-01 | Mobile PWA E2E: install flow → offline vote → push notification → inbox → sync; screen-recorded walkthrough | 8 | P0 | All E2E steps keyboard-accessible; axe-core on each step | — |
| QA3-E2E-PARTNER-01 | Partner portal E2E: register → sandbox key → OAuth app → test event → go-live; screen-recorded | 8 | P0 | — | — |
| QA3-E2E-ADMIN-01 | Admin analytics v3 E2E: dashboard load → funnel tab → export CSV → forensic audit; screen-recorded | 5 | P0 | — | — |
| QA3-E2E-COMPLIANCE-01 | Compliance dashboard E2E: SOC2 tracker → GDPR timeline → DPA download → forensic export; screen-recorded | 5 | P0 | — | — |
| QA3-TYPE-01 | Final `npm run typecheck` green with 0 errors across all new components | 3 | P0 | — | — |
| QA3-I18N-FINAL-01 | Final `npm run check:i18n` green: all 6 new namespaces × 5 locales; 0 orphaned keys; 0 missing keys | 3 | P0 | — | — |

### Stream D: Release Notes + Docs

| ID | Story | Pts | Pri | A11y gate | i18n ns |
|----|-------|-----|-----|-----------|---------|
| RC3-NOTES-01 | v3.0 frontend release notes: markdown changelog covering all S60–S70 UI/UX changes, new components, new routes, i18n namespaces, a11y improvements | 3 | P1 | — | — |
| RC3-SPEC-01 | Update `SPEC_FRONTEND.md`: document all new route surfaces, component patterns, hook contracts, and lazy-loading strategy | 5 | P1 | — | — |
| RC3-BACKLOG-01 | Close S60–S70 stories in BACKLOG_MASTER.md; add v3.0 deferred items as S71+ backlog seeds | 3 | P1 | — | — |

**Sprint 70 total: 8+8+8+5+8+3+8+8+5+8+8+8+5+5+3+3+3+5+3 = 113 pts** — add:

| POLISH3-FOCUS-RING-01 | Global focus-ring utility class consolidation: single `@layer base { :focus-visible { … } }` rule replaces scattered `ring-*` utilities; audit + replace across all new components | 8 | P0 | Consistent visible focus ring across all new surfaces | — |
| POLISH3-DARK-PREP-01 | Dark mode token scaffold: add `--color-surface-dark`, `--color-text-dark`, `--color-border-dark` to `tokens.ts` as unused vars; no UI change yet; enables dark mode in v3.1 | 5 | P2 | No contrast regressions in light mode | — |
| QA3-A11Y-FINAL-01 | Final a11y sign-off: rerun axe-core on all 6 new routes post-polish; sign-off checklist in PR; update `A11Y_FULL.md` with v3.0 conformance statement | 8 | P0 | 0 violations; conformance statement in docs | — |

**Sprint 70 total: 113+8+5+8 = 134 pts ✓**

---

## Consolidated Story Registry (S60–S70)

| Sprint | Story IDs | Pts | Notes |
|--------|-----------|-----|-------|
| S60 | PWA3-SHELL-01/02, PWA3-VIEWPORT-01, PWA3-CODE-SPLIT-01, PWA3-PERF-01, PWA3-INSTALL-01/02, PWA3-JOIN-01, PWA3-SHARE-01, PWA3-OFFLINE-01/02, PWA3-SW-01, PWA3-PUSH-01/02, PWA3-A11Y-01, PWA3-I18N-01, PWA3-VOTE-MOB-01, MOB3-PRES-MOB-01 _(from S64 partial)_ | 128 | Mobile PWA v3 core |
| S61 | BRAND3-CONF-01/02/03/04/05, BRAND3-JOIN-01/02, BRAND3-PRESENT-01, BRAND3-EXPORT-01, BRAND3-DOMAIN-01/02/03, BRAND3-EMAIL-01/02, BRAND3-A11Y-01, BRAND3-I18N-01, BRAND3-MOTION-01 | 132 | White-label UI |
| S62 | ADMIN3-DASH-01/02/03/04, ADMIN3-PLAN-01/02/03, ADMIN3-EXPORT-01/02/03, ADMIN3-HEALTH-01/02, ADMIN3-A11Y-01, ADMIN3-I18N-01, ADMIN3-RETENTION-01, ADMIN3-MOBILE-01, ADMIN3-METRIC-01 | 134 | Admin analytics v3 |
| S63 | TRUST3-BADGE-01/02/03/04/05, TRUST3-ZK-01/02/03, TRUST3-SCALE-01/02/03/04, TRUST3-GDPR-01/02/03, TRUST3-SOCIAL-01, TRUST3-A11Y-01, TRUST3-I18N-01 | 123 | Trust + scale proof |
| S64 | MOB3-PRES-01/02/03/04/05/06, MOB3-ENERGIZER-01/02/03, MOB3-DISPLAY-01, MOB3-A11Y-01, PARTNER-01/02/03/04/05, PARTNER-I18N-01, PARTNER-SANDBOX-01 | 125 | Mobile presenter + partner foundation |
| S65 | DEVP-KEY-01/02/03/04, DEVP-WEBHOOK-01/02/03/04, DEVP-DOCS-01/02/03/04, DEVP-USAGE-01, DEVP-A11Y-01, DEVP-I18N-01, DEVP-CHANGELOG-01, DEVP-OAUTH-01, DEVP-STATUS-01 | 132 | Developer portal |
| S66 | ENT3-COMP-01/02/03/04, ENT3-DPA-01/02/03, ENT3-FORENSIC-01/02, ENT3-AUDIT-VIZ-01, ENT3-RESIDENCY-01/02, ENT3-COMP-A11Y-01, ENT3-I18N-01, ENT3-COMP-MOB-01, ENT3-COACHING-UX-01, ENT3-SAML-02, ENT3-RBAC-UI-01, ENT3-SSO-ONBOARD-01 | 139 | Enterprise compliance |
| S67 | PARTNER-INT-01/02/03/04/05/06/07/08/09/10, PARTNER-LDAP-01/02, PARTNER-I18N-02, PARTNER-A11Y-01, PARTNER-MOTION-01, PARTNER-DIR-02, PARTNER-REVIEW-01, PARTNER-NOTIFY-01 | 128 | Integration configurator |
| S68 | PWA3-INBOX-01/02/03/04, PWA3-NOTIF-01/02/03, PWA3-BGSYNC-01/02/03/04, PWA3-SPLASH-01, PWA3-HAPTIC-01, PWA3-SHORTCUT-01, PWA3-WEARABLE-01, PWA3-A11Y-02, PWA3-I18N-02, PWA3-PERF-02, PWA3-WIDGET-01, PWA3-BIOMETRIC-01, PWA3-THEME-01 | 126 | Push + background sync UX |
| S69 | I18N3-AUDIT-01, I18N3-MOBILE-01/…, I18N3-PLURAL-01, I18N3-DATENUM-01, A11Y3-AUDIT-01, A11Y3-KEYBOARD-01, A11Y3-SCREEN-01, A11Y3-CONTRAST-01, A11Y3-MOTION-01, A11Y3-REFLOW-01, A11Y3-FOCUS-01, PERF3-BUDGET-01, PERF3-BUNDLE-01, QA3-REGRESSION-01, QA3-DESIGN-TOK-01, DOCS3-A11Y-01, DOCS3-I18N-01, DOCS3-MOBILE-01 | 123 | i18n + a11y completion |
| S70 | POLISH3-MOTION-01, POLISH3-EMPTY-01, POLISH3-SKELETON-01, POLISH3-ERROR-01, POLISH3-TOAST-01, POLISH3-ICON-01, POLISH3-FOCUS-RING-01, POLISH3-DARK-PREP-01, MKT3-HOME-01, MKT3-PRICING-01, MKT3-MOBILE-01, MKT3-PARTNER-LND-01, QA3-E2E-*, QA3-TYPE-01, QA3-I18N-FINAL-01, QA3-A11Y-FINAL-01, RC3-NOTES-01, RC3-SPEC-01, RC3-BACKLOG-01 | 134 | Release polish + final QA |

**Arc total: ~1,424 pts across 11 sprints**

---

## New i18n Namespace Summary

| File | Keys (est.) | First sprint | All 5 locales by |
|------|------------|-------------|-----------------|
| `mobile.json` | ~180 | S60 (EN) | S69 |
| `branding.json` | ~70 | S61 (EN) | S69 |
| `partner.json` | ~145 | S64 (EN) | S69 |
| `trust.json` | ~60 | S63 (EN) | S69 |
| `developer.json` | ~65 | S65 (EN) | S69 |
| `compliance.json` | ~80 | S66 (EN) | S69 |

_S69 is the designated i18n-complete sprint. Every sprint that ships EN keys for a new namespace must
add `TODO` stubs for NL/DE/FR/ES to keep CI green (`check:i18n` detects missing keys)._

---

## A11y Milestone Checkpoints

| Sprint | Milestone |
|--------|-----------|
| S60 | PWA3-A11Y-01: mobile touch + zoom + motion sweep ✓ |
| S61 | BRAND3-A11Y-01: brand configurator keyboard + contrast ✓ |
| S62 | ADMIN3-A11Y-01: all analytics charts accessible ✓ |
| S63 | TRUST3-A11Y-01: badges + tooltips keyboard ✓ |
| S64 | MOB3-A11Y-01: presenter controls mobile ✓ |
| S65 | DEVP-A11Y-01: developer portal ✓ |
| S66 | ENT3-COMP-A11Y-01: compliance dashboard ✓ |
| S67 | PARTNER-A11Y-01: integration configurator ✓ |
| S68 | PWA3-A11Y-02: notification inbox + sync ✓ |
| S69 | **Full axe-core + keyboard + screen reader audit** (A11Y3-*) |
| S70 | **QA3-A11Y-FINAL-01: v3.0 conformance statement** |

---

## Key Dependencies and Gates

| Gate | What it blocks | Sprint |
|------|---------------|--------|
| BRAND-01/02/03 APIs (✅ S36) | BRAND3-CONF-01 (brand configurator consumes APIs) | S61 |
| `MOBILE-PWA-02` SW v2 (✅ S41) | PWA3-SW-01, PWA3-PUSH-01/02 | S60 |
| `MOBILE-OFFLINE-SYNC-01` (✅ S41) | PWA3-OFFLINE-01/02, PWA3-BGSYNC-* | S60, S68 |
| `ADMIN-ANALYTICS-01` (✅ S24) + GAM-06 (✅ S35) | ADMIN3-DASH-* | S62 |
| `ANON-DEPTH-01` ZK API (planned S31) | TRUST3-ZK-* | S63 |
| `SCALE-PROOF-01` evidence (planned S32) | TRUST3-SCALE-03 (uses load-test data) | S63 |
| `GDPR-BADGE-01` (planned S34) | TRUST3-GDPR-01 additions | S63 |
| `AI-COACHING-MATURITY-01` (✅ S42) | ENT3-COACHING-UX-01 | S66 |
| `AUDIT-EXPORT-FORENSIC-01` (✅ S42) | ENT3-FORENSIC-01 UI | S66 |
| `OAUTH-app-registration` backend | DEVP-OAUTH-01 | S65 (backend must ship first) |
| `INT-PROVIDER-01` AES-GCM (✅ S31) | PARTNER-INT-* OAuth management | S67 |
| `LDAP-01/02` (✅ S38) | PARTNER-LDAP-01/02 UI | S67 |
| `ADR-0015` mobile ADR (✅ S37) | MOB3-PRES-* controls | S64 |
| `ADR3-PUSH-01` (new ADR needed) | PWA3-PUSH-* architecture | Before S68 |

_New ADR required: **ADR-0020 (PWA Push Notification Architecture)** — must be accepted before S68.
Scope: push service worker contract, subscription storage in USERS_KV, delivery through Durable Object,
GDPR consent requirements, opt-out guarantees._

---

## Deferred to S71+

The following v3.0 ideas were scoped out of S60–S70 to stay within capacity:

- **Native iOS / Android apps** — out of scope per SPRINT30_39_PLAN
- **Full dark mode** — POLISH3-DARK-PREP-01 lays tokens; full dark mode is S71+
- **Multi-region D1 routing UI** — backend infrastructure not ready
- **AI-generated session narration (audio)** — Workers AI TTS not production-ready
- **Wearable-native watch app** — PWA3-WEARABLE-01 covers minimal view only

---

_Owner: Frontend (qesto-frontend agent) | Review: Product Owner + Architect_
_Source truth: this file; link from BACKLOG_MASTER.md §Sprint60_70 when accepted_
