---
id: DR-DRILL-V6-2026
type: evidence
domain: operations
category: disaster-recovery
status: active
version: 1.0
created: 2026-06-13
updated: 2026-06-13
tags:
  - disaster-recovery
  - rto
  - rpo
  - drill
  - v6.0-rc
  - s89
relates_to:
  - RUNBOOK-RUNBOOKS
  - SECURITY-SECRET_ROTATION_POLICY
  - ADR-0027
  - ADR-0036
  - ARCHITECTURE
  - MULTI_REGION_RUNBOOK
---

# Disaster Recovery Drill — v6.0 RC Evidence (S89)

_Sprint gate: DR drill RTO ≤ 2h evidence, required by S89 to unblock v6.0 GA at S90._
_Drill type: tabletop + procedural walkthrough. This is not a production incident record._
_Where a time is an engineering estimate rather than a clock-measured restore, it is marked **[estimate]**._

---

## 1. Scope and Objectives

### 1.1 Objective

Produce evidence that the Qesto v6.0 production stack can recover from credible failure
scenarios within a Recovery Time Objective (RTO) of 2 hours and a stated Recovery Point
Objective (RPO), using documented procedures. This report satisfies the S89 gate item
"DR drill RTO ≤ 2h evidence" (SPRINT85_99_PLAN.md line ~212) required before v6.0 GA
ships at S90 / `DR-DRILL-ANNUAL-V6-01`.

### 1.2 Drill date and participants

| Field | Value |
|---|---|
| Drill date | 2026-06-13 |
| Drill type | Tabletop + procedural walkthrough (not a live production exercise) |
| Lead | DevOps (qesto-devops) |
| Reviewers | Architect, Backend Lead |
| Next drill | Annual — target S98 pre-v7.0 GA per SPRINT85_99_PLAN.md |

### 1.3 In-scope assets

| Asset | Binding / identifier | Managed by |
|---|---|---|
| D1 primary database | `DB` / `qesto_3_db` (id `d391bdd5…`) | Cloudflare-managed (SQLite on edge) |
| KV — users | `USERS_KV` | Cloudflare KV (global, eventual) |
| KV — sessions | `SESSIONS_KV` | Cloudflare KV |
| KV — teams | `TEAMS_KV` | Cloudflare KV |
| KV — templates | `TEMPLATES_KV` | Cloudflare KV |
| KV — decisions | `DECISIONS_KV` | Cloudflare KV |
| KV — audit | `AUDIT_KV` | Cloudflare KV |
| KV — actions | `ACTIONS_KV` | Cloudflare KV |
| KV — metrics | `METRICS_KV` | Cloudflare KV |
| KV — circuit breaker | `CIRCUIT_BREAKER_KV` | Cloudflare KV |
| KV — integrations | `INTEGRATIONS_KV` | Cloudflare KV |
| KV — help conversations | `HELP_CONVERSATIONS_KV` | Cloudflare KV |
| KV — marketing | `MARKETING_KV` | Cloudflare KV |
| KV — multi-region state | `MULTI_REGION_STATE_KV` | Cloudflare KV |
| Durable Object | `SESSION_ROOM` (SQLite-backed, class `SessionRoom`) | Cloudflare DO |
| R2 — session snapshots | `R2_SESSIONS` / bucket `qesto-sessions` | Cloudflare R2 |
| Vectorize indexes | `DECISIONS_VECTORIZE` (`qesto-decisions`), `HELP_VECTORIZE` (`qesto-help`), `KB_VECTORIZE` (`qesto-kb-production`) | Cloudflare Vectorize |
| Workers AI | `AI` binding | Cloudflare Workers AI |
| Secrets | `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ADMIN_SECRET`, OAuth client secrets, `EMBED_WIDGET_SECRET`, `SAML_IDP_CERT` | Cloudflare Pages Secrets |
| DNS + Pages project | `qesto.cc` / Cloudflare Pages project `qesto` | Cloudflare DNS + Pages |
| External services | Stripe, Resend (email), OAuth providers | Third-party SaaS |

### 1.4 Out of scope

