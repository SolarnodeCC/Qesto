---
id: RUNBOOK-INFRA_SPRINT_CHECKLIST
type: runbook
category: incident
status: historical
version: 1.0
created: 2026-04-01
updated: 2026-06-19
tags:
  - incident-response
  - operations
  - procedures
relates_to:
  - OBSERVABILITY
  - RELEASE_TRAIN_MASTER
---

> **Historical (pre-release-train).** This is the Sprint 20 (May 2026) infrastructure checklist,
> kept as evidence. Forward planning now uses **release trains** — see
> [`RELEASE_TRAIN_MASTER.md`](../../product/planning/RELEASE_TRAIN_MASTER.md) /
> [`BACKLOG_ACTIVE.md`](../../product/backlog/BACKLOG_ACTIVE.md). The infrastructure steps below
> remain useful as a reusable checklist; ignore the sprint timeline framing.

# Sprint 20 Infrastructure Checklist

**Timeline:** May 13–27, 2026  
**Owner:** DevOps + Backend  
**Blockers:** Deploy pipeline + foundational libraries ready before Sprint 21 kicks off  

---

## Overview

Sprint 20 pre-work prepares Qesto for v2.2 development. Without this checklist complete, Sprints 21–26 will be blocked on deploy-pipeline readiness, feature flag wiring, and foundational libraries.

**Estimated Effort:** 2–3 days DevOps + 1 day Backend + 1 day coordination

---

## Phase 1: Deploy Pipeline (DevOps, 0.5 days)

> Note: Qesto does not run a dedicated staging environment (none is planned).
> The original staging-provisioning steps here (D1/KV/secrets/`[env.staging]`)
> have been retired; deploys go straight to the `qesto` production Pages
> project. Only the commit-SHA fix below remains from this phase.

### Fix Production Commit SHA (DevOps, 0.5 days)

Current state: `/api/version` returns `COMMIT_SHA=dev` instead of actual commit hash.

- [ ] Update CI job (`.github/workflows/ci.yml`) to inject commit SHA during deploy:
  ```yaml
  - name: Get commit SHA
    id: sha
    run: echo "sha=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

  - name: Deploy to Cloudflare Pages
    run: |
      COMMIT_SHA=${{ steps.sha.outputs.sha }} \
      wrangler pages deploy
  ```
- [ ] Verify production API now returns JSON:
  ```bash
  curl https://qesto.cc/api/version
  # Expected: { "version": "2.2.0", "commit": "abc1234", "timestamp": "2026-05-13T..." }
  ```

---

## Phase 2: Feature Flags (Backend, 1 day)

### Add Flags to `types.ts`

Update `Env` interface in `functions/api/types.ts`:

```typescript
export interface Env {
  // Existing...
  SESSIONS_KV: KVNamespace;
  USERS_KV: KVNamespace;
  
  // New for v2.2
  LIVE_ENERGIZERS_ENABLED?: string;      // "true" to enable LIVE energizer WebSocket
  CIRCUIT_BREAKER_ENABLED?: string;      // "true" to enable circuit breaker
  INTEGRATION_ENABLED?: string;           // "true" to enable webhooks
  CIRCUIT_BREAKER_KV?: KVNamespace;      // Circuit breaker state store
  INTEGRATIONS_KV?: KVNamespace;         // Integration token storage
}
```

- [ ] Verify TypeScript compilation passes:
  ```bash
  npm run typecheck
  ```

### Implement KV Kill-Switch Pattern (Backend, 0.5 days)

Add to `SessionRoom` (DO initialization):

```typescript
// SessionRoom.ts - at the start of onWebSocketMessage()
async onWebSocketMessage(ws: WebSocket, msg: ArrayBuffer) {
  // Check for dynamic feature flag override in KV
  const killSwitch = await this.env.SESSIONS_KV.get('feature:live_energizers_enabled');
  const isLiveEnergizerEnabled = killSwitch !== null ? killSwitch === 'true' : (this.env.LIVE_ENERGIZERS_ENABLED === 'true');

  if (!isLiveEnergizerEnabled && msg.includes('energizer')) {
    ws.send(JSON.stringify({ error: 'Feature disabled' }));
    return;
  }
  // ... rest of handler
}
```

**Operator runbook:** To disable LIVE energizers in production without redeploy:

```bash
wrangler kv key put \
  --namespace-id <SESSIONS_KV_PROD_ID> \
  "feature:live_energizers_enabled" \
  "false"
```

- [ ] Document in `/docs/RUNBOOKS.md`

---

## Phase 3: PII Sanitization (Backend, 1 day)

### Create Logging Helper

Create `functions/api/lib/log.ts` (see [ADR-PII-SANITIZATION.md](../../adr/ADR-0009-pii-sanitization.md)):

- [ ] Implement `safeLogContext()` function
- [ ] Implement `sanitizeErrorMessage()` with denylist regex
- [ ] Add unit tests for redaction

```bash
npm run test -- tests/unit/lib/log.test.ts
```

### Add CI Gate

Update `.github/workflows/ci.yml`:

```yaml
- name: "Security: Block raw error logging"
  run: |
    if grep -r "console\.error\(err\)" functions/api --include="*.ts" \
       | grep -v "lib/log.ts" \
       | grep -v ".test.ts"; then
      echo "ERROR: Raw console.error(err) detected outside safeLogContext()"
      exit 1
    fi
```

