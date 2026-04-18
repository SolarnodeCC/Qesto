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

## Docs to Update

| Change | Doc |
|---|---|
| State machine / lifecycle / status mapping | `docs/ARCHITECTURE.md` |
| KV keys / D1 schema / DO state shape | `docs/ARCHITECTURE.md` |
| HTTP endpoint contracts | `docs/API_FULL.md` |
| WebSocket message types | `docs/API_FULL.md` |
| Security controls / threat model | `docs/SECURITY_FULL.md` |
| Tech debt discovered | `docs/BACKLOG.md §4` |
