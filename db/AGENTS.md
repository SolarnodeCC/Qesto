# Database layer (`db/`)

**Owns:** `migrations/`, `schema.sql`, D1 constraint definitions  
**Forbidden:** React/UI imports, ad-hoc SQL from `src/`  
**Proof lane:** `npm test` (migration and schema unit tests)

## Layout

| Path | Role |
|------|------|
| `migrations/*.sql` | Forward D1 migrations (apply with wrangler) |
| `migrations/*.meta.toml` | Jankurai HLT-021/030 safety sidecars (required for destructive/ALTER TABLE) |
| `migrations/*.verify.sql` | Post-apply integrity checks referenced by sidecars |
| `migrations/.metadata/` | Human-readable JSON archive of safety evidence |
| `schema.sql` | Full schema snapshot for local `--local` dev |
| `queries/*.ts` | Parameterized D1 read templates consumed by `functions/api/` |

## Commands

```bash
npx wrangler d1 execute qesto_2_db --local --file=schema.sql
npx wrangler d1 migrations apply qesto_2_db --local
```

## References

- [docs/boundaries.md](../docs/boundaries.md)
- [knowledge-base/specifications/domain/SPEC_DATAMODEL.md](../knowledge-base/specifications/domain/SPEC_DATAMODEL.md)
