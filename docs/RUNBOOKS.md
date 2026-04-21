# Operational Runbooks — Incident Response & Recovery (Phase 10 Step 6)

**Last Updated:** 2026-04-21  
**Target RTO:** <1 hour  
**Target RPO:** <15 minutes

---

## Table of Contents

1. [Incident Response Procedures](#incident-response)
2. [Deployment & Rollout](#deployment)
3. [Disaster Recovery](#recovery)
4. [Troubleshooting Guide](#troubleshooting)
5. [Alert Escalation](#escalation)

---

## Incident Response

### High Latency Spike (p95 > 500ms)

**Detection:** CloudFlare analytics alert when API p95 latency > 500ms  
**Impact:** User-facing slowness, potential timeouts  
**RTO:** 15 minutes

**Steps:**

1. **Assess severity** (30s)
   - Check Admin Dashboard → Metrics → Historical
   - Identify affected routes (e.g., `/api/sessions/:id/questions` slow?)
   - Check error rate (if >5%, escalate to 5xx incident)
   - Check DO throughput (WebSocket latency)

2. **Identify root cause** (2 min)
   - D1 query slow? Check audit_events table size (may need archival)
   - KV cache miss flood? Check DECISIONS_KV metrics
   - DO overloaded? Check realtime connection count
   - External API slow? (Workers AI timeout?)

3. **Quick mitigations** (5 min)
   - Enable KV caching for affected endpoints: `POST /api/admin/cache/enable`
   - Increase DO memory allocation if available
   - Disable non-essential features (Insights generation can be rate-limited)
   - Clear KV cache for recently-modified data: `POST /api/admin/cache/clear`

4. **Longer-term fix** (10+ min)
   - Add database index if slow query identified
   - Optimize batch queries in route handler
   - Archive old audit events: `POST /api/admin/maintenance/archive-audit`

**Rollback:** If latency introduced by recent deployment, trigger canary rollback (see Deployment section).

---

### High Error Rate (>5%)

**Detection:** CloudFlare alert when error_rate > 0.05  
**Impact:** User-facing failures, broken features  
**RTO:** 5 minutes

**Steps:**

1. **Assess severity** (30s)
   - Check Admin Dashboard → Metrics → Error Rate chart
   - Identify error codes: 400, 401, 403, 500?
   - Search logs for common error patterns

2. **Quick diagnosis** (1 min)
   - Are errors localized to one route? → Rollback recent change
   - Are errors global? → Likely external dependency (DB, KV, Workers AI)
   - Check CloudFlare status page for outages

3. **Immediate actions** (3 min)
   ```
   # If D1 unavailable:
   wrangler d1 execute <db> --file=schema.sql --remote  # Restore from backup

   # If KV unavailable:
   wrangler kv:key delete cache:* --binding DECISIONS_KV  # Clear cache

   # If Workers AI timeout:
   # Disable Insights: POST /api/admin/features/insights/disable
   ```

4. **Root cause analysis** (5+ min)
   - Check D1 query performance: slow migration, missing index?
   - Check Stripe webhook delivery (if billing errors)
   - Verify JWT expiry/renewal (auth errors)

**Escalation:** If unresolved in 5 min, trigger rollback to last stable version.

---

### Durable Object Crash

**Detection:** WebSocket connections drop unexpectedly  
**Impact:** LIVE sessions go offline  
**RTO:** 1 minute (automatic via Cloudflare failover)

**Steps:**

1. **User communication** (30s)
   - Notify affected teams via email: "Session temporarily unavailable, reconnecting…"
   - DO restart is automatic; users can reconnect

2. **Verify recovery** (2 min)
   - Check CloudFlare DO metrics: restart count
   - Verify new DO instance created and initialized
   - Test WebSocket reconnection

3. **Post-incident** (after incident resolved)
   - Check DO logs for crash reason
   - Verify state was recovered (leaderboard, votes, answers)
   - If state lost: restore from KV backup (see Recovery section)

**Prevention:** Monitor DO crash logs in real-time.

---

## Deployment

### Canary Rollout (5% → 100% traffic)

**Timeline:** ~30 minutes for full rollout  
**Automatic rollback:** If error rate > 2% on canary, auto-rollback

**Steps:**

```bash
# 1. Merge to main branch (CI runs tests)
git push origin feature-branch

# 2. Trigger canary deployment
wrangler pages deploy --canary --percentage 5

# 3. Monitor metrics for 5 minutes
# Check: p95 latency, error rate, success rate
# If any metric degrades, auto-rollback triggers

# 4. If canary healthy, proceed
wrangler pages deploy --percentage 25   # 25% traffic

# 5. Monitor 5 minutes
# If stable, proceed
wrangler pages deploy --percentage 50   # 50% traffic

# 6. Monitor 5 minutes
# If stable, proceed
wrangler pages deploy --percentage 100  # 100% traffic (full rollout)
```

**Manual rollback (if auto-rollback fails):**

```bash
git checkout <last-good-commit-hash>
wrangler pages deploy
```

---

### Blue-Green Deployment (Zero-Downtime)

Used for major schema changes or critical updates.

**Steps:**

1. **Prepare Green environment**
   ```bash
   # Deploy to green subdomain
   wrangler pages deploy --branch green
   # Run smoke tests against green
   npm run test:smoke -- https://green.qesto.com
   ```

2. **Switch traffic**
   ```bash
   # Update CloudFlare routing rule
   # Route requests to green instead of blue
   wrangler pages publish --promote green
   ```

3. **Verify Green**
   - Monitor metrics for 2 minutes
   - Check user-reported issues

4. **Cleanup Blue (after 1 hour)**
   ```bash
   # If green is stable, remove blue
   wrangler pages delete --branch blue
   ```

**Rollback to Blue:**
```bash
wrangler pages publish --promote blue
```

---

### Release Checklist

Before deploying to production:

- [ ] All tests pass: `npm test`
- [ ] Type checking passes: `npm run typecheck`
- [ ] No design token violations: `npm run check:design-tokens`
- [ ] i18n keys complete: `npm run check:i18n`
- [ ] Bundle size OK: `npm run build` (no warnings)
- [ ] Code review approved
- [ ] Security scan cleared: `npm audit` (no critical vulns)
- [ ] Performance baseline met: `npm run perf:audit`
- [ ] Database migrations tested locally
- [ ] Stripe webhook endpoints verified
- [ ] Feature flags configured (if needed)

---

## Disaster Recovery

### D1 Database Restore (RPO < 15 min)

**When to use:** D1 data corruption, accidental deletion, catastrophic failure

**Steps:**

1. **Stop application** (prevent further writes)
   ```bash
   wrangler pages deploy --branch recovery  # Disable routes
   ```

2. **Restore from latest backup**
   ```bash
   # Cloudflare D1 automated backups (daily)
   # Request from Cloudflare support or use point-in-time restore
   wrangler d1 restore <db> --backup-id <backup-id>
   ```

3. **Verify data integrity**
   ```bash
   # Check row counts match expected
   wrangler d1 execute <db> --command "SELECT COUNT(*) FROM sessions"
   
   # Spot-check recent sessions are present
   wrangler d1 execute <db> --command "SELECT id, title FROM sessions ORDER BY created_at DESC LIMIT 5"
   ```

4. **Resume application**
   ```bash
   git push origin main  # Redeploy with restored data
   ```

**Post-recovery:** Analyze what caused corruption (incomplete transaction? race condition?).

---

### KV Namespace Restore (RPO < 5 min)

**When to use:** KV data loss (cache corruption, accidental deletes)

**Steps:**

1. **Identify scope**
   - Which keys are affected? (`cache:*`, `insights:*`, etc.)
   - When were they last good? (check timestamp in metadata)

2. **Restore from backup** (if available)
   ```bash
   # Manual backup strategy: periodic exports
   wrangler kv:key list --binding DECISIONS_KV --prefix cache: > backup.json
   
   # Restore from backup file
   cat backup.json | wrangler kv:key put --binding DECISIONS_KV
   ```

3. **Clear corrupted namespace and refill**
   ```bash
   # Clear all cache entries
   wrangler kv:key list --binding DECISIONS_KV --prefix cache: | while read key; do
     wrangler kv:key delete "$key" --binding DECISIONS_KV
   done
   
   # Cache will auto-repopulate on next access
   ```

---

### Session Archival (Space Management)

Run monthly to keep D1 size manageable.

```bash
# Archive sessions >6 months old
wrangler d1 execute <db> --command "
UPDATE sessions SET status = 'archived' 
WHERE status = 'closed' AND closed_at < datetime('now', '-6 months')
"

# Archive corresponding votes/audit
wrangler d1 execute <db> --command "
DELETE FROM votes WHERE session_id IN (
  SELECT id FROM sessions WHERE status = 'archived'
) AND created_at < datetime('now', '-12 months')
"
```

---

## Troubleshooting Guide

### Problem: "Session not found"

**Cause:** Session doesn't exist, user has wrong link, or data corrupted  
**Fix:**

```bash
# Verify session exists
wrangler d1 execute <db> --command "SELECT * FROM sessions WHERE code = 'ABC123'"

# If missing, user must create new session
# If corrupted (NULL fields), restore from backup
```

---

### Problem: WebSocket connection drops

**Cause:** DO crash, network timeout, client disconnected  
**Fix:**

```javascript
// Client should implement reconnect with exponential backoff
const connect = (url, retryCount = 0) => {
  const ws = new WebSocket(url)
  ws.onclose = () => {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
    setTimeout(() => connect(url, retryCount + 1), delay)
  }
}
```

---

### Problem: High KV latency

**Cause:** Cache miss flood, region-specific slowness  
**Fix:**

```bash
# Check KV metrics
wrangler kv:namespace list | grep DECISIONS_KV

# Clear cache and rebuild
wrangler kv:key delete '*' --binding DECISIONS_KV --prefix cache:

# Monitor cache hit rate
# Target: >80% for plan usage, leaderboard
```

---

### Problem: "Quota exceeded" on free plan

**Cause:** User hit session/participant limits  
**Fix:**

```bash
# Check usage
SELECT plan, sessions_used, sessions_limit FROM users WHERE email = 'user@example.com'

# Upgrade plan or delete old sessions
DELETE FROM sessions WHERE owner_id = ? AND status = 'archived' AND created_at < datetime('now', '-1 month')
```

---

## Alert Escalation

### Severity Levels

| Level | Condition | Action | Owner |
|-------|-----------|--------|-------|
| **P1 (Critical)** | Error rate >10%, All users affected | Page on-call, Immediate action | Engineering Lead |
| **P2 (High)** | Error rate 5-10%, Some users affected | Alert on-call within 15 min | Backend Engineer |
| **P3 (Medium)** | Latency spike >500ms p95, Specific routes | Investigate within 1 hour | DevOps |
| **P4 (Low)** | Minor issues, Performance advisory | Assess during next standup | Product |

### Escalation Path

1. **Alert triggered** → On-call engineer
2. **Not resolved in 15 min** → Engineering manager
3. **Not resolved in 30 min** → CTO
4. **Customer impact** → Notify support team immediately

---

## Training & Drills

### Monthly Runbook Review

- [ ] Review incident summaries from last month
- [ ] Update runbooks based on new learnings
- [ ] Verify all team members familiar with playbooks

### Quarterly Disaster Recovery Drill

- [ ] Simulate D1 restore (do it in test DB first)
- [ ] Simulate KV namespace loss
- [ ] Measure actual RTO/RPO
- [ ] Document gaps and action items

### Annual Security Audit

- [ ] Verify secrets rotation (Stripe keys, ANTHROPIC_API_KEY)
- [ ] Audit D1 backup retention (min 30 days)
- [ ] Verify KV backup strategy
- [ ] Check CloudFlare DDoS/WAF rules still active

---

## Contact & Escalation

| Role | On-Call | Contact |
|------|---------|---------|
| **Engineering Lead** | Rotating weekly | #on-call-incident Slack |
| **Database Admin** | Standby during business hours | @dba-team |
| **CloudFlare Support** | Enterprise plan 24/7 | support.cloudflare.com |
| **Stripe Support** | Enterprise plan 24/7 | dashboard.stripe.com/support |

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design decisions
- [SPEC.md](SPEC.md) — API contracts and data model
- [DEPLOYMENT.md](DEPLOYMENT.md) — CI/CD pipeline details
- [DATABASE_GOVERNANCE.md](DATABASE_GOVERNANCE.md) — Data retention & compliance
