# API contracts

Public HTTP/WebSocket contracts for Qesto. **Do not hand-edit** files under `generated/`.

## Source of truth (interim)

Until OpenAPI generation is fully wired, authoritative API documentation lives in:

- [knowledge-base/api/API_FULL.md](../knowledge-base/api/API_FULL.md)
- TypeScript types in `functions/api/types.ts`

## Regeneration (planned)

```bash
# Future: generate clients from OpenAPI
# npm run contracts:generate
```

Declared generated zone: `agent/generated-zones.toml` → `contracts/generated/**`

## Drift checks

Run `just check` — includes typecheck which validates TS boundaries against server types.
