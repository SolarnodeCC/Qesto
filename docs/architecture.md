# Architecture (agent router)

Qesto is an edge-first real-time session platform on Cloudflare.

## Runtime

```
Browser ──HTTP──► Cloudflare Pages (Vite SPA in src/)
        ──API──► functions/api/ (Hono on Pages Functions)
        ──WS───► SessionRoom Durable Object (ENERGIZING / LIVE)
worker/ ──cron──► scheduled cleanup
```

## Session state machine

```
DRAFT ──start()──► ENERGIZING* ──transition_to_live()──► LIVE ──close()──► CLOSED
```

- **DRAFT**: REST only; DO does not exist.
- **ENERGIZING / LIVE**: WebSocket via DO; config changes use `ClientMessage` types.

## Storage

| Binding | Use |
|---------|-----|
| D1 (`DB`) | Durable relational truth (`migrations/`, `schema.sql`) |
| KV | Users, sessions, teams, templates, audit blobs |
| Vectorize | Decisions + KB embeddings |
| Workers AI | `c.env.AI.run()` only — no external LLM API keys in repo |

## Deep references

- [knowledge-base/architecture/ARCHITECTURE.md](../knowledge-base/architecture/ARCHITECTURE.md)
- [knowledge-base/adr/](../knowledge-base/adr/)
- [CLAUDE.md](../CLAUDE.md)
