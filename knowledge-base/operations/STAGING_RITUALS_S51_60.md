# Staging Rituals — Sprints 51–60

Run after merging to staging (`qesto` Pages + Workers). Sign off in [`SPRINT51_60_DOD_CHECKLIST.md`](../product/planning/SPRINT51_60_DOD_CHECKLIST.md).

## 1. CI gate (pre-merge)

```bash
npm ci
npm run check:rc
npm run check:compliance-claims
```

## 2. Multi-region failover (S51–S52)

1. Set `MULTI_REGION_ENABLED=true`, `MULTI_REGION_STATE_KV` bound on staging.
2. `GET /api/admin/health` — confirm `writeRegion`, `failoverActive`.
3. `POST /api/admin/multi-region/failover` (admin JWT) — activate failover.
4. Create + close a session — verify `multi_region.write_routed` in AE.
5. `DELETE /api/admin/multi-region/failover` — rollback.
6. Complete [`MULTI_REGION_DRILL_CHECKLIST.md`](./MULTI_REGION_DRILL_CHECKLIST.md).

## 3. LDAP sync (S51–S52)

1. `LDAP_SYNC_MOCK=true` or staging bridge URL.
2. `GET /api/ldap/onboard` — wizard steps present.
3. `POST /api/ldap/sync { dryRun: true, teamId }` — no PII in worker logs.
4. `POST /api/ldap/sync` — audit `ldap.sync.completed`.

## 4. Webhooks (S53–S54)

1. Create Workday/BambooHR template webhook via `GET /api/webhook-templates`.
2. `POST /api/teams/:teamId/webhooks/:id/test` — delivery succeeds (sandbox URL).
3. Close a session — outbound webhook + AE `webhook.delivered`.

## 5. Tournaments + coaching (S55–S57)

1. Seed bracket via `POST /api/sessions/:id/bracket/seed`.
2. LIVE session: activate `bracket` energizer; voters submit picks; presenter advances.
3. Dashboard Insights: coaching card load, accept/dismiss, email export (check Resend dev log).

## 6. Partner + trust (S58–S59)

1. `GET /api/marketplace/apps` — curated listings.
2. `GET /api/partner/sla` — SLA snapshot.
3. Visit `/trust/soc2`, `/marketplace`, `/partner/sla`.

## 7. RAG + moat (S56, S60)

1. `GET /api/agent/grounding?q=test` (auth) — chunks returned.
2. Insights: similar sessions search (closed session).

## Sign-off

| Ritual | Owner | Date | Pass |
|--------|-------|------|------|
| Failover drill | DevOps | | |
| LDAP mock sync | Backend | | |
| Webhook sandbox | Backend | | |
| WS tournament smoke | Frontend | | |
| Trust pages | PO/Marketing | | |
