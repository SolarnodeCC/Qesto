# Contracts (`contracts/`)

**Owns:** OpenAPI sources, JSON Schema, generated API typings  
**Forbidden:** Hand-editing `contracts/generated/*` (regenerate via `npm run contracts:generate`)  
**Proof lane:** `just check` (contract drift + typecheck)

## Layout

| Path | Role |
|------|------|
| `../functions/api/lib/openapi-v3-spec.ts` | **Single source** for the public API (v1/v2/v3) — edit here |
| `openapi-v3.json` | Generated from the spec constant (`npm run contracts:generate`); served by the developer portal |
| `generated/api.d.ts` | Generated TypeScript client types |

Coverage gate: `tests/unit/openapi-coverage.test.ts` fails if a registered `/api/v1|v2|v3` route is
undocumented, or a documented operation does not exist (DD-05, #878).

## References

- [agent/generated-zones.toml](../agent/generated-zones.toml)
- [docs/boundaries.md](../docs/boundaries.md)
