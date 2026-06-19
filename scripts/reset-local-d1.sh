#!/bin/bash
# scripts/reset-local-d1.sh — Reset local D1 to schema.sql + stamp migration tracker
#
# Use when local D1 is out of sync (schema.sql vs migrations apply conflict).
# Safe for local dev only — never run against remote.
#
# Usage: bash scripts/reset-local-d1.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_NAME="qesto_3_db"
D1_STATE=".wrangler/state/v3/d1"
SCHEMA="schema.sql"
MIGRATIONS_DIR="migrations"

if [ ! -f "$SCHEMA" ]; then
  echo "error: missing $SCHEMA" >&2
  exit 1
fi

echo "→ Stopping local D1 state ($D1_STATE)"
echo "   (stop wrangler dev first if this fails with 'Device or resource busy')"
rm -rf "$D1_STATE"

echo "→ Applying canonical schema ($SCHEMA)"
npx wrangler d1 execute "$DB_NAME" --local --file="$SCHEMA"

echo "→ Stamping d1_migrations (so 'npm run e2e:db:local' is a no-op)"
STAMP_SQL="$(mktemp)"
{
  echo "CREATE TABLE IF NOT EXISTS d1_migrations("
  echo "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
  echo "  name TEXT UNIQUE,"
  echo "  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL"
  echo ");"
  find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -type f | sort | while read -r f; do
    name="$(basename "$f")"
    printf "INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES ('%s', datetime('now'));\n" "$name"
  done
} > "$STAMP_SQL"

npx wrangler d1 execute "$DB_NAME" --local --file="$STAMP_SQL"
rm -f "$STAMP_SQL"

echo "→ Verifying migration tracker"
PENDING="$(npx wrangler d1 migrations list "$DB_NAME" --local 2>&1 | grep -c '🕒' || true)"
if [ "${PENDING:-0}" -gt 0 ]; then
  echo "warning: $PENDING migrations still pending — check 'wrangler d1 migrations list $DB_NAME --local'" >&2
else
  echo "✓ All migrations stamped; local D1 ready"
fi

echo ""
echo "Next: npx wrangler dev --port 8787 --local   # API"
echo "      npm run dev                             # Frontend"
