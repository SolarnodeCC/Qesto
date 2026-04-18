# /investigate — Root-Cause Analysis (AGENT-007)
# VERSION: v1.2.0
# OWNER: QA
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md

## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

> **Goal**: Structured debug workflow for Durable Object and WebSocket issues in Qesto.
> **Revoke after**: End of investigation session.

---

## 5-Step Debug Protocol

```
Step 1 — REPRODUCE
  → Identify minimal reproducible scenario
  → Environment variables (LIVE vs DRAFT, connection type)
  → Browser + device (mobile vs desktop)

Step 2 — OBSERVE
  → Fetch relevant CF Worker logs (wrangler tail)
  → Analyse SessionRoom.ts logError entries
  → Read WebSocket close codes (1001=away, 1006=abnormal, 4xxx=app)

Step 3 — HYPOTHESISE
  → Formulate causal chain: "If X, then Y because Z"
  → Build ruling-out list (what it is NOT)

Step 4 — TEST
  → Minimal code change to prove or disprove hypothesis
  → No refactoring during investigation — preserve existing state

Step 5 — CONCLUDE
  → Root cause in one sentence
  → Document fix or workaround
  → Create backlog item if structural fix > 30 min
```

---

## WS / Durable Object Checklist

### Connection
- [ ] `SESSION_ROOM` binding present in `wrangler.toml`?
- [ ] DO name matches: `env.SESSION_ROOM.idFromName(sessionId)`?
- [ ] Client sends `Authorization: Bearer <token>` header on WS upgrade?
- [ ] WS URL ends in `/ws` or `/api/sessions/:id/ws`?

### DO State after Hibernation
- [ ] `webSocketMessage` → `getTags(ws)` used — not in-memory map after restart?
- [ ] `voterMeta` map rebuilt from tags (see `SessionRoom.ts:86-89`)?
- [ ] `emojiRateLimits` map — acceptable that it resets after hibernation?

### Alarm & Timer
- [ ] `alarm()` — `status === 'closed'` → `deleteAll()` correct?
- [ ] `alarm()` — clock-drift guard present (500ms tolerance)?
- [ ] `deleteAlarm()` called before `setAlarm()` on timer reset?

### Broadcast
- [ ] `broadcastToRole('presenter', ...)` vs `broadcast(...)` — right choice?
- [ ] WS `send` errors logged via `logError`?
- [ ] Disconnected clients removed from `getWebSockets()` automatically (CF handles this)?

### Common Bugs

| Symptom | Most Likely Cause |
|---|---|
| Vote disappears after DO restart | `voterMeta` not rebuilt from tags |
| Timer stops early | Clock-drift not handled in `alarm()` |
| Presenter doesn't see votes | `broadcast` wrong role filter |
| DO unresponsive after `closeSession()` | Alarm not cleared before new alarm |
| WS disconnect loop | Token expired; client reconnects without new token |
| Emoji rate limit not working | `emojiRateLimits` map empty after hibernation — expected behaviour |

---

## Log Analysis Commands

```bash
# Live logs from the Worker
wrangler tail qesto --format pretty

# Filter on logError entries
wrangler tail qesto --format json | jq 'select(.logs[].message | test("error:"))'

# DO-specific logs (search by sessionId)
wrangler tail qesto --format json | jq 'select(.logs[].message | test("<sessionId>"))'
```

---

## Escalation Criteria

Escalate to architect if:
1. Root cause not found within 2 iterations of step 4
2. Fix requires change to DO migration (`[[migrations]]` in `worker/wrangler.toml`)
3. Bug only reproducible in production (not in local `wrangler dev`)
4. Involves billing/Stripe state

---

## Output Template

```markdown
## Investigation Report — <date>

**Problem**: <1-sentence description>
**Environment**: <LIVE|DRAFT> · <Browser/mobile> · <sessionId if relevant>

**Root Cause**: <1-sentence causal explanation>

**Evidence**:
- Log line: `[...]`
- Code location: `SessionRoom.ts:nn`

**Fix**: <code change or workaround>

**Prevention**: <create backlog item? Yes/No — ID>
```

## Change Log
- 2026-04-18: Translated to English, removed duplicate Shared Rules header.
- 2026-04-10: Canonicalized file headers and shared rules reference.
