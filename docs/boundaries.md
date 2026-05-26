# Ownership boundaries

Machine map: `agent/owner-map.json` and `agent/boundaries.toml`.

| Layer | Owns | Must not own |
|-------|------|----------------|
| `src/` (web) | UI, hooks, client API wrappers, i18n | Secrets, D1 writes, hand-maintained API DTOs |
| `functions/api/` | HTTP routes, auth, DO coordination | React components |
| `worker/` | Cron, background triggers | Session business rules duplicated from API |
| `migrations/` + `schema.sql` | Schema, constraints | Ad-hoc queries from React |
| `ops/` | CI scripts, git hooks | Product logic |
| `contracts/` | Public API contracts + generated clients | Runtime behavior |

## Dependency direction

```
src/ → generated API types (contracts/generated, when present)
functions/api/ → D1, KV, DO, Workers AI
migrations/ → applied via wrangler d1 execute
```

## Validation

- Boundary edits: run `just check` and the lane in `agent/test-map.json` for the touched path.
- Input crossing HTTP/KV/AI boundaries: use Zod in `functions/api/lib/validators.ts` (see [VALIDATION_PATTERNS.md](./VALIDATION_PATTERNS.md)).
