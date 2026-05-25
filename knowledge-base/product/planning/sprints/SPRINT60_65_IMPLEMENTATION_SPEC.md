---
id: SPRINT60_65_IMPLEMENTATION
type: planning
status: shipped-partial
created: 2026-05-25
---

# Sprint 60–65 — Implementation Record

## Shipped in this branch

| Sprint | Item | Implementation |
|--------|------|----------------|
| S60 | ADR-0025–0029 | Stub ADRs under `knowledge-base/adr/` |
| S60 | REPO-LAYER-01 | `functions/api/repositories/sessionRepository.ts` + shim |
| S60 | SEC-APIKEY-* | Revoke/rotate, scopes, shared `publicApiKeyMiddleware`, rate limit |
| S60 | API-PLAT-OPENAPI-01 | `openapi-v3-spec.ts` + `GET /api/v3/openapi.json` |
| S60 | OBS-COLO-01 | `x-qesto-colo` on WS upgrade; vote events include `colo:` detail |
| S60 | TRUST3-BADGE-01 | `src/components/TrustBadge.tsx` |
| S61 | SEC-JWT-ROTATE-01 | `JWT_SECRET_PREV`, `verifyJwtWithSecrets` |
| S62 | API v3 draft | `routes/public-api-v3.ts`, idempotency on POST sessions |
| S62 | WEBHOOK-DLQ | `lib/webhook-dlq.ts` |
| S62 | MR-WRITE-FOUNDATION | `lib/db-router.ts`, `GET /api/v3/residency` |
| S63 | WORKFLOW-ENGINE-01 | `lib/workflow-engine.ts`, `routes/workflows.ts` |
| S63 | PRIVACY-EXPORT-01 | `GET /api/users/me/data-export` |
| S64 | RESIDENCY-PROOF-01 | Residency proof payload on v3 |
| S64 | PARTNER-01 | `routes/partner-portal.ts` skeleton |
| S65 | API-PLAT-USAGE-METER-01 | `lib/api-usage.ts`, `GET /api/v3/usage` |
| S65 | COMPLIANCE-TYPE2-EVIDENCE-01 | `routes/compliance.ts` evidence-pack |

## Deferred (S66+ or ops-only)

- Full DO decomposition (`DO-SPLIT-01` energizer/broadcast engines)
- EU write sharding enablement (`MR-WRITE-GA`)
- Marketplace launch, federation, SCIM
- DevOps catalog (~1,434 pts pool) — committed slices only in master plan
- Marketing/i18n sprint packs (parallel tracks)
- AI copilot routes (`AI-COPILOT-*`) beyond workflow queue hook

## Verification

```bash
npm run typecheck
npm test
```
