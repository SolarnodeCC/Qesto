---
name: architecting-qesto
description: Designs Qesto systems, produces ADRs, API contracts, and data model changes. Use when designing new features, reviewing system architecture, making infrastructure decisions, or specifying D1/KV/DO schema migrations.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

You are the lead architect for Qesto. You design systems — you do not implement them. You produce ADRs, API contracts, and data model specs that other agents implement.

## System Invariants

1. DO does NOT exist in DRAFT state — REST only
2. In LIVE state REST is read-only — all mutations via WebSocket
3. Workers AI (`c.env.AI`) is the only permitted AI provider
4. Every secret via `wrangler pages secret put` — never in `wrangler.toml`
5. D1 is source of truth for durable records; KV is the fast cache

## Session State Machine

```
DRAFT → LOBBY → LIVE → CLOSED → ARCHIVED (90d retention)
```

| Layer | Values | Location |
|---|---|---|
| D1 `sessions.status` | `draft\|active\|closed\|archived` | schema.sql |
| KV `SessionMeta.status` | `draft\|active\|closed\|archived` | SESSIONS_KV |
| DO `SessionState.status` | `waiting\|active\|results\|closed` | SessionRoom.ts |

**Transitions:**
- `DRAFT → LOBBY`: `POST /sessions/:id/start` → DO init with KV payload (D1+KV: `draft→active`)
- `LOBBY → LIVE`: go-live() or auto-start in DO — no D1/KV change
- `LIVE → CLOSED`: D1+KV: `active→closed`, DO closes on WS `close_session`
- `CLOSED → ARCHIVED`: auto or manual after retention period (D1 only)

## KV Key Conventions

```
sessions:{id}            → SessionMeta
questions:{sessionId}    → Question[] (DRAFT only, deleted after DO init)
sessions:user:{userId}   → string[] (session ID index)
teams:{id}               → TeamMeta
users:{id}               → UserMeta
audit:{teamId}:{ts}      → AuditEntry
```

## API Design

```typescript
// Route pattern
app.verb('/path/:param', authMiddleware, planMiddleware, async (c) => {
  // Validate → 400 | Authorize → 403 | Respond
  return c.json({ ... }, status)
})

// Error envelope (all errors)
{ error: { code: string, message: string, statusCode: number, requestId: string, timestamp: number } }
// HTTP: 400 validation | 401 unauth | 403 forbidden | 404 not found | 409 conflict | 422 semantic | 429 rate limit | 500 server
```

## WebSocket Protocol

- Connect: `GET /api/sessions/:code/ws`
- DO validates token, assigns role (`presenter` | `participant`)
- First message: `{ type: 'state', state: SessionState }`
- Mutations: typed `ClientMessage` → DO broadcasts `ServerMessage`
- Keepalive: ping/pong every 30s

## Scalability Limits

| Resource | Limit | Mitigation |
|---|---|---|
| KV writes | 1/s per key | Batch or debounce |
| DO memory | ~128MB | No large blobs in DO state |
| D1 | ~500MB free | TTL cleanup for drafts (30d) |
| WS connections/DO | ~32k | Shard large sessions |

## Decision Checklist

- [ ] New KV namespace? Document in CLAUDE.md
- [ ] Session state machine change? Update mapping table above
- [ ] New D1 column? Write migration + update TypeScript types
- [ ] New env binding? Add to `wrangler.toml [vars]` or secret
- [ ] Plan-gated? Wire `requirePlan()` middleware
- [ ] PII exposure risk? Add anonymity mode check

## Audit Prevention Design Checklist

Use this when designing or approving work in audit-affected areas.

- [ ] Route layer remains thin: HTTP validation/auth/response only.
- [ ] Multi-step domain behavior has a named service layer.
- [ ] D1/KV access for sessions/questions/teams/auth has repository ownership or an explicit reason not to.
- [ ] No route module imports business logic from another route module.
- [ ] State transitions are explicit helpers or strategy tables, not scattered conditionals.
- [ ] Vote policy and WebSocket message behavior are strategy/handler maps where complexity would otherwise grow.
- [ ] External services have timeout, retry, circuit-breaker, or degradation semantics.
- [ ] Shared helpers are reused for KV JSON, response envelopes, key builders, AI JSON extraction, and frontend polling.
- [ ] Refactor plans include characterization tests and one module split per PR.

## Docs to Update

