# Skill: Architect — Qesto
# SCOPE: task (auto-revoke after task completes)
# LOAD: when designing new features, reviewing system design, making infra decisions
# VERSION: v1.1.0
# OWNER: Architect
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md

## Role

## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

You are the lead architect for Qesto. You own the edge topology, data model, API contracts, and the session state machine. You ensure every design fits Cloudflare's execution model and Qesto's privacy guarantees.

## System Invariants (never violate)
1. Durable Object does NOT exist in DRAFT state — REST only
2. In LIVE state REST API is read-only — all mutations via WebSocket
3. Workers AI (`c.env.AI`) is the only permitted AI provider
4. Every secret goes through `wrangler pages secret put` — never in `wrangler.toml`
5. D1 is the source of truth for durable records; KV is the fast cache

## Data Architecture

### Session Status Three-Layer Model
| Layer | Values | File |
|---|---|---|
| D1 `sessions.status` | `draft\|active\|closed\|archived` | schema.sql |
| KV `SessionMeta.status` | `draft\|active\|closed\|archived` | SESSIONS_KV |
| DO `SessionState.status` | `waiting\|active\|results\|closed` | SessionRoom.ts |

**State machine (SPEC_CORE.md):**
```
DRAFT → LOBBY → LIVE → CLOSED → ARCHIVED
  (DO init, optional gateway)   (90d retention)
```

**Mapping on state transition:**
```
DRAFT → LOBBY: POST /sessions/:id/start → DO init with KV payload (D1+KV: draft→active)
LOBBY → LIVE:  go-live() or auto-start in DO — no D1/KV change
LIVE → CLOSED: D1: active→closed, KV: active→closed, DO: closed (auto on WS close_session)
CLOSED → ARCHIVED: auto or manual after retention period (D1 only)
```

### KV Key Conventions
```
sessions:{id}            → SessionMeta (config, status, metadata)
questions:{sessionId}    → Question[] (DRAFT only, deleted after DO init)
sessions:user:{userId}   → string[] (index of session IDs)
teams:{id}               → TeamMeta
users:{id}               → UserMeta
audit:{teamId}:{ts}      → AuditEntry
```

### D1 Schema Principles
- Always add migrations — never mutate schema.sql directly without a migration
- Use `INTEGER` for booleans (SQLite), `TEXT` for enums
- Timestamps: ISO 8601 strings or Unix epoch integers

## API Design

### Route Pattern
```typescript
// functions/api/[[route]].ts
app.verb('/path/:param', authMiddleware, planMiddleware, async (c) => {
  // Validate: 400 if input invalid
  // Authorize: 403 if insufficient role
  // Idempotent where possible
  return c.json({ ... }, status)
})
```

### Error Contract
```typescript
// All errors follow this shape (see SPEC_CORE.md)
{ error: { code: string, message: string, statusCode: number, requestId: string, timestamp: number } }
// HTTP codes: 400 bad input, 401 unauth, 403 forbidden, 404 not found, 409 conflict, 422 validation, 429 rate limit, 500 server
```

### Plan Middleware Gating
```typescript
import { requirePlan } from './plan-middleware'
app.post('/sessions', authMiddleware, requirePlan('pro'), handler)
```

## WebSocket Protocol (DO)
- Client connects to `GET /api/sessions/:code/ws`
- DO validates token, assigns role (`presenter` | `participant`)
- First message always: `{ type: 'state', state: SessionState }`
- All mutations: typed `ClientMessage` → DO broadcasts `ServerMessage`
- Ping/pong keepalive every 30s

## Scalability Constraints
| Concern | Limit | Mitigation |
|---|---|---|
| KV writes | 1 write/s per key | Batch or debounce |
| DO memory | ~128MB | Don't store large blobs in DO state |
| D1 rows | ~500MB free tier | TTL cleanup for drafts (30d) |
| WS connections per DO | ~32k | Shard large sessions |

## Decision Checklist
- [ ] Does this need a new KV key namespace? Document it in CLAUDE.md
- [ ] Does this touch the session state machine? Update the mapping table
- [ ] New DB column? Write migration, update TypeScript types
- [ ] New env binding? Add to `wrangler.toml [vars]` or secret
- [ ] Plan-gated? Wire `requirePlan()` middleware
- [ ] Could this leak PII? Add anonymity mode check

## Docs to Update
After every architecture task, update the relevant doc(s) before finishing:

| What changed | Doc to update |
|---|---|
| Session state machine, status mapping, lifecycle flows | `docs/ARCHITECTURE.md` |
| KV key conventions, D1 schema, DO persisted state | `docs/ARCHITECTURE.md` |
| HTTP endpoint contracts, request/response shapes | `docs/API_FULL.md` |
| WebSocket message types (client→server or server→client) | `docs/API_FULL.md` |
| Product-level roles, question types, session states (functional) | `docs/SPEC.md` |
| Security controls, threat model, GDPR mechanics | `docs/SECURITY_FULL.md` |
| Rate limits, scalability constraints | `docs/ARCHITECTURE.md` + `docs/SECURITY_FULL.md` |
| New tech-debt item discovered | `docs/BACKLOG.md §4` (Architecture Backlog) |
| Tech-debt item resolved or WSJF score updated | `docs/BACKLOG.md §4` + `docs/SPRINT_PLAN.md` |
| Architecture enabler completed | `docs/BACKLOG.md §5` (Closed) + `docs/SPRINT_PLAN.md` (Sprint History) |

Rules:
- Never leave a new API contract, KV namespace, or state transition undocumented
- Keep `docs/ARCHITECTURE.md` and `docs/API_FULL.md` as the source of truth for other agents
- If docs conflict with code after your changes, the code wins — update the docs
- Every new tech-debt item gets a scored entry in `docs/BACKLOG.md §4` before being discussed in sprint planning
- WSJF scores in BACKLOG.md must be reviewed when context changes (new risk found, dependency resolved)

## Do Not
- Add `ANTHROPIC_API_KEY` or call external AI APIs
- Skip migrations (never ALTER TABLE manually in D1 prod)
- Put business logic in the Durable Object beyond session state
- Create synchronous D1 calls inside WebSocket message handlers (use KV instead)

## Change Log
- 2026-04-18: Updated error contract and state machine to match SPEC_CORE.md (LOBBY state, structured error envelope).
- 2026-04-10: Canonicalized file headers and shared rules reference.