- Vectorize re-indexing quality (covered by `kb:health` cron and `AI_EVAL_BASELINE.md`).
- Third-party SaaS DR (Stripe, Resend own their own uptime SLAs).
- Worker code deployment rollback (covered by canary/blue-green runbook in `RUNBOOKS.md`).

---

## 2. RTO and RPO Targets

| Metric | Target | Rationale |
|---|---|---|
| **RTO** | **≤ 2 hours** | v6.0 GA gate requirement (SPRINT85_99_PLAN.md) |
| **RPO** | **≤ 24 hours for D1 (point-in-time backup cadence); ≤ ~60 seconds for live DO state; near-zero for KV (Cloudflare-managed durability)** | Bounded by Cloudflare platform guarantees and R2 snapshot cadence |

---

## 3. Edge-Native Architecture and How It Bounds RTO

Qesto is edge-native on Cloudflare. The key architectural properties that reduce recovery
complexity are:

**Stateless compute.** Pages Functions (Hono) are stateless. A re-deploy (`wrangler pages
deploy`) is the full "compute restore." There is no application server to provision, no AMI
to restore, no database connection pool to rebuild.

**Cloudflare-managed durability for D1 and KV.** Cloudflare replicates D1 and KV across
its own infrastructure. The operator's recovery action is typically to re-wire the binding
or wait for Cloudflare to restore the service, not to manually reconstruct data from backup.
D1 offers point-in-time restore via support ticket (daily backup cadence). KV uses
eventually-consistent replication; individual key loss is an extremely rare platform event,
not an application-operator concern.

**DO SQLite persistence.** Each `SessionRoom` DO instance has its own SQLite storage,
managed by Cloudflare. If a DO crashes it restarts automatically on next request. In-flight
session state (votes, answers) for a LIVE session could be lost if the DO eviction occurs
before an R2 snapshot; the ADR-042 Phase 2.3 R2 snapshot binding (`R2_SESSIONS`) is
designed to bound this loss window.

**Secrets propagate instantly.** `wrangler pages secret put <KEY>` updates all Workers
globally without a re-deploy. This eliminates a large recovery step common in
non-managed stacks.

**Pages global CDN.** DNS and static asset delivery are Cloudflare-managed. An
account-level incident is an external dependency whose RTO is bounded by Cloudflare's
own restoration, not by operator action.

---

## 4. Failure Scenarios Exercised

### Scenario A — D1 primary loss / data corruption

**Hypothesis:** D1 `qesto_3_db` returns errors or row-level corruption is detected via
`/api/admin/health` returning `d1: "error"`.

**Detection signals:**
- `/api/admin/health` `d1` field shows `"error"` or elevated latency.
- Auth, session creation, billing routes return 500.
- `wrangler pages deployment tail` shows `D1_ERROR` events.

**Recovery procedure:**
1. Check Cloudflare status page (`cloudflarestatus.com`) — distinguish platform incident
   from data corruption. If platform incident, wait; Cloudflare manages replication.
2. If data corruption: open Cloudflare support ticket to trigger D1 point-in-time restore.
   Provide `database_id` (`d391bdd5-a03d-41bc-bc45-6b5f3bac1b1b`) and target timestamp.
3. While restore is in progress, deploy a maintenance-mode Pages deployment that returns
   503 with a user-facing message, preventing further writes against a potentially
   corrupt state.
4. Once Cloudflare confirms restore: redeploy main branch.
5. Verify: `GET /api/admin/health` shows `d1: "ok"`; spot-check
   `wrangler d1 execute DB --command "SELECT COUNT(*) FROM sessions" --remote`.
6. Re-enable writes; monitor error rate for 10 minutes.

**Measured/estimated restore time:**
- Cloudflare D1 point-in-time restore: **[estimate] 30–90 minutes** (support ticket
  processing time; not a self-serve operation as of 2026-06).
- Operator steps (maintenance deploy + verify): **[estimate] 15 minutes**.
- Total: **[estimate] 45–105 minutes**.

**RPO:** Up to 24 hours of writes if daily backup is the only recovery point. If
Cloudflare replication covers the event, RPO is near-zero.

---

### Scenario B — KV namespace loss (single namespace)

**Hypothesis:** A KV namespace (e.g., `SESSIONS_KV`) becomes unavailable or returns
stale/empty reads, causing session look-ups to fail.

