---
id: SPRINT66_70_IMPLEMENTATION
type: planning
status: shipped-partial
created: 2026-05-25
---

# Sprint 66–70 — Implementation Record

## Shipped

| Sprint | Item | Implementation |
|--------|------|----------------|
| S66 | ADR-0030, SLO | `lib/slo.ts`, `GET /api/admin/platform/slo`, `SloDashboardPanel` |
| S66 | SEC-API-ABUSE-01 | `lib/api-abuse.ts` in `publicApiKeyMiddleware` |
| S66 | CUSTOM-WORKFLOW-TEMPLATES | `lib/workflow-templates.ts`, `GET /api/workflows/templates` |
| S66 | MARKETPLACE-LAUNCH | `POST /api/marketplace/apps/:id/install` |
| S66 | MOBILE-PRESENTER-REMOTE | `/sessions/:id/remote` page |
| S67 | ADR-0031, REALTIME-V2 | Protocol v2 negotiation, `REALTIME_V2_*` env |
| S67 | FEDERATION-01 | `lib/federation.ts`, `/api/federation/*` |
| S67 | SCIM-SUPPORT-01 | `/api/scim/v2/Users` (SCIM_BEARER_TOKEN) |
| S67 | AI-COACH-AGENT-01 | `/api/agent/coach/live/:sessionId` |
| S68 | ADR-0032, TENANT-QUOTA | `lib/tenant-quota.ts` on public API auth |
| S68 | SEC-JOIN-CAPTCHA | `lib/join-captcha.ts` on by-code join |
| S68 | CUSTOM-ACTION-PLUGIN-SDK | `/api/custom-actions` |
| S68 | MR-WRITE EU cohort | `MR_WRITE_EU_COHORT` in `db-router` |
| S69 | Platform RC | `/api/platform/version`, `releases`, `migration/v3`, `scale-proof` |
| S69 | Audits | `GET /api/admin/platform/audits` |
| S70 | API v1 sunset headers | Deprecation/Sunset on `/api/v1` |
| S70 | DR readiness | `GET /api/platform/dr-readiness` |
| S70 | Type II audit-ready | `GET /api/admin/compliance/type2/audit-ready` |

## Deferred

- Full `results_delta` broadcast implementation in SessionRoom
- External pentest PDF uploads, LDAP audit execution
- PWA background-sync service worker (UI placeholder only)
- 50k load test artifacts (synthetic metadata only)
- Federation write scopes in production enablement

## Verification

```bash
npm run typecheck && npm test
```
