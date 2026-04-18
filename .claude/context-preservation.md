# Agent Context Preservation — Qesto
# VERSION: v1.0.0
# OWNER: Architect
# SCOPE: Used when agents hand off work to each other or return in a new session

## Overview

Agents are designed to auto-revoke (forget context) after a task completes. However, some findings are **critical to preserve** across agent calls or sessions:

- Tech debt items discovered during implementation
- Performance baseline measurements
- Security findings or threat model changes
- Acceptance criteria test results
- Known issues or workarounds

This pattern defines how agents capture and hand off critical state.

---

## File Structure

```
.claude/
  .agent-state/                # Temporary state files (auto-cleanup after 24h)
    {STORY-ID}.json            # One file per story
    {FEATURE-NAME}.json        # Feature discovery state
    perf-baseline.json         # Performance measurements
    tech-debt-log.json         # Running log of discovered debt
    security-findings.json     # Security issues found
```

Each file is **self-contained JSON** — no implicit ordering or dependencies.

---

## Preservation Rules

### What Gets Preserved
✅ **Preserve**:
- New tech debt items (+ root cause)
- Performance measurements (baseline before/after)
- Security findings or CVE risks
- AC test mapping (which test covers which AC)
- Discovered unknowns or dependencies
- Defect reproduction steps

❌ **Don't Preserve**:
- Scratch work or exploration dead-ends
- Full file contents already committed
- Resolved tool errors (once fixed)
- Intermediate build artifacts
- Session-specific context (file paths, commands run)

### Lifetime
- **During task**: Agent can write to `.claude/.agent-state/` freely
- **At task end**: Agent must document what's preserved and why
- **After 24h**: Files auto-deleted (use `git add` to keep)
- **For sprint**: Important findings moved to `docs/BACKLOG.md` or `docs/SPRINT_PLAN.md`

---

## Agent Handoff Protocol

### When Task Ends
If you discovered findings that must survive:

1. **Check if file exists** (to append, not overwrite):
   ```bash
   if [[ -f .claude/.agent-state/tech-debt-log.json ]]; then
     # Append to existing
   else
     # Create new
   fi
   ```

2. **Write findings**:
   ```json
   {
     "story_id": "SES-001",
     "discovered_at": "2026-04-11T14:30:00Z",
     "agent": "backend-dev",
     "findings": [
       {
         "type": "tech-debt",
         "title": "SessionRoom DO lacks cleanup on idle",
         "severity": "medium",
         "root_cause": "No alarm set for inactive sessions > 30min",
         "impact": "Memory leak, DO cost grows",
         "suggested_fix": "Set alarm in onMessage() if idle",
         "story_id_for_fix": "optional-future-story-id"
       }
     ]
   }
   ```

3. **Document in session**:
   At end of session, include in final message:
   ```markdown
   ## Preserved Findings
   
   - Tech debt: SessionRoom idle cleanup (see .claude/.agent-state/tech-debt-log.json)
   - Perf baseline: KV hot read avg 3.2ms (see .claude/.agent-state/perf-baseline.json)
   
   These findings survive this session and should be reviewed before next sprint.
   ```

### When Task Resumes
If returning to incomplete work:

1. **Check preserved state**:
   ```bash
   cat .claude/.agent-state/{STORY-ID}.json
   ```

2. **Continue from where you left off**:
   - Preserved ACs are the source of truth (not commit history)
   - Preserved tech debt items are blockers for next sprint
   - Preserved perf measurements are the baseline for comparison

3. **Merge back into docs**:
   - Before final commit, move critical findings to `docs/BACKLOG.md` or sprint docs
   - Delete `.agent-state/` file once merged
   - Include merge note in commit message

---

## Preservation Templates

### Tech Debt Log
```json
{
  "version": "1.0.0",
  "last_updated": "2026-04-11T14:30:00Z",
  "entries": [
    {
      "id": "TD-001",
      "story_id": "SES-001",
      "title": "Session DO lacks idle cleanup",
      "severity": "medium",
      "root_cause": "No alarm triggered on inactivity",
      "impact": "Memory leak, cost overrun",
      "suggested_fix": "Set alarm after 30min idle",
      "estimated_effort": "2h",
      "priority": "P2",
      "discovered_date": "2026-04-11",
      "discoverer": "backend-dev"
    }
  ]
}
```

