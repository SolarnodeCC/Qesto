# Database Root (D1)

Status: active
Owner: db
Applies to: `migrations/`, `schema.sql`, `db/`

Qesto uses Cloudflare D1 (`qesto_2_db`). Versioned schema changes live in `migrations/` at the repo root; `schema.sql` is the consolidated reference snapshot.

Machine-readable routing: `agent/boundaries.toml`, `agent/owner-map.json`, `agent/test-map.json`.

Proof lane: `npm test -- --run tests/unit/migrations`
