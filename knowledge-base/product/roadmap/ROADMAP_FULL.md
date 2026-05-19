---
id: ROADMAP
type: planning
domain: product
category: strategy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - roadmap
  - planning
  - strategy
  - releases
relates_to:
  - SPEC_PRODUCT
  - BACKLOG_MASTER
---

# Qesto — Roadmap & Release Status (Current)

_Hub: [Documentation map](./README.md)._

_Last updated: 2026-05-05 (UTC)_

## Release status
- **v2.0.0 (current)**: shipped core realtime sessions, auth, billing foundations, AI-assisted flows, i18n baseline, and broad automated testing.
- **v2.1 (target)**: stabilization + entitlement enforcement + enterprise/compliance readiness + translation QA hardening.
- **v2.2 (target)**: template catalogue polish, Launchpad/design polish, advanced gamification depth, and admin analytics maturity.

## Epic status summary
-  **Core Session Platform** (session lifecycle, realtime voting, presenter controls)
-  **Billing + Plan foundations** (Stripe integration + plan middleware)
-  **Authentication** (magic link + SAML)
-  **Enterprise operations** (audit and role granularity still finishing)
-  **Internationalization QA** (locale bundles done; validation hardening ongoing)
-  **Gamification expansion** (base energizers done; advanced scenarios queued)

## Next planning milestones

### Sprint 20 — Readiness + Entitlement Enforcement + Measurement (built; verification gate)
**Focus:** Stabilize v2.1 before the next feature expansion: plan entitlement coverage, Sprint 19 KPI measurement, observability evidence, and trustworthy local/CI quality gates.

**Key items:**
| Item | Status |
|---|---|
| ENTITLEMENTS-01 Pricing claim → backend gate matrix | ✅ Shipped 2026-05-01 |
| ENTITLEMENTS-02 Contract tests for paid capabilities | ✅ Built 2026-05-04 |
| OBS-02 Sprint 19 operational evidence | ✅ Shipped 2026-05-01 |
| QA-DOCDRIFT-01 Align docs with package scripts/test counts | ✅ Shipped 2026-05-01 |
| DESIGN-GATE-01 Stabilize token drift check locally and in CI | ✅ Shipped 2026-05-01 |
| S19-MEASURE-01 AI wizard + Launchpad KPI baseline | ✅ Completed with durable events 2026-05-04 |
| AUTHZ-ADR-01 Custom RBAC authorization ADR | Proposed for Sprint 20 review |
| Sprint A verification bundle | Verification gate active |

**Gate:** RBAC depth/custom roles require `ADR-0004` acceptance by Product Owner + Architect; LIVE energizers require a Durable Object protocol/versioning ADR.

### Sprint 21 — Enterprise Authorization + Compliance UX (✅ Shipped 2026-05-04)
**Focus:** Turn the Sprint 20 entitlement evidence into an authorization design the team can safely extend. This is the first sprint where RBAC depth can move, but only after the ADR is accepted.

**Key items:**
| Item | Status |
|---|---|
| AUTHZ-ADR-01 Custom RBAC authorization ADR | ✅ Accepted 2026-05-04 |
| AUTHZ-RBAC-01 Custom role permission matrix + server-side enforcement plan | ✅ Shipped 2026-05-04 |
| AUTHZ-RBAC-02 Admin role-management UX and delegated permissions | ✅ Shipped 2026-05-04 (backend API; frontend UI deferred) |
| ENT-03/ENT-04 compliance UX follow-through from audit/admin evidence | ✅ Shipped 2026-05-04 |

**Quality:** 16 integration tests; 0 TypeScript errors; audit trail ✅

### Sprint 22 — Template Catalogue + Session Creation Polish (✅ Shipped 2026-05-04)
**Focus:** Pull forward the next functional requirement from `SPEC.md`: make templates a complete session-starting surface instead of a passive dashboard tab.

**Key items:**
| Item | Status |
|---|---|
| TPL-CATALOG-01 Customer vs Qesto template groups | ✅ Shipped 2026-05-04 |
| TPL-CATALOG-02 Template overview confirmation flow | ✅ Shipped 2026-05-04 |
| TPL-CATALOG-03 Minimum 3 Qesto templates per required topic + functional coverage | ✅ Shipped 2026-05-04 |
| Wizard seeding from selected template into the customize step | ✅ Shipped 2026-05-04 |

