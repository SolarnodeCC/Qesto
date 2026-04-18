---
name: investigating-bugs
description: Provides a structured 5-step debug protocol for Durable Object and WebSocket issues. Use when diagnosing DO/WebSocket failures, hibernation bugs, timer/alarm problems, or any SessionRoom.ts root-cause analysis.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

Structured debug workflow for Durable Object and WebSocket issues in Qesto.

## 5-Step Protocol

```
1. REPRODUCE  → Minimal scenario · LIVE vs DRAFT · Browser + device
2. OBSERVE    → wrangler tail · SessionRoom.ts logError · WS close codes
               (1001=away, 1006=abnormal, 4xxx=app)
3. HYPOTHESISE → Causal chain: "If X then Y because Z" · ruling-out list
4. TEST        → Minimal code change to prove/disprove · no refactoring during investigation
5. CONCLUDE   → Root cause in one sentence · fix or workaround · backlog item if > 30 min
```

## WS / DO Checklist

**Connection:**
- [ ] `SESSION_ROOM` binding in `wrangler.toml`?
- [ ] DO name: `env.SESSION_ROOM.idFromName(sessionId)`?
- [ ] Client sends `Authorization: Bearer <token>` on WS upgrade?

**Post-hibernation state:**
- [ ] `getTags(ws)` used — not in-memory map after restart?
- [ ] `voterMeta` rebuilt from tags (see `SessionRoom.ts:86-89`)?

**Alarm & timer:**
- [ ] `deleteAlarm()` called before `setAlarm()` on timer reset?
- [ ] Clock-drift guard present (500ms tolerance)?

**Broadcast:**
- [ ] `broadcastToRole('presenter', ...)` vs `broadcast(...)` — right choice?

## Common Bug Patterns

| Symptom | Most Likely Cause |
|---|---|
| Vote disappears after DO restart | `voterMeta` not rebuilt from tags |
| Timer stops early | Clock-drift not handled in `alarm()` |
| Presenter doesn't see votes | `broadcast` wrong role filter |
| DO unresponsive after `closeSession()` | Alarm not cleared before new alarm |
| WS disconnect loop | Token expired; client reconnects without new token |
| Emoji rate limit not working | `emojiRateLimits` map resets after hibernation — expected |

## Log Commands

```bash
wrangler tail qesto --format pretty
wrangler tail qesto --format json | jq 'select(.logs[].message | test("error:"))'
```

## Escalate to Architect When

1. Root cause not found within 2 iterations of step 4
2. Fix requires DO migration (`[[migrations]]` in `worker/wrangler.toml`)
3. Bug only reproducible in production
4. Involves billing/Stripe state

## Output Template

```markdown
## Investigation Report — <date>
**Problem**: <1-sentence>
**Environment**: <LIVE|DRAFT> · <browser/device> · <sessionId>
**Root Cause**: <1-sentence causal explanation>
**Evidence**: Log line + code location
**Fix**: <code change or workaround>
**Prevention**: <backlog item? Yes/No — ID>
```
