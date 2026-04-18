# /investigate — Root-Cause Analyse (AGENT-007)
# VERSION: v1.1.0
# OWNER: QA
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md


## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.


## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

> **Doel**: Gestructureerde debug-workflow voor Durable Object- en WebSocket-problemen in Qesto.
> **Revoke na**: Einde van investigatie-sessie.

---

## 5-Staps Debug-Protocol

```
Stap 1 — REPRODUCEER
  → Minimaal reproduceerbaar scenario identificeren
  → Omgevingsvariabelen (LIVE vs DRAFT, verbinding)
  → Browser + device (mobiel vs desktop)

Stap 2 — OBSERVEER
  → Relevante CF Worker Logs ophalen (wrangler tail)
  → SessionRoom.ts logError entries analyseren
  → WebSocket close codes lezen (1001=away, 1006=abnormal, 4xxx=app)

Stap 3 — HYPOTHESE
  → Causale keten formuleren: "Als X, dan Y omdat Z"
  → Ruling-out lijst opstellen (wat het NIET is)

Stap 4 — TEST
  → Minimale code-wijziging om hypothese te bewijzen/weerleggen
  → Geen refactoring tijdens onderzoek — bewaar bestaande state

Stap 5 — CONCLUSIE
  → Root-cause formuleren in één zin
  → Fix of workaround documenteren
  → Backlog-item aanmaken als structurele fix > 30 min
```

---

## WS / Durable Object Checklist

### Verbinding
- [ ] `SESSION_ROOM` binding aanwezig in `wrangler.toml`?
- [ ] DO-naam komt overeen: `env.SESSION_ROOM.idFromName(sessionId)`
- [ ] Client stuurt `Authorization: Bearer <token>` header bij WS-upgrade?
- [ ] WS-URL eindigt op `/ws` of `/api/sessions/:id/ws`?

### DO-State na Hibernation
- [ ] `webSocketMessage` → `getTags(ws)` gebruikt — niet in-memory map na herstart?
- [ ] `voterMeta` map wordt herbouwd vanuit tags (zie `SessionRoom.ts:86-89`)?
- [ ] `emojiRateLimits` map — acceptabel dat die leegloopt na hibernation?

### Alarm & Timer
- [ ] `alarm()` — `status === 'closed'` → `deleteAll()` correct?
- [ ] `alarm()` — clock-drift guard aanwezig (500ms tolerantie)?
- [ ] `deleteAlarm()` aangeroepen vóór `setAlarm()` bij timer-reset?

### Broadcast
- [ ] `broadcastToRole('presenter', ...)` vs `broadcast(...)` — juiste keuze?
- [ ] WS `send` errors gelogd via `logError`?
- [ ] Disconnected clients verwijderd uit `getWebSockets()` automatisch (CF doet dit)?

### Veelvoorkomende Bugs

| Symptoom | Meest Waarschijnlijke Oorzaak |
|---|---|
| Vote verdwijnt na DO-restart | `voterMeta` niet herbouwd vanuit tags |
| Timer stopt vroeg | Clock-drift niet opgevangen in `alarm()` |
| Presenter ziet stemmen niet | `broadcast` verkeerde role-filter |
| DO reageert niet na `closeSession()` | Alarm niet gecleard vóór nieuw alarm |
| WS disconnect loop | Token verlopen; client herverbindt zonder nieuw token |
| Emoji rate limit werkt niet | `emojiRateLimits` map leeg na hibernation — verwacht gedrag |

---

## Loganalyse Commando's

```bash
# Live logs van de Worker (vervang naam)
wrangler tail qesto --format pretty

# Filter op logError entries
wrangler tail qesto --format json | jq 'select(.logs[].message | test("error:"))'

# DO-specifieke logs (zoek op sessionId)
wrangler tail qesto --format json | jq 'select(.logs[].message | test("<sessionId>"))'
```

---

## Escalatie-Criteria

Schaal op naar architect als:
1. Root-cause niet gevonden binnen 2 iteraties van stap 4
2. Fix vereist wijziging in DO-migratie (`[[migrations]]` in `worker/wrangler.toml`)
3. Bug reproduceerbaar alleen in productie (niet in lokale `wrangler dev`)
4. Betrokken bij billing/Stripe-state

---

## Output-Template

```markdown
## Investigatie Rapport — <datum>

**Probleem**: <1-zin beschrijving>
**Omgeving**: <LIVE|DRAFT> · <Browser/mobiel> · <sessionId indien relevant>

**Root-Cause**: <1-zin causale verklaring>

**Bewijs**:
- Log-regel: `[...]`
- Code-locatie: `SessionRoom.ts:nn`

**Fix**: <code-wijziging of workaround>

**Preventie**: <backlog-item aanmaken? Ja/Nee — ID>
```

## Change Log
- 2026-04-10: Canonicalized file headers and shared rules reference.
