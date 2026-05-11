---
id: RUNBOOK-RUNBOOK_SESSION_RECONCILE
type: runbook
category: incident
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - incident-response
  - operations
  - procedures
relates_to:
  - OBSERVABILITY
---

# Runbook: Session State Reconciliation

**Scope:** Diagnosing and recovering from a split-brain state where a session's
D1 status is `live` but the SessionRoom Durable Object is cold (not initialised).

**Severity:** High — affects active presenter flow. Participants cannot join via WebSocket.

---

## 1. Identifying a Split-Brain

Symptoms:
- Session shows `status = 'live'` in D1 but the presenter view never loads participants.
- WebSocket upgrades to `/api/sessions/:id/ws` fail with `404` or hang.
- Cloudflare Workers logs show no `session.start.success` event for the session,
  but `session.start.rollback_failed` IS present for the same `session_id`.

**When this can occur:**
The start handler writes D1 to `live` then calls the DO. If the DO call succeeds
but the subsequent D1 rollback-on-failure path throws (network error), the DO will
have initialised but the D1 status could remain in an inconsistent state. The
structured log event `session.start.rollback_failed` is the signal.

---

## 2. Diagnosis

### Step 1 — Locate the trace

Search Cloudflare Workers tail logs for the `session_id`:

```
wrangler tail --filter '{"event":"session.start.rollback_failed"}'
```

Note the `trace_id` for the failing request.

### Step 2 — Confirm D1 status

Using D1 via Wrangler console or the admin API:

```sql
SELECT id, status, started_at FROM sessions WHERE id = '<session_id>';
```

Expected split-brain result: `status = 'live'`, `started_at` set.

### Step 3 — Probe the DO

Call the DO's status route (if available) or attempt a WebSocket upgrade:

```
curl -i https://qesto-api.oostelaar.workers.dev/api/sessions/<session_id>/ws \
  -H "Upgrade: websocket" -H "Connection: Upgrade"
```

- `101 Switching Protocols` → DO is live, false alarm. Check client-side routing.
- `404` or `500` → DO is cold. Proceed to recovery.

---

## 3. Recovery

### Option A — Re-trigger start (preferred)

If the owner can still access the Launchpad:

1. Set D1 status back to `draft`:

```sql
UPDATE sessions
   SET status = 'draft', started_at = NULL
 WHERE id = '<session_id>';
```

2. Ask the owner to click "Open lobby & start" again. The DO will be freshly
   initialised on the next `/start` call.

### Option B — Force-live in D1 only (when DO is confirmed live)

If Step 3 showed the DO IS live and only D1 is stale:

```sql
UPDATE sessions
   SET status = 'live', started_at = <original_started_at_epoch_ms>
 WHERE id = '<session_id>';
```

Do NOT reset to draft if the DO is live — that would create a new split-brain.

### Option C — Abandon and restart

If the DO state is corrupt or cannot be verified:

1. Set D1 to `closed`:

```sql
UPDATE sessions
   SET status = 'closed', closed_at = unixepoch() * 1000
 WHERE id = '<session_id>';
```

2. Notify the owner to create a new session.

---

## 4. Prevention Checklist

After each incident:

- [ ] Confirm `session.start.rollback_failed` alert is wired in Cloudflare
      Analytics (see `docs/OBSERVABILITY.md`).
- [ ] Verify D1 write path has no transient timeout issues (check Workers
      dashboard for D1 error rate spike).
- [ ] Confirm the `AND status = 'draft'` conditional UPDATE is in place — this
      reduces the race window that can cause split-brain.
- [ ] Review the `postDO` retry budget; consider adding one retry with
      exponential backoff before rollback.

---

## 5. Related Files

| File | Purpose |
|---|---|
| `functions/api/routes/sessions.ts` | `/start` handler with rollback + log events |
| `functions/api/SessionRoom.ts` | DO `/init` and `/close` handlers |
| `docs/OBSERVABILITY.md` | Log format, trace_id propagation |
| `docs/RUNBOOKS.md` | General incident response procedures |
