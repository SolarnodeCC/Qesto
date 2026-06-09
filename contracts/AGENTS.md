# Contracts (`contracts/`)

**Owns:** OpenAPI sources, JSON Schema, generated API typings  
**Forbidden:** Hand-editing `contracts/generated/*` (regenerate via `npm run contracts:generate`)  
**Proof lane:** `just check` (contract drift + typecheck)

## Layout

| Path | Role |
|------|------|
| `openapi/qesto-api.yaml` | Primary OpenAPI source |
| `openapi-v3.json` | Public v3 draft surface (tracked; zone in `agent/generated-zones.toml`) |
| `generated/api.d.ts` | Generated TypeScript client types |

## References

- [agent/generated-zones.toml](../agent/generated-zones.toml)
- [docs/boundaries.md](../docs/boundaries.md)