**Quality:** 14 tests; i18n validated ✅

### Sprint 23 — Launchpad + Design Polish (✅ Shipped 2026-05-04)
**Focus:** Complete Website Design Wave Sprint C after Sprint 19 measurement proves the wizard → Launchpad path is reliable.

**Key items:**
| Item | Status |
|---|---|
| LAUNCHPAD-02 Inline editor, reorder, and state-preserving back-to-questions flow | ✅ Shipped 2026-05-04 |
| DESIGN-POLISH-01 Primary CTA hover/motion polish | ✅ Shipped 2026-05-04 |
| DESIGN-POLISH-02 Logo optical weight + sparkle mark | ✅ Shipped 2026-05-04 |
| AI-VIS-01 Landing AI narrative + copy/i18n sign-off | ✅ Shipped 2026-05-04 |

**Quality:** 3 polish contract tests; 644 full suite; 38 a11y; token drift ✅

### Sprint 24 — v2.2 Realtime Governance + Admin Hardening (✅ Shipped 2026-05-18)
**Focus:** Start v2.2 depth work with protocol governance first, then controlled LIVE energizer and analytics expansion.

**Key items:**
| Item | Status |
|---|---|
| DO-PROTOCOL-ADR-01 Durable Object protocol/versioning ADR | ✅ Shipped 2026-05-18 via `ADR-0005` |
| AUTHZ-ROLE-UI-01 Custom role-management UI | ✅ Shipped 2026-05-18 (Spring 21 integration) |
| ADMIN-ANALYTICS-01 Admin reporting/export maturity | ✅ Shipped 2026-05-18 |
| Legacy backlog status reconciliation for v2.x regression contracts | ✅ Shipped 2026-05-18 |
| GAM-01 LIVE energizer foundation behind versioned message contracts | ✅ Shipped 2026-05-18 |

**Quality:** 717 tests; TypeScript 0 errors; 4px baseline ✅

### Sprint 25 — LIVE Energizer Protocol Foundation (✅ Shipped 2026-05-19)
**Focus:** Use the accepted Sprint 24 protocol contract to add the first dark-launched LIVE energizer WebSocket foundation.

**Key items:**
| Item | Status |
|---|---|
| GAM-LIVE-01 Presenter-only `energizer_activate` frame | ✅ Shipped 2026-05-19 |
| GAM-LIVE-FLAG-01 `LIVE_ENERGIZERS_ENABLED` rollout guard | ✅ Shipped 2026-05-19 |
| GAM-LIVE-RECONNECT-01 active energizer state in `init` snapshots | ✅ Shipped 2026-05-19 |

**Quality:** 46 tests; v1 protocol versioned ✅

### Sprint 26-32 — v2.2 Live Engagement to Enterprise Release (Sprints 26-29 ✅ Shipped, 30-32 active)
**Focus:** Turn the Sprint 25 dark-launched protocol into staged gameplay, then mature scoring, badges, admin analytics, enterprise permissions, and release readiness.

| Sprint | Goal | Status |
|---|---|---|
| Sprint 26 | LIVE energizer activation readiness and staging WebSocket smoke | ✅ Shipped 2026-05-19: presenter activation, flag-off/on guards, reconnect state |
| Sprint 27 | First playable LIVE energizer: Quick Finger | ✅ Shipped 2026-05-19: participant answers, DO validation, score broadcast, reconnect-safe state |
| Sprint 28 | Team Quiz LIVE loop | ✅ Shipped 2026-05-19: quiz progression, locked submissions, score summary, reconnect state |
| Sprint 29 | Leaderboard + badge foundation | ✅ Shipped 2026-05-19: bounded leaderboard, deterministic badge hooks, idempotency tests |
| Sprint 30 | Admin engagement analytics maturity | Active: No release-candidate posture until support/admin dashboards are useful |
| Sprint 31 | Enterprise rollout hardening | Planned: No broad rollout until permission-deny and audit paths are clear |
| Sprint 32 | v2.2 release candidate | Planned: Release only after full-stack smoke and staging WebSocket validation |

