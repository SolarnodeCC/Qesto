---
id: GDPR-BADGE-01
type: runbook
status: active
created: 2026-05-22
---

# GDPR Data Subject Request Runbook

## Self-service deletion

Authenticated users call:

```http
DELETE /api/users/me/gdpr-delete
Authorization: Bearer <session JWT>
```

Effects (best-effort, idempotent):

- Deletes owned sessions and child rows (votes, questions, energizers, insights).
- Removes user row from D1 `users`.
- Clears `USERS_KV` preferences and team membership index keys.
- Emits `gdpr.deletion_requested` then `gdpr.deletion_completed` Analytics Engine events.

SLA target: completion within **72 hours**; API path is synchronous where D1/KV succeed.

## Manual requests

Email **privacy@qesto.cc** with account email. Verify identity via magic-link to same inbox before manual delete.

## Evidence for marketing badge

- This runbook exists and is linked from [`SOC2_EVIDENCE.md`](./SOC2_EVIDENCE.md).
- Vitest: `tests/unit/gdpr-delete.test.ts` covers delete helper.