**Detection signals:**
- `/api/admin/health` `kv` field shows degradation or specific namespace errors.
- Session routes return 404 for sessions known to exist (D1 has the record but KV
  cache is empty).

**Recovery procedure:**
KV namespaces use eventual consistency (~60-second propagation window). Most KV
"outages" are transient read inconsistencies, not data loss events.

1. Wait 60–120 seconds for KV global consistency to catch up.
2. If persistent: check Cloudflare status page for KV service degradation.
3. KV data (users, sessions cache) is derived from or duplicated in D1. Application is
   designed so KV misses fall back to D1 reads. Verify fallback path is healthy:
   `GET /api/admin/health`.
4. For `AUDIT_KV` and `ACTIONS_KV` which hold non-D1-backed blobs: if keys are
   confirmed lost (not just eventually consistent), affected records cannot be
   reconstructed from backup (no KV export backup exists in the current setup —
   see Gaps section, Gap 1).
5. Resume normal operation once KV reads return consistent results.

**Measured/estimated restore time:**
- Transient KV inconsistency: self-heals in **[estimate] < 5 minutes**.
- Cloudflare KV platform incident: bounded by Cloudflare restoration; operator RTO
  contribution is **[estimate] < 10 minutes** (verify + communicate).
- Total operator-controlled RTO: **[estimate] < 15 minutes** for transient; platform
  incident is out of operator control.

**RPO:** For KV data that is a cache of D1, RPO is near-zero (D1 is authoritative). For
KV-only blobs (audit log entries, action queues), RPO is undefined without a KV export
backup — see Gap 1.

---

### Scenario C — Account-level Cloudflare Pages outage

**Hypothesis:** The Cloudflare account or Pages project becomes inaccessible (e.g., account
suspended, Pages project misconfigured, or a Cloudflare platform-wide Pages incident).

**Detection signals:**
- `https://qesto.cc` returns non-200 or HTTPS handshake fails.
- Cloudflare dashboard inaccessible or shows account suspension notice.

**Recovery procedure:**
1. Check `cloudflarestatus.com` — if platform incident, no operator action; wait.
2. If account-level suspension: contact Cloudflare billing/support immediately.
3. If Pages project misconfiguration (e.g., wrong deployment promoted):
   ```bash
   wrangler pages deployment list --project-name qesto
   wrangler pages deployment rollback <deployment-id> --project-name qesto
   ```
4. Verify: `GET https://qesto.cc/api/admin/health`.

**Measured/estimated restore time:**
- Pages rollback to previous deployment: **[estimate] 5–10 minutes**.
- Platform incident: outside operator control; Cloudflare's own RTO applies.
- Operator-controlled restore: **[estimate] < 15 minutes**.

**RPO:** Not applicable — Pages hosts static assets and stateless functions; no data loss.

---

### Scenario D — Secret compromise and emergency rotation

**Hypothesis:** A high-risk secret (`JWT_SECRET`, `STRIPE_SECRET_KEY`, or `RESEND_API_KEY`)
is confirmed leaked (e.g., found in a git commit, log stream, or external report).

**Detection signals:**
- Security scan CI gate (`check:secrets`) fails.
- Stripe dashboard shows unauthorized API usage.
- Anomalous auth token activity in `AUDIT_KV`.

**Recovery procedure (per SECRET_ROTATION_POLICY.md emergency runbook):**

For `JWT_SECRET` (highest blast radius — invalidates all active sessions):
1. **Immediate (< 5 min):** Generate new secret value.
2. **Update Cloudflare (< 2 min):**
   ```bash
   wrangler pages secret put JWT_SECRET --project-name qesto
   ```
   Secret propagates instantly to all Workers globally. No re-deploy required.
3. **Consequence:** All existing JWT sessions are immediately invalid. Users are
   logged out globally. Publish user-facing notice: "Security event — please log in again."
4. **Verify (< 5 min):** Confirm `/api/auth/me` returns 401 for old tokens;
   new magic-link login succeeds.

For `STRIPE_SECRET_KEY`:
1. Revoke key in Stripe dashboard.
2. Generate new restricted key.
3. `wrangler pages secret put STRIPE_SECRET_KEY --project-name qesto`.
4. Test: `GET /api/billing/status` with valid session; confirm Stripe responds.
5. Revoke old key in Stripe dashboard only after confirming new key is live.

