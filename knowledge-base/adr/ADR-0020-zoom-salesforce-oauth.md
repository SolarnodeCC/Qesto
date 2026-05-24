---
id: ADR-0020
status: accepted
date: 2026-05-23
---

# ADR-0020 — Zoom & Salesforce OAuth Token Lifecycle

## Context

Sprint 35 shipped OAuth skeletons; Sprint 40 completes token exchange, refresh, and session-close delivery.

## Decision

1. **Redirect URIs** use `API_URL` (Worker origin), not `PAGES_URL`.
2. **Token storage** reuses `EncryptedTokenStore` (`integration:token:{teamId}:{service}`).
3. **Config blobs** separate from tokens:
   - `integration:config:{teamId}:zoom`
   - `integration:config:{teamId}:salesforce` (includes `instanceUrl`)
4. **Callbacks** are unauthenticated (HMAC-signed `state` only), matching Slack/Teams.
5. **Salesforce delivery** creates a `Note` via REST v59.0 on session close (best-effort `waitUntil`).
6. **Zoom delivery** posts to Zoom Chat API when connected; failures are logged, not surfaced to participants.

## Consequences

- Requires `ZOOM_CLIENT_SECRET`, `SALESFORCE_CLIENT_SECRET`, `OAUTH_TOKEN_MEK` in production.
- Marketing may claim “Enterprise integrations” only after staging round-trip tests pass.
