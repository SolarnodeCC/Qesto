---
id: PLAN
type: planning
status: active
version: 1.0
created: 2026-05-22
---

# Sprint 33 Implementation Spec — v2.3 Integrations + AI Context

**Branch:** `feat/sprint-33-v23-integrations`  
**Window:** 2026-07-08 → 2026-07-22

## Committed scope

| ID | Status | Notes |
|---|---|---|
| SLACK-01 | Shipped (prior + redirect fix) | OAuth, encrypted token, session-close notify |
| SLACK-02 | Shipped | `PATCH /api/integrations/slack/preferences`, Team Settings UI |
| TEAMS-01 | Shipped (backend) | OAuth PKCE, adaptive card on close, `POST /teams/config` |
| WEBHOOK-01 | Shipped + SSRF | CRUD, HMAC, retry, delivery log, `validateWebhookTargetUrl` |
| AI-CONTEXT-01 | Shipped | `functions/api/lib/ai/session-context.ts` + unit tests |
| ADR-0011 | Shipped | `knowledge-base/adr/ADR-0011-live-sentiment-inference.md` |
| OBS-WS-VOTER-01 | Shipped | `ws.voter_joined` / `ws.voter_disconnected` in SessionRoom |
| OBS-INTEGRATION-01 | Shipped | `integration.connected`, `export.initiated` / `export.completed` |
| DEVOPS-INT-SECRETS-01 | Doc | `INTEGRATION_SECRETS_PROVISIONING.md` |
| I18N-SPRINT33-01 | Partial | Teams strings in `team.json` (5 locales) |

## Quality gates

```bash
npm run typecheck
npm run check:i18n
npm test
```

Staging: Slack + Teams OAuth round-trip; webhook RFC1918 URL rejected on create.

## Stretch (not started)

- ZOOM-01, EXPORT-PDF-01 (beyond existing HTML export), COMPLIANCE-01 scaffolding

## Sprint 34 dependency

- `AI-SENTIMENT-01` requires ADR-0011 (accepted) + `AI-CONTEXT-01` (merged).