- [ ] Verify gate works (should pass clean build)

---

## Phase 4: Circuit Breaker Library (Backend, 1 day)

### Implement Circuit Breaker Module

Create `functions/api/lib/resilience/circuit-breaker.ts` (see [ADR-CIRCUIT-BREAKER.md](../../adr/ADR-0007-circuit-breaker.md)):

- [ ] Implement `CircuitBreaker` class with:
  - In-memory state machine
  - KV-backed shared state (optional)
  - Timeout + failure threshold config
  - `execute()` method for wrapping external calls
- [ ] Add unit tests for state transitions, timeouts, half-open probing

```bash
npm run test -- tests/unit/lib/resilience/circuit-breaker.test.ts
```

- [ ] Create instances for Stripe, Resend, AI, JWKS:
  ```typescript
  export const CircuitBreaker = {
    STRIPE: new CircuitBreaker('stripe', { /* config */ }),
    RESEND: new CircuitBreaker('resend', { /* config */ }),
    AI: new CircuitBreaker('ai', { /* config */ }),
    JWKS: new CircuitBreaker('jwks', { /* config */ }),
  };
  ```

---

## Phase 5: Integration Foundation (Backend, 0.5 days)

### Create Integration Library

Create `functions/api/lib/integrations/` directory with:

- [ ] `oauth.ts` — OAuth2Client with PKCE
- [ ] `token-store.ts` — EncryptedTokenStore (KV-backed)
- [ ] `http-client.ts` — IntegrationHttpClient (fetch + circuit breaker + retry)
- [ ] `webhook-verify.ts` — HMAC signature verification helpers
- [ ] `types.ts` — IntegrationProvider interface

```bash
npm run test -- tests/unit/lib/integrations/**
```

---

## Phase 6: Database Migrations (Backend, 0.5 days)

### Add v2.2 Schema Changes

Create a new migration file (e.g., `migration.sql`):

```sql
-- New columns for AI recap metadata
ALTER TABLE recaps ADD COLUMN format_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE recaps ADD COLUMN ai_model_version TEXT;
ALTER TABLE recaps ADD COLUMN generated_at INTEGER;
ALTER TABLE recaps ADD COLUMN evidence_json TEXT;
CREATE INDEX idx_recaps_session_format ON recaps(session_id, format_version);

-- New table for custom roles
CREATE TABLE custom_roles (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSON,
  created_by TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (team_id) REFERENCES teams(id)
);
CREATE INDEX idx_custom_roles_team ON custom_roles(team_id);

-- Extend audit events to support energizer events
-- (audit_action already uses TEXT, so just document new types in migration)
-- New event types: ws.energizer_activate, ws.energizer_complete, ws.score_updated
```

- [ ] Test migration locally:
  ```bash
  npx wrangler d1 execute --local --file migration.sql
  ```
- [ ] Apply to production:
  ```bash
  wrangler d1 execute qesto_3_db --remote --file migration.sql
  ```
- [ ] Verify schema:
  ```bash
  wrangler d1 execute qesto_3_db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
  ```

---

## Verification Checklist

Before Sprint 21 begins, run full verification:

- [ ] **Production D1 + KV:** `wrangler d1 query qesto_3_db --remote "SELECT COUNT(*) FROM sessions"`
- [ ] **Feature flags wired:** `npm run typecheck` (no errors)
- [ ] **Kill-switch pattern:** Document in RUNBOOKS.md
- [ ] **PII sanitization:** `npm run test -- tests/unit/lib/log.test.ts` (all pass)
- [ ] **Circuit breaker:** `npm run test -- tests/unit/lib/resilience/**` (all pass)
- [ ] **Integration foundation:** `npm run test -- tests/unit/lib/integrations/**` (all pass)
- [ ] **Schema migrations:** Production D1 has new tables + columns
- [ ] **CI gate:** `npm run lint` includes PII check
- [ ] **Commit SHA:** `curl https://qesto.cc/api/version` returns JSON with commit hash
- [ ] **Full build:** `npm run build` completes without warnings (CSS import warnings OK)
- [ ] **All tests pass:** `npm run test` (670+ tests)

---

## Blockers & Escalations

| Issue | Resolution | Owner |
|---|---|---|
| **Stripe test account not activated** | Verify email with Stripe, enable test mode | DevOps |
| **D1 migration fails** | Check schema syntax (SQLite not PostgreSQL) | Backend |
| **KV namespace quota hit** | Request increase from Cloudflare | DevOps |
| **Resend test email bounces** | Use real sandbox domain, whitelist test recipient | DevOps |
| **Circuit breaker TTL conflicts** | Pre-allocate CIRCUIT_BREAKER_KV namespace | DevOps |

---

## Sign-Off

- [ ] **DevOps Lead:** Deploy pipeline verified + commit SHA fixed
- [ ] **Backend Lead:** Circuit breaker + integration foundation + PII helper implemented + tests pass
- [ ] **Security Lead:** PII denylist approved + CI gate active
- [ ] **Product Lead:** Feature flags documented for rollout plan

**Target Date:** May 27, 2026 (end of Sprint 20)

**Blocker for Sprint 21 start:** All items above must be complete.
