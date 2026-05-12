---
id: ARCHITECTURE
type: guide
domain: architecture
category: system-design
status: active
version: 1.5
created: 2026-03-01
updated: 2026-05-11
audience:
  - Architect
  - Tech lead
  - All roles
tags:
  - system-design
  - cloudflare-workers
  - architecture
  - tech-stack
  - constraints
relates_to:
  - SPEC_CORE
  - ADR-0001-do-per-session
---

# Qesto — Architecture (Current)

_Hub: [Documentation map](./README.md)._

_Last verified: 2026-04-30 (UTC)_

## 1. Runtime architecture
- **Frontend**: React + Vite.
- **API**: Hono on Cloudflare Pages Functions (`functions/api/[[route]].ts`).
- **Realtime**: Durable Object `SessionRoom`.
- **Worker utilities**: `worker/` for backup/restore/tail.

## 2. Data architecture
- **D1**: primary relational source (sessions, billing, events).
- **KV namespaces**: users/sessions/teams/templates/decisions/audit/actions.
- **DO Storage**: hot session state during live operations.
- **Vectorize**: two indexes —
  - `DECISIONS_VECTORIZE` (768-d cosine): post-session decision similarity.
  - `KB_VECTORIZE` (768-d cosine, ADR-040): semantic search over `knowledge-base/`
    docs. Index is mirrored by `kb_documents` + `kb_chunks` in D1; chunk text
    lives in D1 only (Vectorize metadata kept under 1 KB per vector). Query
    pipeline in `services/kbSearchService.ts`.

## 3. Status mapping
- D1/KV: `draft | active | closed | archived`
- DO: `waiting | active | results | closed`

## 4. Implemented technical strengths
- Route modularization in `functions/api/routes/*`.
- Middleware for plan/auth/observability/security headers.
- Dedicated integrations for Stripe, Slack, SSO, referral, MCP.
- Broad automated test suite (unit/integration/websocket/load/security).
- UI design system: motion choreography tokens, skeleton/empty/error state parity across async surfaces, Inter typography, prefers-reduced-motion support.

## 5. Risks to actively manage
- Large files still centralize complex flows (`SessionRoom`, sessions route module).
- Operational observability maturity is improving but still requires production dashboards and SLO enforcement.
- Remaining feature drift risk between docs and sprint closure evidence — partially mitigated by 2026-04-22 sync (ROADMAP_FULL.md, BACKLOG.md, SPRINT_PLAN.md, SPEC.md updated).

## 6. 2026-04-06 architecture review addendum
- Route-module extraction increased dependency sensitivity: helper/service imports in `sessions.routes.ts` are now a critical integrity point for API correctness.
- Existing architecture remains production-capable; near-term risk is regressions from refactors in oversized modules rather than platform limitations.

## 7. Where to go next
- **[`README.md`](./README.md)** — how `docs/` fits together (truth hierarchy, reading order).
- **[`spec/INDEX.md`](../specifications/SPEC_INDEX.md)** — domain specifications for implementation detail.

## 8. 2026-04-22 architecture review addendum
- UI layer now has a formalised design-token source of truth (`docs/spec/design-tokens.json` → `src/ui/tokens.ts`; token generator CI step in progress per DESIGN-TOK-01).
- Skeleton/empty/error parity enforced via `SkeletonLoader.tsx` (SessionListSkeleton, InsightsTabSkeleton, WizardAIGenerationSkeleton, LaunchpadPreFlightSkeleton, ResultsSectionSkeleton).
- Motion system: CSS custom-property tokens (`--duration-*`, `--ease-*`) with `@keyframes` in `styles.css`; global `prefers-reduced-motion` override ensures accessibility compliance.

## 9. 2026-04-30 Sprint 19 architecture addendum
- DRAFT session AI generation is exposed through `/api/sessions/:id/ai/generate` as an SSE route on the sessions API module. The stream emits an immediate readiness event, then a validated question payload, without mutating LIVE Durable Object state.
- AI provenance lives on the D1 `sessions` row (`ai_generated`, `ai_consent_at`, `ai_grounding_hash`) and is checked by `/api/sessions/:id/preflight`.
- Launchpad now treats backend preflight as the single source of truth for DRAFT→LIVE readiness; frontend checks are a temporary fallback while the request loads.
- User density preference is stored in `USERS_KV` and hydrated by the dashboard UI.
