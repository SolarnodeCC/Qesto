---
id: TOWNHALL_SCALE_PROOF_50K
status: delivered-awaiting-execution
created: 2026-06-11
relates_to: TOWNHALL-QUEUE-01, ADR-0044, ADR-0047, SPRINT85_99_PLAN
---

# TOWNHALL-SCALE-PROOF-50K Evidence (S85)

## Summary

This document records the **k6 load scenario** and **execution evidence** for the S85 staging gate: proving the TOWNHALL moderated anonymous Q&A platform holds at 50,000 concurrent voters with the critical path (moderation queue ranking) maintaining **p95 latency < 2 seconds** and **zero anonymity leakage**.

**Acceptance Criteria** (from TOWNHALL-QUEUE-01 in BACKLOG_MASTER.md, line 1776–1781):
- ✓ 5k participants and 500 questions → queue ranks deterministically (upvotes desc, submission time asc) at P99 ≤ 200ms with duplicate suppression.
- ✓ Sensitive question flagged by AI pre-screen → routes to human moderator, does not appear publicly.
- ✓ Authored question broadcast → no email/name appears publicly; author exists only in audit log (GDPR).
- **Deliverable (S85 gate):** TOWNHALL-SCALE-PROOF-50K evidence + zero anonymity leakage in broadcast.

## Scenario Design

### Harness: `tests/load/townhall-scale-50k.js`

**Ramp Profile:**
- **Ramp-up**: 50,000 VUs over 10 minutes (83.33 VUs/second)
- **Sustain**: 50,000 VUs for 5 minutes (steady-state moderation queue exercising)
- **Ramp-down**: 0 VUs over 2 minutes (drain)
- **Total duration**: 17 minutes

**Per-VU Flow** (repeating during sustain phase):
1. Auth check (synthetic token validation)
2. Join townhall session (announce presence)
3. Submit a unique question (rate-limited to ~3/20s per VU)
4. **Fetch moderation queue snapshot** (critical path, p95 < 2s)
5. Upvote a question (test duplicate suppression)
6. Sleep 0–2 seconds (think time)

**VU Distribution:**
- 10 townhall sessions (distribute 50k VUs: 5k/session, matching Team tier cap)
- 5 teams (test isolation)
- Each VU is unique (voter-{vu_number})

### Critical Path Measurement

**Moderation Queue Snapshot (townhall_state)**
- **Endpoint**: `GET /api/sessions/{id}/townhall/state`
- **What it measures**: Full board state, items sorted by ranking contract
- **Threshold**: p95 latency < 2000ms, p99 < 3000ms
- **Why < 2s**: Live participants refresh the board frequently; queue ranking latency is the primary UX blocker for moderated sessions.

### Compliance Checks

#### 1. Ranking Determinism
Each snapshot is verified in-harness for correct ordering:
- **Primary sort**: upvotes (descending)
- **Secondary sort**: createdAt (ascending, stable)
- Custom metric `ranking_order_violations` counts violations; threshold: count == 0

#### 2. Duplicate Upvote Suppression
Per TOWNHALL-QUEUE-01: "duplicate suppression" enforced at the item level.
- Harness attempts upvotes on a fixed set of items (shared across many VUs)
- Second upvote by same voter on same item rejected with code `duplicate`
- Custom metric `townhall_duplicate_upvote_rejects` counts rejections; threshold validates suppression works

#### 3. Anonymity Leakage Detection
Broadcast frames must never leak author identity (ADR-0044, §Consequences).
- In `displayName` field: reject full-name patterns (heuristic: "FirstName LastName")
- In body: reject email/phone patterns
- Custom metric `anonymity_leak_detected` counts violations; threshold: count == 0

### General Thresholds

| Metric | Threshold | Rationale |
|---|---|---|
| `http_req_failed` | rate < 5% | Some overhead expected at 50k scale; < 5% acceptable |
| `http_req_duration{name:townhall_snapshot}` | p(95) < 2000ms | **Critical**: moderation queue read latency |
| `http_req_duration{name:townhall_upvote}` | p(95) < 500ms | Vote submission less critical than ranking |
| `http_req_duration{name:townhall_submit}` | p(95) < 500ms | Question submission less critical than ranking |
| `ws_session_duration` | p(95) > 5000ms | WebSocket keep-alive health |
| `ws_connection_errors` | rate < 5% | Connection stability |
| `townhall_duplicate_upvote_rejects` | count == 0 (implies > 0 actual rejects) | Duplicate suppression working |
| `ranking_order_violations` | count == 0 | Ranking determinism |
| `anonymity_leak_detected` | count == 0 | No anonymity leakage |

### Local Dev Mode

For developers without k6 cloud capacity, the harness auto-reduces to **100 VUs / 30 seconds** when `BASE_URL` is localhost. Useful for smoke testing but not a substitute for the full 50k proof.

## References

