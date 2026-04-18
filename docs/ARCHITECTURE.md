# Qesto — Architecture (Current)

_Last verified: 2026-04-06 (UTC)_

## 1. Runtime architecture
- **Frontend**: React + Vite.
- **API**: Hono on Cloudflare Pages Functions (`functions/api/[[route]].ts`).
- **Realtime**: Durable Object `SessionRoom`.
- **Worker utilities**: `worker/` for backup/restore/tail.

## 2. Data architecture
- **D1**: primary relational source (sessions, billing, events).
- **KV namespaces**: users/sessions/teams/templates/decisions/audit/actions.
- **DO Storage**: hot session state during live operations.
- **Vectorize**: semantic search for decisions.

## 3. Status mapping
- D1/KV: `draft | active | closed | archived`
- DO: `waiting | active | results | closed`

## 4. Implemented technical strengths
- Route modularization in `functions/api/routes/*`.
- Middleware for plan/auth/observability/security headers.
- Dedicated integrations for Stripe, Slack, SSO, referral, MCP.
- Broad automated test suite (unit/integration/websocket/load/security).

## 5. Risks to actively manage
- Large files still centralize complex flows (`SessionRoom`, sessions route module).
- Operational observability maturity is improving but still requires production dashboards and SLO enforcement.
- Remaining feature drift risk between docs and sprint closure evidence.

## 6. 2026-04-06 architecture review addendum
- Route-module extraction increased dependency sensitivity: helper/service imports in `sessions.routes.ts` are now a critical integrity point for API correctness.
- Existing architecture remains production-capable; near-term risk is regressions from refactors in oversized modules rather than platform limitations.
