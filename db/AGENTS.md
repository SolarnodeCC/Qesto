# db/ — data truth and migration guidance

## Owns
- `schema.sql` — canonical D1 schema snapshot
- `migrations/` — versioned SQL migrations with `.metadata/` safety evidence
- Local adapter notes (no direct SQL from `src/` components)

## Forbidden
- Frontend or REST handlers issuing raw SQL outside `functions/api/`
- Destructive migrations without same-stem `.metadata/*.json` + verify SQL

## Proof lane
```bash
npm run e2e:db:local
# After destructive rebuild migrations, confirm PRAGMA foreign_key_check / quick_check in SQL
```