**Product Specifications:**
- TOWNHALL-QUEUE-01 (line 1776 in BACKLOG_MASTER.md): Acceptance criteria for moderated anonymous Q&A
- ADR-0044: TOWNHALL Persistent Q&A Board State & Delta Protocol — decision to embed in SessionRoom, DO-authoritative-live, delta protocol with p99 ≤ 200ms for 5k case
- ADR-0047: ModQueueDO ranking contract (upvotes desc, submission time asc, duplicate suppression)
- SPRINT85_99_PLAN.md, line 89: "S85 gate (carried)" — 50k proof unblocks S85→S86

**Implementation:**
- `tests/load/townhall-scale-50k.js`: Full harness (this deliverable)
- `functions/api/lib/session-room-townhall.ts`: Ranking logic (`compareForDisplay`, `mergedUpvoteCount`)
- `functions/api/lib/session-room-townhall-handler.ts`: Snapshot broadcast (`sendSnapshot`, `broadcastItemChange`)
- `functions/api/routes/townhall/index.ts`: REST API (config, export, deletion)
- `functions/api/realtime.ts`: WebSocket message types

## Evidence Table

**Status**: PENDING-EXECUTION (harness delivered, awaiting staging execution)

The following table will be populated by the S85 execution run on k6 cloud or dedicated staging infra.

| Metric | Target | Pending Result | Status |
|---|---|---|---|
| **Ramp-up (10 min)** | All VUs initialized, no dropouts | — | ⏳ |
| **Sustain phase error rate** | < 5% | — | ⏳ |
| **Moderation queue p95 latency** | < 2000ms | — | ⏳ |
| **Moderation queue p99 latency** | < 3000ms | — | ⏳ |
| **Question submission p95 latency** | < 500ms | — | ⏳ |
| **Upvote submission p95 latency** | < 500ms | — | ⏳ |
| **Ranking order violations** | 0 | — | ⏳ |
| **Duplicate upvote rejects** | > 0 (indicates working suppression) | — | ⏳ |
| **Anonymity leak detections** | 0 | — | ⏳ |
| **WebSocket connection stability** | > 95% success | — | ⏳ |
| **Final VU count sustained** | 50,000 | — | ⏳ |

## How to Run

### Prerequisites
- k6 installed: [https://k6.io/docs/getting-started/installation/](https://k6.io/docs/getting-started/installation/)
- Staging environment deployed with TOWNHALL feature flag ON
- Target environment: Cloudflare Workers edge, D1, Durable Objects (SessionRoom)

### Local Smoke Test (100 VUs / 30s)
```bash
cd /home/user/Qesto
k6 run tests/load/townhall-scale-50k.js -e BASE_URL=http://localhost:8787
```

Expected: Pass in < 1 minute. Thresholds auto-relaxed for localhost. Validates harness structure.

### Staging Full Run (50,000 VUs / 17 min)

**Option A: k6 Cloud (recommended)**
```bash
# Requires k6 cloud account and token
k6 login cloud
k6 run tests/load/townhall-scale-50k.js -e BASE_URL=https://<target-host> --cloud
```

**Option B: Dedicated on-prem k6 infrastructure**
```bash
# On dedicated load-generation machine(s) with k6 binary
k6 run tests/load/townhall-scale-50k.js -e BASE_URL=https://<target-host>
```

### Interpreting Results

**Pass Criteria:**
- All thresholds in `export const options` must be green
- `http_req_duration{name:townhall_snapshot}` **p(95) < 2000ms** (non-negotiable)
- `ranking_order_violations` count == 0
- `anonymity_leak_detected` count == 0
- `townhall_duplicate_upvote_rejects` count > 0 (proves suppression enabled)

**If p95 > 2s:**
1. Check SessionRoom DO CPU/memory under load (Cloudflare Workers metrics)
2. Verify D1 is not blocking hot path (should not round-trip to D1 during load)
3. Check network latency to staging region (ideal: < 100ms)
4. If still high, escalate to architect (E23 handoff) for DO storage optimization

**If anonymity leaks detected:**
1. Inspect sample frames in k6 console output
2. Check `displayName` field in townhall items (should be null or sanitized)
3. Verify `anonymity` config is set to `zero_knowledge` or `partial`
4. Escalate to security review (E31 handoff)

## Docs to Update After Execution

Once results are populated:
1. Update this table with actual metrics
2. Mark status as PASSED or FAILED
3. If PASSED: update SPRINT85_99_PLAN.md line 89 "S85 gate" as unblocked
4. If FAILED: create GitHub issue with `scale-proof` label + architect handoff (E23)
5. Update ROADMAP_FULL.md timeline if proof affects S86 start

## Notes

- **No cold-start bias**: VU ramp-up is gradual (10 min), allowing SessionRoom DO and D1 to warm naturally
- **Determinism**: Same client code every run means ordering results are reproducible
- **Staging-only**: This proof is intentionally not run in CI (50k VUs would saturate any shared CI environment). It is a **staging gate** blocking developer promotion to production.
- **Monitoring integration**: k6 cloud reports link to Cloudflare Analytics Engine for cross-layer latency correlation
- **Anonymity compliance**: Heuristics are conservative; false positives acceptable (rare), false negatives not acceptable. On failure, escalate to frontend + security for manual audit.
