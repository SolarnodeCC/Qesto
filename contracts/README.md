# API contracts

Generated and checked boundary artifacts for public HTTP surfaces.

| Artifact | Source | Drift check |
|----------|--------|-------------|
| `openapi-v3.json` | `functions/api/lib/openapi-v3-spec.ts` | `npm run check:contracts` |
| `public-api-v1.md` | Hand-maintained overview | Review on route changes |

Product runtime truth lives in TypeScript (`functions/api/`) and SQL (`migrations/`, `schema.sql`), not in handwritten client copies.
