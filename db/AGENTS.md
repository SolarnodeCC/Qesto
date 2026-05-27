# Database layer (`db/`)

**Owns:** `migrations/`, `schema.sql`, D1 constraint definitions  
**Forbidden:** React/UI imports, ad-hoc SQL from `src/`  
**Proof lane:** `npm test` (migration and schema unit tests)

## Layout

| Path | Role |
|------|------|
| `migrations/*.sql` | Forward D1 migrations (apply with wrangler) |
| `migrations/.metadata/` | Destructive migration safety evidence |
| `schema.sql` | Full schema snapshot for local `--local` dev |

## Commands

```bash
npx wrangler d1 execute qesto_2_db --local --file=schema.sql
npx wrangler d1 migrations apply qesto_2_db --local
```

## References

- [docs/boundaries.md](../docs/boundaries.md)
- [knowledge-base/specifications/domain/SPEC_DATAMODEL.md](../knowledge-base/specifications/domain/SPEC_DATAMODEL.md)
