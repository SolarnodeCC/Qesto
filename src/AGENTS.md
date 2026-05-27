# Frontend (`src/`)

**Owns:** React pages, components, hooks, WebSocket UI state, Tailwind v4, i18n  
**Forbidden:** `functions/api/` route logic, `schema.sql`, secrets in source  
**Proof lane:** `just ux-qa`

## Conventions

- API calls via `src/api/client.ts` (HttpOnly session cookies; no `sessionStorage` tokens).
- Design tokens: `src/ui/tokens.ts` (generated — run `npm run tokens:build`).
- Realtime: hooks under `src/hooks/` consuming DO WebSocket protocol from `functions/api/types.ts`.

## References

- [docs/boundaries.md](../docs/boundaries.md)
- [knowledge-base/specifications/domain/SPEC_FRONTEND.md](../knowledge-base/specifications/domain/SPEC_FRONTEND.md)