**Measured/estimated restore time:**
- Secret rotation + propagation: **[estimate] 10–15 minutes** per secret.
- User communication for JWT rotation: **[estimate] 5 minutes**.
- Full recovery for all high-risk secrets rotated simultaneously: **[estimate] < 30 minutes**.

**RPO:** Not applicable — secrets are not data; rotation is a forward-only operation.
User session invalidation is a side effect, not data loss.

---

### Scenario E — EU / region degradation (multi-region write routing)

**Hypothesis:** The EU-primary D1 write path degrades. Relevant to multi-region write
routing as designed in ADR-0027 and ADR-0036.

**Detection signals:**
- `/api/admin/health` returns `writeRegion` mismatch or elevated write latency.
- AE event `db.residency_violation` appears for `region_lock=eu` tenants.
- `MULTI_REGION_STATE_KV` failover flag is stale.

**Recovery procedure (per MULTI_REGION_RUNBOOK.md):**
1. Check health:
   ```bash
   curl -s "https://qesto.cc/api/admin/health" | jq '.data | {readRegion, writeRegion, failoverActive}'
   ```
2. If EU D1 degraded and `MULTI_REGION_WRITES_ENABLED=true`:
   - `POST /api/admin/multi-region/failover` (superuser JWT) to route writes to
     available replica.
   - Verify AE event `multi_region.failover_triggered`.
3. Confirm EU-locked tenants (`region_lock=eu`) are receiving appropriate errors or
   are routed to EU-only path per ADR-0027; do not silently route them cross-region.
4. Clear failover when EU write path recovers:
   `DELETE /api/admin/multi-region/failover`.

**Note:** As of S89, `MULTI_REGION_WRITES_ENABLED` is not confirmed true in production
(ADR-0036 GA targeted S74–S75). If MR writes are not enabled, EU degradation means
D1 primary degradation (Scenario A applies). See Gap 3.

**Measured/estimated restore time:**
- Failover trigger + verification: **[estimate] 10 minutes**.
- Total: **[estimate] < 15 minutes** for operator-controlled recovery.

---

### Scenario F — Durable Object (SessionRoom) stuck / state loss

**Hypothesis:** A `SessionRoom` DO instance crashes mid-session and does not auto-recover,
or its SQLite storage is lost.

**Detection signals:**
- WebSocket connections drop; clients cannot reconnect to an active `LIVE` session.
- `GET /api/sessions/:id/status` shows LIVE but WebSocket returns 503.

**Recovery procedure:**
1. DO restarts are automatic on next request. Instruct host to reload the session URL
   (triggers DO re-initialization). **Most DO crashes self-heal in < 60 seconds.**
2. If DO state is lost (votes, answers in-flight):
   - Check `R2_SESSIONS` bucket for the most recent snapshot for the session ID
     (ADR-042 Phase 2.3).
   - Restore from R2 snapshot if available.
   - If no snapshot: inform session host; in-flight votes for the current question
     may be lost. D1 persists closed-question results; only the active question's
     in-progress votes are at risk.
3. Verify recovery: WebSocket reconnects, `/api/sessions/:id/participants` count
   returns non-zero.

**Measured/estimated restore time:**
- Auto-recovery (DO restart): **[estimate] < 2 minutes**.
- Manual R2 restore: **[estimate] 10–20 minutes** [estimate — R2 snapshot restore
  path not yet exercised in a drill; see Gap 2].

**RPO:** Active-question in-flight votes: up to the R2 snapshot interval (cadence not
formally defined — see Gap 2). Closed-question results in D1: RPO matches Scenario A.

---

### Scenario G — Vectorize index corruption or rebuild required

**Hypothesis:** One or more Vectorize indexes (`qesto-decisions`, `qesto-help`,
`qesto-kb-production`) returns degraded results or becomes unavailable.

**Detection signals:**
- KB health cron (`0 2 * * *`) logs failures in `wrangler tail`.
- `POST /api/ai/insights` or help assistant returns empty or irrelevant results.
- `/api/admin/health` `ai` field reports errors.

