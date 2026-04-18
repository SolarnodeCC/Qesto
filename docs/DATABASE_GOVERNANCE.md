# Database Governance Policy (Sprint 18 - ID 6)

## Overview

Establishes query performance budgets, indexing strategy, and optimization standards for D1 (SQLite on Cloudflare).

**Performance Budget:** p95 latency ≤ 100ms for user-facing queries

**Deadline:** All queries must be profiled and optimized before merge

---

## 1. Performance Budget

### User-Facing Queries (Synchronous)
- **p95 latency target:** ≤ 100ms
- **p99 latency target:** ≤ 500ms
- **timeout:** Hard limit 30 seconds (query killed)

### Background Queries (Async)
- **p95 latency target:** ≤ 5 seconds
- **timeout:** Hard limit 5 minutes

### Batch Operations
- **p95 latency target:** ≤ 2 seconds per 100 rows
- **timeout:** Hard limit 60 seconds

---

## 2. Query Optimization Guidelines

### ✅ DO
```sql
-- ✅ Use explicit column lists
SELECT id, user_id, title, status FROM sessions WHERE team_id = ? LIMIT 50

-- ✅ Add indexes on filter columns
CREATE INDEX idx_sessions_team_id ON sessions(team_id)

-- ✅ Use batch queries to prevent N+1
SELECT * FROM decisions WHERE session_id IN (?, ?, ?)

-- ✅ Use EXPLAIN QUERY PLAN to check execution
EXPLAIN QUERY PLAN SELECT * FROM sessions WHERE team_id = ? AND status = 'active'

-- ✅ Add coverage indexes for covered queries
CREATE INDEX idx_sessions_team_status ON sessions(team_id, status) INCLUDE (title, created_at)
```

### ❌ DON'T
```sql
-- ❌ SELECT * (fetch unused columns)
SELECT * FROM sessions WHERE team_id = ?

-- ❌ N+1 pattern (loop + query)
for sessionId in sessionIds:
  SELECT * FROM sessions WHERE id = sessionId  // BAD: one query per loop

-- ❌ Unindexed WHERE clauses
SELECT * FROM decisions WHERE motivation LIKE '%search%'  // Sequential scan

-- ❌ OFFSET for pagination (use seek instead)
SELECT * FROM sessions LIMIT 50 OFFSET 1000  // BAD: scans 1000 rows

-- ❌ Missing JOIN indexes
SELECT s.*, d.* FROM sessions s
  LEFT JOIN decisions d ON s.id = d.session_id
  WHERE s.team_id = ?  // Missing index on decisions.session_id
```

---

## 3. Indexing Strategy

### High-Frequency Columns (Must Index)
- `sessions.team_id` → High cardinality, frequent filter
- `sessions.owner_id` → High cardinality, user-specific queries
- `decisions.session_id` → Foreign key, JOIN predicate
- `audit_log.team_id` → Filter by organization
- `audit_log.user_id` → Filter by actor
- `audit_log.created_at` → Time-based range queries

### Composite Indexes (Coverage)
```sql
-- Sessions by team + status (status filter + title projection)
CREATE INDEX idx_sessions_team_status ON sessions(team_id, status) INCLUDE (title, created_at)

-- Decisions by session + type
CREATE INDEX idx_decisions_session_type ON decisions(session_id, consent_mode) INCLUDE (selected_option)

-- Audit log by team + type (audit trail retrieval)
CREATE INDEX idx_audit_team_type ON audit_log(team_id, event_type) INCLUDE (entity_id, user_id, created_at)
```

### Indexes to Avoid
- ❌ Text search columns (use full-text index if needed, not regular index)
- ❌ Boolean columns (too low cardinality, seq scan often better)
- ❌ Foreign keys with <5% cardinality

---

## 4. Query Profiling Checklist

Before merging any query:

