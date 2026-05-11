# Observability Incident: Analytics Engine Schema Gaps

**Date**: 2026-04-24  
**Severity**: P1 (blocks north-star metric computation)  
**Owner**: Backend-dev + Architect  
**Status**: Open

---

## Summary

Wave 2 data quality audit (analytics skill runbook) detected three infrastructure gaps that prevent Analytics Engine from computing critical metrics:

1. **OBS-001**: Missing `team_id` in sessions table → `blob3` always empty → north-star metric uncomputable
2. **OBS-002**: `signup` event has no `teamId` context → cannot attribute acquisition to teams
3. **OBS-003**: `first_session_started` event not instrumented → activation funnel blocked

**Impact**: May 2026 scorecard cannot report:
- Sessions per active team per month (north star)
- Signup → first-session activation rate
- Churn signals by team

**Root cause**: Original D1 schema design did not include `team_id` on sessions. Events now fire, but lack team context.

---

## Incident Timeline

| Time | Event |
|---|---|
| 2026-04-24 13:00 | Observability instrumentation complete (signup, session.started, session.closed events added) |
| 2026-04-24 13:15 | Analytics audit runs; discovers schema gaps |
| 2026-04-24 13:20 | This incident created |

---

## Technical Details

### OBS-001: Add `team_id` to Sessions Table

**Problem**: `sessions` table (schema.sql:42–58) has no `team_id` column. When `session.started` fires, `blob3` is set to empty string (not null), collapsing all team metrics into a single unnamed bucket.

**Solution**:
```sql
ALTER TABLE sessions ADD COLUMN team_id TEXT DEFAULT NULL;
CREATE INDEX idx_sessions_team_id ON sessions(team_id);
UPDATE sessions SET team_id = (SELECT team_id FROM teams WHERE id = sessions.owner_id); -- backfill
```

**Effort**: 1 story (D1 migration + backfill + null handling)

**Blocker**: None — can be done immediately, no data loss risk.

---

### OBS-002: Move `signup` teamId to `team_created` Event

**Problem**: At magic-link auth (signup), the user has no team yet. `writeEvent()` is called with `teamId: undefined`, which becomes empty string in blob3.

**Solution**: 
- Remove `teamId` from signup event (populate only userId + plan)
- Add `team_created` event at `POST /api/teams` route (populate teamId + userId)
- Adjust activation funnel query to use `team_created` as the team attribution point, not `signup`

**Effort**: 0.5 story (add call site + adjust AQL queries)

**Blocker**: None.

---

### OBS-003: Implement `first_session_started` Event

**Problem**: `first_session_started` event is defined in analytics.md but never fired from code. Required for activation funnel (`first_session_started / signup`).

**Solution**:
```typescript
// In sessions.ts POST /:id/start, after session transitions to LIVE:
const isFirstSession = await c.env.DB.prepare(
  'SELECT COUNT(*) as n FROM sessions WHERE owner_id = ?1 AND status != ?2 AND id != ?3'
).bind(user.sub, 'draft', id).first<{ n: number }>();

if (isFirstSession?.n === 0) {
  writeEvent(c.env.METRICS_AE, {
    name: 'first_session_started',
    userId: user.sub,
    teamId: session.team_id, // requires OBS-001
    plan: c.get('plan'),
    traceId,
  });
}
```

**Effort**: 0.5 story (add query + conditional event)

**Blocker**: Depends on OBS-001 (needs `session.team_id`).

---

## Blocking Metrics

| Metric | Blocker | Workaround |
|---|---|---|
| Sessions per active team per month | OBS-001 | None — north-star is unmeasurable without team_id |
| Signup → first-session activation rate | OBS-003 | None — will show 0% until implemented |
| Churn signal (no session in 14d per team) | OBS-001 | None — segments on blob3 which is empty |

---

## May 2026 Scorecard Impact

- ✅ Raw event counts (signup, session.started, session.closed) available
- ✅ Plan segmentation works
- ❌ North-star metric (sessions/active_team) uncomputable
- ❌ Activation funnel uncomputable
- ❌ Churn detection uncomputable

**Recommendation**: Report May scorecard as "Partial: 3 events firing, 3 critical metrics blocked on schema migration."

---

## Lessons Learned (Wave 2 Value)

This incident demonstrates why Wave 2 operational runbooks exist:

1. **Data quality audit caught silent failure** — Without weekly audit, metrics would be computed wrong for weeks before anyone noticed (all teams collapsed into one bucket).
2. **Event instrumentation incomplete without schema support** — Firing events is only half the battle; they must have the context (teamId) to be useful.
3. **Runbook unblocked immediate action** — Within 24 hours of audit, schema gaps are identified and prioritized.

---

## Resolution Path

**Week 1 (Priority)**:
1. Implement OBS-001: Add `team_id` column + backfill + index (1 story)
2. Implement OBS-002: Move `signup` → `team_created` (0.5 story)

**Week 2**:
1. Implement OBS-003: Add `first_session_started` call site (0.5 story)

**Week 3**:
1. Re-run analytics audit; verify all three blockers cleared
2. Publish corrected May scorecard with north-star + activation metrics

---

## Escalation

- **Backend-dev**: Add team_id column + backfill + implement first_session_started
- **Architect**: Review schema migration plan for safety (concurrent writes during backfill)
- **Analytics**: Re-run weekly audit after fixes; update May scorecard
- **PO**: Gate May scorecard publication on OBS-001/002/003 completion

---

## Sign-off

**Discovered by**: analytics agent (Wave 2 data quality audit runbook)  
**Severity**: P1 (blocks north-star metric)  
**Status**: Open, assigned to backend-dev + architect

---

## Change Log

- 2026-04-24: Incident created. Wave 2 observability instrumentation complete, but schema gaps identified. Three blockers (OBS-001, OBS-002, OBS-003) documented.