**Recovery procedure:**
1. AI features (insights, help assistant, KB search) degrade gracefully — they are
   non-blocking for session creation and participant flow. Disable at feature flag level
   if needed: `POST /api/admin/features/insights/disable`.
2. Rebuild affected index:
   - For `KB_VECTORIZE`: re-run `npm run kb:sync` in CI (triggered by `kb-sync-on-merge.yml`
     on any `knowledge-base/` change, or manually dispatched).
   - For `DECISIONS_VECTORIZE` and `HELP_VECTORIZE`: re-embed from D1 source records
     using the vectorize sync job.
3. Verify: KB health cron passes; `kb_search` MCP tool returns relevant results.

**Measured/estimated restore time:**
- Feature flag disable: **[estimate] < 5 minutes**.
- Full index rebuild (KB ~hundreds of docs): **[estimate] 15–45 minutes** [estimate].
- Total: **[estimate] < 1 hour**.

**RPO:** Vectorize indexes are rebuilt from D1 source records. RPO for vector data
matches D1 RPO (Scenario A). No unique data is stored only in Vectorize.

---

## 5. Results Table

| Scenario | Detection method | Recovery procedure | Measured / estimated RTO | RTO ≤ 2h met? |
|---|---|---|---|---|
| A — D1 primary loss / corruption | `/api/admin/health` d1 error; 500s on auth/session routes | CF support point-in-time restore + maintenance deploy | **[estimate] 45–105 min** | Yes (upper bound 105 min ≤ 120 min) |
| B — KV namespace loss | Health check; session 404s | Wait for eventual consistency; D1 fallback; KV platform incident = CF restoration | **[estimate] < 15 min** (transient); platform-bounded otherwise | Yes |
| C — Pages account-level outage | Site unreachable | Pages rollback via wrangler or CF support | **[estimate] < 15 min** operator-controlled | Yes |
| D — Secret compromise + rotation | Security scan CI; Stripe dashboard anomaly; audit KV | `wrangler pages secret put` + user comms (JWT invalidation) | **[estimate] < 30 min** | Yes |
| E — EU region degradation | Health check writeRegion mismatch | MR failover endpoint; EU tenant isolation preserved | **[estimate] < 15 min** | Yes |
| F — DO SessionRoom stuck | WS drop; session LIVE but no WS | DO auto-restart; R2 snapshot restore if needed | **[estimate] < 2 min** auto; < 20 min manual | Yes |
| G — Vectorize index corruption | KB cron failure; degraded AI results | Feature flag disable; kb:sync rebuild | **[estimate] < 1 hour** | Yes |

**Aggregate RTO assessment:** All scenarios estimated within 2 hours. The widest estimated
window is Scenario A (D1 restore via CF support) at an upper estimate of 105 minutes — this
is the critical path and the primary operational risk.

---

## 6. Data-Loss / RPO Analysis

| Asset | RPO | Basis |
|---|---|---|
| D1 (`qesto_3_db`) | ≤ 24 hours (daily backup cadence) | Cloudflare D1 automated backup; point-in-time restore via support. Continuous replication within Cloudflare infrastructure bounds normal RPO to near-zero for platform failures; 24h is the worst-case for corruption caught late. |
| KV namespaces (cache layers) | Near-zero for D1-derived data; undefined for KV-only blobs | KV data backed by D1 (users, sessions) re-hydrates from D1. `AUDIT_KV` and `ACTIONS_KV` blobs have no separate backup — see Gap 1. |
| DO SQLite storage (active session state) | ≤ R2 snapshot interval (cadence TBD) | In-flight vote data for the active question is at risk if DO is evicted before snapshot. Closed-question data is persisted to D1. See Gap 2. |
| R2 (`qesto-sessions`) | Not applicable (DR artifact store) | R2 stores snapshots; the RPO of snapshots depends on the snapshot cadence. |
| Vectorize indexes | Same as D1 | Rebuilt from D1 source; no unique data loss beyond D1. |
| Secrets | Not applicable | Secrets are configuration, not data. Rotation is forward-only. |
| DNS / Pages static assets | Not applicable | No customer data; re-deploy restores from git. |

---

## 7. Gaps and Action Items