### Performance Baseline
```json
{
  "version": "1.0.0",
  "story_id": "PERF-001",
  "baseline_date": "2026-04-11T14:00:00Z",
  "measurements": [
    {
      "metric": "kv_hot_read_latency_ms",
      "before": 3.8,
      "after": 3.2,
      "improvement": "15.8%",
      "test_run_count": 100
    },
    {
      "metric": "do_cold_start_ms",
      "before": 85,
      "after": 72,
      "improvement": "15.3%",
      "test_run_count": 20
    }
  ]
}
```

### Acceptance Criteria Test Mapping
```json
{
  "version": "1.0.0",
  "story_id": "SES-001",
  "mapped_date": "2026-04-11T14:30:00Z",
  "ac_test_map": [
    {
      "ac_number": 1,
      "description": "GIVEN session DRAFT WHEN add question THEN appears in list",
      "test_file": "tests/unit/sessions.test.ts",
      "test_name": "POST /sessions/:id/questions",
      "test_status": "passing"
    },
    {
      "ac_number": 2,
      "description": "GIVEN session LIVE WHEN edit question THEN 403",
      "test_file": "tests/unit/sessions.test.ts",
      "test_name": "PATCH /sessions/:id/questions (LIVE check)",
      "test_status": "passing"
    }
  ]
}
```

### Security Findings
```json
{
  "version": "1.0.0",
  "story_id": "SEC-001",
  "findings_date": "2026-04-11T14:30:00Z",
  "findings": [
    {
      "type": "cwe",
      "cwe_id": "CWE-200",
      "title": "Stripe webhook secret not validated",
      "severity": "critical",
      "evidence": "stripe.ts:42 missing crypto.subtle.verify()",
      "risk": "Attacker can forge webhook events (refunds, charge-back claims)",
      "remediation": "Add HMAC signature check",
      "remediation_story": "SECURITY-001"
    }
  ]
}
```

---

## Auto-Cleanup Rules

Files in `.claude/.agent-state/` older than 24h are candidates for cleanup:

```bash
# Manual cleanup (before committing)
find .claude/.agent-state/ -mtime +1 -delete

# Or preserve important findings by moving to docs/
cp .claude/.agent-state/tech-debt-log.json docs/BACKLOG.md  # append to §4
rm .claude/.agent-state/tech-debt-log.json
```

---

## Integration with Sprint Planning

Before sprint planning:

1. **Inventory preserved state**:
   ```bash
   ls -la .claude/.agent-state/
   ```

2. **Review and triage**:
   - Tech debt → add to `docs/BACKLOG.md §4` with WSJF score
   - Perf findings → update `docs/BACKLOG.md §5` (Performance)
   - Security findings → add to `docs/BACKLOG.md §1` (P0 Defects) if critical

3. **Clean up**:
   ```bash
   git rm .claude/.agent-state/*.json
   git commit -m "Merge preserved findings into BACKLOG"
   ```

---

## Example: Backend Dev Hands Off to Frontend

### Backend Session Ends
Backend discovers: "KV hot read is slower than expected"

```bash
cat > .claude/.agent-state/perf-baseline.json << 'EOF'
{
  "story_id": "PERF-001",
  "metric": "kv_hot_read_latency_ms",
  "before": 5.2,
  "after": 3.8,
  "finding": "Still above 5ms target. Root cause: no caching layer for repeated reads"
}
EOF
```

Final message from backend:
```
## Preserved Findings

- KV hot read baseline: 3.8ms (target 5ms). May need caching layer.
  See .claude/.agent-state/perf-baseline.json
```

### Frontend Session Begins
Frontend reads preserved state:
```bash
cat .claude/.agent-state/perf-baseline.json
# → Understands KV perf is borderline
# → Avoids frequent refresh of same data
# → Implements local cache to reduce KV calls
```

Frontend updates measurement:
```bash
jq '.after = 3.2' .claude/.agent-state/perf-baseline.json
```

Before committing:
```bash
# Move to docs
echo "- PERF: KV hot read 3.8ms → 3.2ms (via caching)" >> docs/BACKLOG.md
rm .claude/.agent-state/perf-baseline.json
git add docs/BACKLOG.md
git commit -m "Reduce KV hot read latency via local caching"
```

---

## Change Log
- 2026-04-11: Created context preservation pattern v1.0.0