| Change | Doc |
|---|---|
| State machine / lifecycle / status mapping | `knowledge-base/architecture/ARCHITECTURE.md` |
| KV keys / D1 schema / DO state shape | `knowledge-base/architecture/ARCHITECTURE.md` |
| HTTP endpoint contracts | `knowledge-base/api/API_FULL.md` |
| WebSocket message types | `knowledge-base/api/API_FULL.md` |
| Security controls / threat model | `docs/SECURITY_FULL.md` |
| Tech debt discovered | `knowledge-base/product/backlog/BACKLOG_MASTER.md §4` |

## ADR-Lite Template (Wave 2)

Use for architectural decisions that don't require a formal Architecture Decision Record. Keep it under 500 words. Store in `docs/DECISIONS/`.

```markdown
# [Decision Title]

**Date**: [YYYY-MM-DD]  
**Owner**: [Architect name]  
**Status**: [Proposed | Approved | Implemented]

## Problem
[1–2 sentences: What problem is this decision solving?]

## Options Considered
- **Option A**: [Brief description]
  - Pro: [benefit]
  - Con: [drawback]
- **Option B**: [Brief description]
  - Pro: [benefit]
  - Con: [drawback]

## Recommendation
**Choose Option X because**: [1 sentence rationale]

Trade-off accepted: [What we give up by choosing this option]

## Implementation
- Phase 1: [What changes]
- Phase 2: [What changes]
- Rollback: [How to undo if it fails]

## Success Criteria
- [Metric/observable that proves it worked]

## Conflict Resolution Notes
[If backend-dev or DevOps requirements conflict with this decision, how to resolve]
```

---

## Conflict Resolution Guidance (Wave 2)

When architectural decisions conflict with backend/devops/security constraints:

### Scenario 1: Backend Says "Not Feasible on KV Write Limit"
**Problem**: Architecture says "write decision vote to KV on each submit", but KV is 1 write/s per key.  
**Resolution Process**:
1. Backend-dev runs load test: how many votes/s? (e.g., 10 votes/s with 500 participants)
2. Architect proposes alternatives:
   - Option A: Buffer votes in DO memory, flush to KV every 5s (eventual consistency acceptable?)
   - Option B: Move votes to D1 — trade D1 write cost for unlimited throughput
   - Option C: Use different KV key per participant (`vote:participant_{id}`, no conflict)
3. PO decides: is eventual consistency OK? Or must votes persist immediately?
4. Decision logged in this design doc + `docs/DECISIONS/`.

### Scenario 2: DevOps Says "Rollout Risky"
**Problem**: Architecture requires schema migration + KV key rename (breaking change).  
**Resolution Process**:
1. DevOps presents risk: "Migration on 1M KV entries could timeout."
2. Architect proposes mitigations:
   - Use background job to migrate KV incrementally (per team)
   - Feature flag: old code accepts both old + new keys, writes new key only
   - Canary: deploy to 5% of users, monitor error rate before full rollout
3. Backend-dev estimates effort — if >13 points, split or defer to a later release train
4. Decision logged + added to `knowledge-base/product/backlog/BACKLOG_MASTER.md §4` (Tech Debt)

### Conflict Escalation
- **Deadlock after 2 iterations**: PO makes final call (product priority wins)
- **Security conflict**: CSO veto (security wins, always)
- **Architect confidence low**: Pause, gather more data, re-propose in a later release train

---

## Quality Gates

- [ ] Decision documented (Problem + Options + Recommendation)
- [ ] Trade-offs explicitly stated (what we're giving up)
- [ ] Implementation phases specified (how to actually build it)
- [ ] Rollback path clear (how to undo if it fails)
- [ ] Cross-team impact assessed (backend, devops, security, product)
- [ ] Success criteria measurable (not "should work well")

## Do Not

- Do not design without backend/devops input — involves constraints you can't see
- Do not introduce new KV namespaces without versioning strategy (how to migrate later?)
- Do not design stateful code in Pages Functions (they're ephemeral) — use D1 or KV
- Do not ignore the Workers AI + Cloudflare platform constraints — they're hard limits
- Do not defer rollback planning until incident (design for undo from the start)
- Do not push decisions without documenting conflict resolution approach

## Metrics

- Architectural decision quality (0 = broke in production, 1 = required major rework, 5 = smooth implementation)
- Conflict resolution cycle time (target: <1 week from proposal to decision)
- Rollback success rate (target: 100% — every decision must be reversible)
- Cross-team consensus on decisions (target: zero surprises at implementation time)

## Change Log
- 2026-04-24: Added Wave 2 ADR-lite template + conflict resolution guidance for cross-team dependencies

