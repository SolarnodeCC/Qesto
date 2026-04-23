# Qesto — Roadmap & Release Status (Current)

_Hub: [Documentation map](./README.md)._

_Last updated: 2026-04-22 (UTC)_

## Release status
- **v2.0.0 (current)**: shipped core realtime sessions, auth, billing foundations, AI-assisted flows, i18n baseline, and broad automated testing.
- **v2.1 (target)**: stabilization + enterprise/compliance completion + translation QA hardening.
- **v2.2 (target)**: advanced gamification depth and admin analytics maturity.

## Epic status summary
-  **Core Session Platform** (session lifecycle, realtime voting, presenter controls)
-  **Billing + Plan foundations** (Stripe integration + plan middleware)
-  **Authentication** (magic link + SAML)
-  **Enterprise operations** (audit and role granularity still finishing)
-  **Internationalization QA** (locale bundles done; validation hardening ongoing)
-  **Gamification expansion** (base energizers done; advanced scenarios queued)

## Next planning milestones

### Sprint A — Layout + Token Foundation (active)
**Focus:** Design-token source of truth, layout primitives, a11y baseline, i18n bug fixes.

**Key items (P0 first):**
| Item | Status |
|---|---|
| DESIGN-TYP-01 Typography refresh (Inter body) | ✅ Shipped 2026-04-21 |
| LAYOUT-SKELETON-01 Skeleton/empty/error state parity | ✅ Shipped 2026-04-21 |
| LAYOUT-MOTION-01 Motion choreography tokens | ✅ Shipped 2026-04-21 |
| LAYOUT-GRID-01 Responsive 12/8/4-column grid primitive | In progress |
| LAYOUT-A11Y-01 Landmark regions, skip-link, WCAG 2.2 focus | In progress |
| DESIGN-TOK-01 Design-token source-of-truth → src/ui/tokens.ts | In progress |
| AI-VIS-03 `<AIBadge>` primitive + sparkle icon | Queued |
| DX-INSIGHTS-01 Dashboard Insights tab scaffold | Queued |
| I18N-BUG-01 Fix missing wizard step4 keys across 5 locales | Queued |
| I18N-BUG-02 Fix Dutch/English mixing on Launchpad | Queued |

### Sprint B — Narrative + Wizard + Launchpad + Density (next)
AI-VIS-01, AI-VIS-02, DX-INSIGHTS-02, WIZ-AI-01, WIZ-AI-02, WIZ-OVERVIEW-01, LAUNCHPAD-01, LAYOUT-DENSITY-01, LAYOUT-MOTION-01, DESIGN-TYP-01.

**Gate:** LAUNCHPAD-01 requires WIZ-OVERVIEW-01 (commits DRAFT, routes to Launchpad).

### Sprint C — Polish (planned)
DESIGN-POLISH-01, DESIGN-POLISH-02, LAUNCHPAD-02.

**Gate:** Brand sign-off on logo; 0 a11y regressions.

### Parallel feature work (shipped since 2026-04-19)
- Dashboard personalised greeting (replaces "Your sessions" heading)
- Active plan badge visible on dashboard
- Teams and Templates tabs added to dashboard tab bar
- Search + status filter on Draft & live session list
- Admin panel button for superuser role; `/admin` route guarded
- Language switcher added to header on all pages
- End-to-end session join flow: QR code scanning, join bar, polished voter UX
- Six experience-improvement recommendations implemented
- Marketing solution pages narrative expanded (education, business, enterprise)
