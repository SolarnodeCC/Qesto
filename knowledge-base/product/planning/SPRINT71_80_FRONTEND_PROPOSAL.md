---
id: SPRINT71_80_FE_PROPOSAL
type: planning
domain: product
category: frontend
status: proposed
version: 1.0
created: 2026-05-27
author: qesto-frontend
tags:
  - planning
  - frontend
  - v4.1
  - v4.2
  - v5.0
  - dark-mode
  - zoom
  - developer-portal
relates_to:
  - SPRINT71_80_PLAN
  - SPRINT60_70_FRONTEND_PROPOSAL
  - ROADMAP_FULL
  - BACKLOG_MASTER
---

# Sprint 71–80 Frontend Proposal — Post-v4.0 Experience & Platform UX

_Prepared: 2026-05-27 — Frontend agent synthesis aligned to [`SPRINT71_80_PLAN.md`](./SPRINT71_80_PLAN.md), market pulse (May 2026), and S60–S70 §Deferred to S71+._

---

## Executive Summary

Ten sprints (**S71–S80**) of frontend work targeting **v4.1 → v4.2 → v5.0 GA**: dark mode GA, event integrator surfaces (Zoom), developer portal v2, federation/IdP UX, 100k scale trust UI, copilot multi-turn + edge UX, marketplace depth, audit/webhook consoles, realtime v3 client, AAA conformance path.

**Capacity:** **120–150 pts/sprint** across 3–4 parallel streams (A = Experience/Theme, B = Integrator/Dev, C = Enterprise/Trust, D = Live/Realtime).

---

## Foundation Assumptions (v4.0 shipped at S70)

| Shipped (S60–S70) | What exists entering S71 |
|-------------------|--------------------------|
| Trust badges, GDPR/SOC2 pages | `TrustBadge`, `GdprTrustPage`, `Soc2TrustPage` |
| Developer portal v1 | API keys, rate-limit hints |
| Federation skeleton | `FederationSettingsPage`, metadata routes |
| Realtime v2 negotiation | `live-session-protocol.ts`, client fallback |
| SLO admin panel | `SloDashboardPanel` |
| PWA inbox scaffold | `PwaInboxPanel` |
| Presenter remote (beta) | `PresenterRemotePage` |

Do not re-implement v4.0 surfaces; extend and GA them.

---

## New i18n Namespaces (S71–S80)

| Namespace | Owner sprint | Surface |
|-----------|--------------|---------|
| `appearance.json` | S71–S72 | Dark mode, contrast, high-contrast mode |
| `marketplace.json` | S71 extract / S77 ship | Plugin install, permissions, home |
| `zoom.json` | S72 | Embed, OAuth, sync status |
| `federation.json` | S74–S75 | SAML/SCIM consent, library picker |
| `audit.json` | S78 | Forensic query UI, export |
| `realtime.json` | S79 | v3 delta indicators, bandwidth hints |

Full key budget: [`I18N_SPRINT_71_80_PLAN.md`](../../I18N_SPRINT_71_80_PLAN.md).

---

## Sprint Summary Table

| Sprint | Pts (FE) | Theme | Release |
|--------|----------|-------|---------|
| S71 | ~42 | Dark mode tokens + core surfaces | v4.1-alpha |
| S72 | ~38 | Dark mode GA + Zoom embed UI | v4.1-alpha |
| S73 | ~26 | Dev portal v2 (OAS explorer + try-it) | v4.1 RC |
| S74 | ~21 | Federation consent + SAML/SCIM UI | v4.2-alpha |
| S75 | ~26 | Presenter remote + Q&A polish; scale counters | v4.2-alpha |
| S76 | ~13 | Marketplace install + permissions UX | v4.2 RC |
| S77 | ~21 | Marketplace home + MR region selector start | v5.0-alpha |
| S78 | ~34 | MR map + webhook replay + high contrast | v5.0-alpha |
| S79 | ~29 | Realtime v3 client + AAA audit surfaces | v5.0 RC |
| S80 | ~26 | AAA final audit + full regression UX gates | v5.0 GA |

_FE pts are the frontend slice only; full sprint load includes BE/SEC/QA per master plan._

---

## Sprint 71 — Dark Mode Foundation