**Plan:** See [`SPRINT26_32_PLAN.md`](../planning/SPRINT26_32_PLAN.md).

### Post-v2.2 Commercial Promise Completion

**Focus:** Keep go-live copy honest while sequencing the higher-value promises that were removed or marked roadmap during the marketing promise audit.

| Item | Status |
|---|---|
| MKT-PROMISE-01 Launch-safe marketing promise audit and copy correction | ✅ Implemented 2026-05-05; public pages now avoid unsupported compliance, export, integration, latency, and AI provenance claims |
| EXPORT-RICH-01 Rich export formats | Future: JSON, signed PDF, DOCX, and Notion-ready exports need backend routes, UI, tests, and plan gates |
| INT-WEBHOOK-01 Webhook/integration suite | Future: Slack, Notion, Workday, BambooHR, and generic webhooks need auth, retries, audit logs, and failure handling |
| ENT-COMPLIANCE-01 Compliance evidence packet | Future: SOC 2, penetration-test summary, DPA/SCC packet, and sub-processor evidence must exist before procurement claims go live |
| ENT-RESIDENCY-01 Residency and customer-managed keys | Future: residency guarantees and CMK support need design, operations, and tests before marketing promotion |
| AI-RECAP-PROV-01 AI recap evidence/edit provenance | Future: evidence-linked summaries, edit history, and export provenance need implementation before public AI recap claims return |
| PERF-PROOF-01 Production latency evidence | Future: Cloudflare-backed benchmark data required before numeric latency claims return |

**Gate:** Any claim moved from roadmap to public launch copy must have a matching implementation path, tests, and documentation evidence in the same PR.

### Sprint A — Layout + Token Foundation (mostly shipped; verify in Sprint 20)
**Focus:** Design-token source of truth, layout primitives, a11y baseline, i18n bug fixes.

**Key items (P0 first):**
| Item | Status |
|---|---|
| DESIGN-TYP-01 Typography refresh (Inter body) | ✅ Shipped 2026-04-21 |
| LAYOUT-SKELETON-01 Skeleton/empty/error state parity | ✅ Shipped 2026-04-21 |
| LAYOUT-MOTION-01 Motion choreography tokens | ✅ Shipped 2026-04-21 |
| LAYOUT-GRID-01 Responsive 12/8/4-column grid primitive | Verify/close in Sprint 20 |
| LAYOUT-A11Y-01 Landmark regions, skip-link, WCAG 2.2 focus | Verify/close in Sprint 20 |
| DESIGN-TOK-01 Design-token source-of-truth → src/ui/tokens.ts | Verify/close in Sprint 20 |
| AI-VIS-03 `<AIBadge>` primitive + sparkle icon | ✅ Shipped 2026-04-30 |
| DX-INSIGHTS-01 Dashboard Insights tab scaffold | Verify/close in Sprint 20 |
| I18N-BUG-01 Fix missing wizard step4 keys across 5 locales | Verify/close in Sprint 20 |
| I18N-BUG-02 Fix Dutch/English mixing on Launchpad | Verify/close in Sprint 20 |

### Sprint B — Narrative + Wizard + Launchpad + Density (implementation complete except marketing narrative)
✅ AI-VIS-02, ✅ DX-INSIGHTS-02, ✅ WIZ-AI-01, ✅ WIZ-AI-02, ✅ WIZ-OVERVIEW-01, ✅ LAUNCHPAD-01, ✅ LAYOUT-DENSITY-01 shipped 2026-04-30. AI-VIS-01 remains marketing/copy scope.

**Gate:** Sprint 20 must measure AI wizard and Launchpad reliability before further Launchpad expansion.

### Sprint C — Polish (planned after Sprint 20 readiness)
DESIGN-POLISH-01, DESIGN-POLISH-02, LAUNCHPAD-02.

**Gate:** Brand sign-off on logo; 0 a11y regressions; Sprint 19 KPI baseline acceptable.

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