| Gap | Description | Risk | Owner | Target |
|---|---|---|---|---|
| **Gap 1 — No KV export backup** | `AUDIT_KV` and `ACTIONS_KV` hold blobs with no D1 counterpart and no automated export/backup job. A Cloudflare KV platform data-loss event would result in unrecoverable audit and action records. | Medium | DevOps + Backend | S91 |
| **Gap 2 — R2 snapshot cadence undefined** | ADR-042 Phase 2.3 introduced the `R2_SESSIONS` binding for DO recovery snapshots. The snapshot interval and automated trigger are not yet documented or confirmed active. Until the cadence is set and verified, DO in-flight vote RPO is unbounded. | High (for active sessions) | Backend + DevOps | S90 (v6.0 GA blocker candidate) |
| **Gap 3 — MR write GA status unclear** | ADR-0036 targeted MR write GA at S74–S75. Production status of `MULTI_REGION_WRITES_ENABLED` is not confirmed in wrangler.toml or a verified health response. If disabled, Scenario E reduces to Scenario A; if enabled, failover path is operational. Needs explicit confirmation. | Low (affects EU SLA claims) | DevOps + Architect | S90 |
| **Gap 4 — D1 restore is not self-serve** | D1 point-in-time restore requires a Cloudflare support ticket. No self-serve restore API exists as of 2026-06. This creates a support queue dependency in the critical RTO path for Scenario A. The 45–105 min estimate assumes prompt CF support response; after-hours tickets may extend this. | High | DevOps (escalation path doc) | S90 |
| **Gap 5 — No live DR drill with traffic** | This drill is a tabletop/procedural walkthrough. No live production traffic was interrupted and no actual restore was executed. The R2 restore path (Gap 2), D1 restore path (Gap 4), and MR failover path have not been clock-timed in a production-equivalent environment. | Medium | DevOps | Annual (S98 pre-v7.0) |
| **Gap 6 — KV-only audit log retention** | The existing runbook (`RUNBOOKS.md`) states D1 RPO < 15 min but does not account for KV-only audit blobs. This documentation gap could cause confusion during a real incident. Update RUNBOOKS.md §DR to reflect KV-only RPO limitations. | Low | DevOps | S90 |

---

## 8. Sign-Off

| Role | Name | Date | Outcome |
|---|---|---|---|
| DevOps Lead | qesto-devops | 2026-06-13 | Approved — tabletop complete; gaps logged |
| Architect | — | — | Pending review |
| Product Owner | — | — | Pending acknowledgement of Gap 2 as S90 blocker candidate |

**Drill outcome:** RTO ≤ 2h target is met by engineering estimate across all seven
scenarios. The critical path (D1 restore, Scenario A) has an upper estimate of 105 minutes,
within the 120-minute gate. Two gaps (Gap 2 — R2 snapshot cadence, Gap 4 — D1 restore
not self-serve) are recommended for S90 pre-GA resolution before the live annual drill
scheduled for S90 / `DR-DRILL-ANNUAL-V6-01`.

---

## 9. Next Drill Cadence

Annual per roadmap and `DR-DRILL-ANNUAL-V6-01` story in S90. The next full drill
(targeting a live traffic exercise rather than tabletop) is scheduled for **S98**
pre-v7.0 GA, per SPRINT85_99_PLAN.md §release gates.

Between drills:
- Multi-region failover path verified each sprint touching MR write routing
  (MULTI_REGION_DRILL_CHECKLIST.md).
- Secret rotation exercised on the 90-day schedule (SECRET_ROTATION_POLICY.md).
- KB vector health verified nightly by the `0 2 * * *` cron.
- D1 backup recency confirmed by DevOps at sprint close.

---

_See also: [RUNBOOKS.md](./incidents/RUNBOOKS.md) | [SECRET_RUNBOOK.md](./incidents/SECRET_RUNBOOK.md) | [MULTI_REGION_RUNBOOK.md](./MULTI_REGION_RUNBOOK.md) | [ADR-0027](../adr/ADR-0027-multi-region-writes.md) | [ADR-0036](../adr/ADR-0036-eu-mr-write-ga.md) | [SECRET_ROTATION_POLICY.md](../security/SECRET_ROTATION_POLICY.md)_
