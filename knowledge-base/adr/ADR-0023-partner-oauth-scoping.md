---
id: ADR-0023
status: accepted
date: 2026-05-24
---

# ADR-0023 — Partner OAuth App Scoping

## Decision

1. Partner apps register per team in `INTEGRATIONS_KV` (`partner:app:{id}`).
2. Scopes: `read_sessions`, `write_sessions` (v2 API), `webhooks` (future).
3. Workday/Jira/Mattermost status routes upgrade from skeleton when `store.getToken(teamId, partner)` succeeds.
4. Secrets rotate via partner dashboard (S54+); never returned after create.

## Consequences

- Public API v2 session create requires API key with `write` scope (future enforcement).
