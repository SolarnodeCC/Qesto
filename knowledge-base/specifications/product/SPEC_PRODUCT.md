---
id: SPEC-PRODUCT
type: specification
domain: product
category: features
status: active
version: 1.5
created: 2026-04-01
updated: 2026-05-11
audience:
  - Product owner
  - Architect
  - Feature lead
tags:
  - product-requirements
  - features
  - session-lifecycle
  - question-types
  - ai-insights
  - realtime-tallies
  - privacy
relates_to:
  - SPEC_CORE
  - SPEC_FRONTEND
  - SPEC_BACKEND
  - ROADMAP_FULL
---

# Qesto — Product Specification (Current)

_Hub: [Documentation map](../README.md)._

_Last verified: 2026-04-30 (UTC)_

## 1. Product lifecycle
- **DRAFT**: session setup and question curation.
- **LIVE**: participants can join and vote in real time.
- **CLOSED**: interaction stopped; results and recap remain available.
- **ARCHIVED**: historical/compliance state.

## 2. Roles
- **Owner/Presenter**: creates, starts, moderates, reveals, closes.
- **Voter**: joins via code/link and submits responses.
- **Team roles**: owner/member/viewer with admin constraints in team routes.

## 3. Supported question types
- `multiple_choice`
- `scale`
- `open`
- `ranking`
  - Uses the same counting/aggregation logic as `multiple_choice`.
  - Each ranking ballot contributes its top-ranked option to live/final aggregated counts.
  - When presenting results, options are automatically ordered from highest to lowest score/count (large to small).
- `points`
- `consent`
- `multi_select`
- `likert`
- `slider`
- `upvote`
- `word_cloud`

## 4. Implemented platform capabilities
- Realtime voting lifecycle with Durable Object session state.
- Team and template management routes.
- Auth via magic link + SAML.
- Billing and Stripe webhook processing.
- AI-assisted flows (question suggestion, recap, insights).
- i18n locale bundles for NL/EN/ES/DE/FR.
- Energizer component set (Balloon Pop, Emoji Pulse, Tug of War, Find Your Match, etc.).
- Public Solutions pages (`/business`, `/education`, `/enterprise`) use in-repo AI illustrations under `public/images/solutions/*` (no third-party image dependencies).
- Dashboard UX: personalised greeting, active plan badge, Teams/Templates tabs, session search + status filter, admin panel gating.
- Session join flow: QR code scanning, join bar, polished voter experience, language switcher on all pages.

## 5. Template library UX (next functional requirement)
- Dashboard **Templates** area is split into two groups:
  - **Customer templates** (tenant/user-created templates).
  - **Qesto templates** (curated default templates delivered by Qesto).
- Qesto template catalogue should expose **3–4 templates per topic/category** so users can quickly pick a relevant starting point.
- Template selection flow:
  1. User opens a template card from either group.
  2. User sees a template overview screen with:
     - **title**
     - **description**
     - **picture/preview image**
  3. User explicitly confirms via a CTA (e.g. “Use template”).
  4. After confirmation, app starts the **new session workflow** at the adjust/customize step so the user can edit questions/settings before launch.
- UX acceptance criteria:
  - No direct session creation without confirmation from the overview screen.
  - Overview must contain enough context (title/description/image) to judge fit before continuing.
  - Selected template is carried into the wizard state as the initial configuration seed.

- For each topic, Qesto provides **minimum 3** starter templates (preferred target: 4+ for popular topics).
- Full completion of advanced enterprise role granularity.
- Extended admin/compliance UX (beyond API-level support).
- Finalized translation QA and stricter CI quality gates.

## 6. 2026-04-06 review notes
- Session creation, analytics/export, and GDPR respondent-erasure flows are implemented through `sessions.routes.ts` and rely on shared route helpers + DO proxying.
- Speed Round generation is part of the session API surface and uses Workers AI with JSON sanitation and per-session rate limiting.
- Wizard step-2 validity now explicitly requires at least two options for multiple-choice questions (manual/AI), and tests were aligned with that contract.

See: [`README.md`](../README.md) (documentation map), `ROADMAP_FULL.md`, `BACKLOG.md`, `SPRINT_PLAN.md`.
### 5.4 Test-set coverage (required)
- Functional UI test coverage includes a dedicated template-catalogue check for:
  - required topic IDs in the Dashboard filter list;
  - **minimum 3 templates per topic**;
  - UI copy alignment with the minimum-3 requirement.
- Reference test file: `tests/functional/ui/template-catalogue.test.ts`.

## 7. 2026-04-22 review notes
- Dashboard UI matured: personalised greeting (replacing "Your sessions"), active plan badge, Teams/Templates tab bar, session search + status filter.
- Session join flow end-to-end: QR code scanning, join bar, polished voter UX with anonymous/named modes.
- Motion choreography and skeleton states shipped across all async surfaces (LAYOUT-MOTION-01, LAYOUT-SKELETON-01).
- Typography updated to Inter body font with preload (DESIGN-TYP-01).
- Language switcher surfaced in header on all pages (i18n UX improvement).
- Admin panel gated on superuser role; `/admin` route guarded.

## 8. 2026-04-30 Sprint 19 closeout notes
- AI wizard generation uses `POST /api/sessions/:id/ai/generate` as an SSE stream (`ready`, `questions`, `done`), with `/api/sessions/:id/ai/refine` for grounding-hash based refinement.
- Wizard-generated sessions persist AI provenance on the DRAFT session: `ai_generated`, `ai_consent_at`, and `ai_grounding_hash`.
- Launchpad uses `GET /api/sessions/:id/preflight` as the canonical readiness gate before `Open lobby`.
- Density preference is persisted in `USERS_KV` and applied to three Dashboard list surfaces: sessions, Insights, and Teams.

