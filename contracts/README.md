# API contracts

Public HTTP contracts for Qesto. **Do not hand-edit** `openapi-v3.json` or anything under `generated/`.

## Source of truth

The public API (`/api/v1`, `/api/v2`, `/api/v3`) is described by one constant:
[`functions/api/lib/openapi-v3-spec.ts`](../functions/api/lib/openapi-v3-spec.ts) (DD-05, #878).
It is served at `/api/v3/openapi.json` and `/api/developer/openapi.json`.

Internal (SPA-only) routes are not part of the public contract; see
[knowledge-base/api/API_FULL.md](../knowledge-base/api/API_FULL.md).

## Regeneration

```bash
npm run contracts:generate   # writes openapi-v3.json, then generated/api.d.ts
npm run check:contracts      # fails if openapi-v3.json drifted from the constant
```

## Gates

- `tests/unit/openapi-coverage.test.ts` (in `npm test`): every registered public route has a spec
  operation, and every spec operation maps to a registered route. Adding or removing a public
  route without updating the spec fails the build.
- `ops/ci/contracts.sh`: regenerates and fails on any diff in `openapi-v3.json` or `generated/`.

Declared generated zone: `agent/generated-zones.toml` → `contracts/generated/api.d.ts`.