- [ ] Run `EXPLAIN QUERY PLAN` and check for sequential scans
- [ ] Measure p95 latency in staging (test with realistic data volume)
- [ ] Check if N+1 pattern present (loop + query = bad)
- [ ] Verify indexes exist for all WHERE/JOIN predicates
- [ ] Add explicit column lists (no SELECT *)
- [ ] If pagination, use keyset (seek) not OFFSET
- [ ] Add performance comment in code:
  ```typescript
  // PERF: p95 latency ~15ms, indexed on (team_id, status)
  const result = await db.prepare('SELECT id, title FROM sessions WHERE team_id = ? AND status = ?')
    .bind(teamId, 'active')
    .all()
  ```

---

## 5. Common Queries + Their Budgets

### User Session History
```typescript
// PERF: p95 ~5ms (indexed on owner_id + created_at)
const sessions = await db.prepare(`
  SELECT id, title, status, created_at FROM sessions
  WHERE owner_id = ?
  ORDER BY created_at DESC
  LIMIT 50
`).bind(userId).all()
```
- **Index needed:** `idx_sessions_owner_id`
- **Budget:** ≤ 10ms

### Session with Decisions
```typescript
// PERF: p95 ~20ms (indexed on session_id)
const decisions = await db.prepare(`
  SELECT d.* FROM decisions d
  WHERE d.session_id = ?
  ORDER BY d.created_at DESC
`).bind(sessionId).all()
```
- **Index needed:** `idx_decisions_session_id`
- **Budget:** ≤ 50ms

### Team Audit Trail
```typescript
// PERF: p95 ~30ms (composite index on team_id + created_at)
const logs = await db.prepare(`
  SELECT * FROM audit_log
  WHERE team_id = ?
  AND created_at > ?
  ORDER BY created_at DESC
  LIMIT 100
`).bind(teamId, sevenDaysAgo).all()
```
- **Index needed:** `idx_audit_team_created` (team_id, created_at)
- **Budget:** ≤ 100ms

---

## 6. Monitoring

### Metrics to Track
- **p95 query latency** by query type (sessions, decisions, audit)
- **sequential scans** per day (should be ~0)
- **queries exceeding budget** (alert if >5 per day)
- **query execution time distribution** (daily report)

### Alert Thresholds
- ⚠️ **WARNING:** p95 latency > 100ms for user-facing query
- 🚨 **CRITICAL:** p99 latency > 500ms (SLA breach)
- 🔥 **EMERGENCY:** Sequential scan on table > 1M rows

---

## 7. Optimization Workflow

1. **Identify slow query** (from error tracking or monitoring)
2. **Explain it:** `EXPLAIN QUERY PLAN <query>`
3. **Check indexes:** Are all filter/join columns indexed?
4. **Add/fix index:** `CREATE INDEX idx_...`
5. **Re-measure:** p95 latency in staging
6. **Document:** Add PERF comment to code
7. **Deploy + monitor:** Watch metrics for regression

---

## 8. Emergency: Queries Over Budget

If query exceeds budget:
1. **Don't merge** (block PR unless exempted)
2. **Investigate:**
   - Missing index?
   - N+1 pattern?
   - Too much data selected?
3. **Fix:** Usually index or restructure query
4. **Test:** Re-measure with staging data
5. **Document:** In code comment why query is slow + plan to fix

---

## CI Gate

All queries must pass:
```bash
# Check for SELECT * (forbidden)
git diff HEAD -- '*.ts' '*.js' | grep -i "SELECT \*" && echo "FAIL: SELECT * found" && exit 1

# Check for missing indexes on high-cardinality filters
# (CI script validates index coverage)

# Measure query latency (post-merge monitoring)
```

---

## References

- [SQLite EXPLAIN](https://www.sqlite.org/eqp.html)
- [Covering Indexes](https://www.sqlite.org/covering.html)
- [Query Optimizer](https://www.sqlite.org/queryplanner.html)
- Cloudflare D1 Docs: Performance Tuning