**Goal:** Token layer (`prefers-color-scheme` + manual toggle), core shell + join + live participant surfaces.

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-DM-TOKEN-01` | Extend `design-tokens.json` dark palette; CSS variables in Tailwind theme | 8 | P0 |
| `FE-DM-SHELL-01` | App shell, nav, settings appearance panel | 8 | P0 |
| `FE-DM-JOIN-01` | Join flow + participant card contrast | 8 | P0 |
| `FE-DM-LIVE-01` | Live vote/question surfaces (not presenter charts yet) | 8 | P0 |
| `FE-DM-CI-01` | axe + contrast ratio CI job (warn < 4.5:1) | 5 | P0 |

**P0 parent:** `DARK-MODE-GA-01`.

---

## Sprint 72 — Dark Mode GA + Zoom

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-DM-FINAL-AUDIT-01` | Remaining surfaces (admin, marketing, insights) | 8 | P0 |
| `FE-DM-CI-02` | Block merge on axe violations in dark mode | 5 | P0 |
| `FE-ZOOM-EMBED-01` | In-meeting iframe host + loading/error states | 13 | P0 |
| `FE-ZOOM-OAUTH-01` | Connect Zoom account in team integrations | 8 | P0 |
| `FE-ZOOM-SYNC-01` | Sync status banner + reconnect | 5 | P1 |

---

## Sprint 73 — Developer Portal v2

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-DEV2-OAS-01` | OpenAPI explorer from published `openapi.json` | 13 | P0 |
| `FE-DEV2-TRY-02` | Try-it console with API key scope hints | 8 | P0 |
| `FE-DEV2-WH-01` | Webhook event log viewer (read-only v1) | 5 | P1 |

**Gate:** `openapi.json` published (master plan S73).

---

## Sprint 74 — Federation & Identity UI

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-FED-SAML-02` | SAML IdP config wizard + test login | 13 | P0 |
| `FE-FED-SCIM-01` | SCIM token rotate + group mapping table | 8 | P0 |
| `FEDERATION-CONSENT-UI-01` | Session library consent modal (shared w/ BE) | 8 | P0 |

---

## Sprint 75 — Scale Trust + Presenter Polish

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-PRES-REMOTE-01` | Presenter remote GA (keyboard shortcuts, reconnect) | 13 | P0 |
| `FE-PRES-QANDA-01` | Q&A moderation queue UX | 13 | P0 |
| `FE-SCALE-100K-01` | Public scale proof counter (`aria-live`, reduced-motion) | 5 | P0 |
| `FE-TRUST-RESIDENCY-01` | EU residency badge on join when pinned | 5 | P1 |

**Gate:** `check:compliance-claims` before enabling 100k counter on marketing pages.

---

## Sprint 76 — Marketplace Depth

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-MKTPL-INSTALL-01` | One-click install flow + permission preview | 8 | P0 |
| `FE-MKTPL-PERM-01` | Runtime permission audit panel | 5 | P0 |

---

## Sprint 77–78 — Platform Isolation & Forensics

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-MKTPL-HOME-01` | Marketplace home + categories | 8 | P0 |
| `FE-MREG-SEL-01` | Tenant home region selector (start) | 8 | S77 |
| `FE-MREG-MAP-01` | Region map + pinning status | 8 | S78 |
| `WEBHOOK-REPLAY-UI-01` | Webhook delivery replay + DLQ inspect | 13 | S78 |
| `FE-AAA-CONTRAST-01` | High contrast mode (WCAG AAA path) | 13 | S78 |

---

## Sprint 79–80 — Realtime v3 + AAA GA

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `REALTIME-V3-CLIENT-01` | Client delta handler + shadow mode toggle | 13 | S79 |
| `FE-AAA-AUDIT-01` | AAA partial audit (focus order, targets) | 8 | S79 |
| `FE-AAA-FINAL-AUDIT-01` | Full AAA conformance report + fixes | 13 | S80 |
| `QA-E2E-FULL-REGRESSION-01` | E2E suite green (paired w/ QA) | 13 | S80 |

**Gate:** Staging WebSocket smoke mandatory before realtime v3 default (S79).

---

## A11y Requirements (S71–S80)

| Surface | Gate |
|---------|------|
| Dark mode | 4.5:1 body text; 3:1 large text; CI blocks regressions S72+ |
| Zoom embed | Focus trap in modal; iframe `title`; keyboard exit |
| OAS explorer | Code blocks with copy button + `aria-label`; skip link |
| Scale counters | `aria-live="polite"`; static fallback with `prefers-reduced-motion` |
| High contrast | System + manual; does not break brand white-label |
| Realtime v3 | Announce reconnect state; no layout shift on delta apply |

---

## Deferred to S81+

- App Store / Play Store submission (Capacitor shell only in S73 per ADR-0042)
- Full `results_delta` on all chart types (wire in S76; UI complete S79)
- Marketplace payout UI (Stripe Connect)

---

## Cross-References

- Master plan: [`SPRINT71_80_PLAN.md`](./SPRINT71_80_PLAN.md)
- Prior arc: [`SPRINT60_70_FRONTEND_PROPOSAL.md`](./SPRINT60_70_FRONTEND_PROPOSAL.md)
- Marketing copy gates: [`MARKETING_SPRINTS_71_80.md`](../marketing/MARKETING_SPRINTS_71_80.md)
