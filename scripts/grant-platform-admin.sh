#!/bin/bash
# Grant (or revoke) platform_admin to a user by email, via Cloudflare D1.
#
# Writes a row into the `platform_roles` table (see migrations/0068_platform_roles.sql).
# This is the durable, audited equivalent of the SUPERUSER_EMAIL/SEED_ADMIN_EMAIL
# bootstrap allowlist (functions/api/lib/platform-admin.ts) — it does not depend on
# any env var being set.
#
# Requires Cloudflare auth: `wrangler login` or CLOUDFLARE_API_TOKEN in the env.
#
# Usage:
#   scripts/grant-platform-admin.sh <email> [--env staging] [--revoke] [--local]
#
# Examples:
#   scripts/grant-platform-admin.sh oostelaar@hotmail.com                # prod grant
#   scripts/grant-platform-admin.sh oostelaar@hotmail.com --env staging  # staging grant
#   scripts/grant-platform-admin.sh oostelaar@hotmail.com --revoke       # prod revoke
#   scripts/grant-platform-admin.sh oostelaar@hotmail.com --local        # local D1
set -euo pipefail

EMAIL="${1:-}"
if [ -z "$EMAIL" ]; then
  echo "Usage: $0 <email> [--env staging] [--revoke] [--local]" >&2
  exit 2
fi
shift

# Defaults: production DB, remote execution, grant.
DB="qesto_3_db"
ENV_FLAG=""
REMOTE_FLAG="--remote"
ACTION="grant"

while [ $# -gt 0 ]; do
  case "$1" in
    --env)
      shift
      if [ "${1:-}" = "staging" ]; then
        DB="qesto-staging"
        ENV_FLAG="--env staging"
      else
        echo "Unknown --env value: ${1:-}" >&2
        exit 2
      fi
      ;;
    --revoke) ACTION="revoke" ;;
    --local)  REMOTE_FLAG="--local" ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

# SQL-escape single quotes in the email.
EMAIL_ESC="${EMAIL//\'/\'\'}"

run_d1() {
  # shellcheck disable=SC2086
  npx wrangler d1 execute "$DB" $REMOTE_FLAG $ENV_FLAG --command "$1"
}

if [ "$ACTION" = "grant" ]; then
  echo ">> Granting platform_admin to '$EMAIL' on '$DB' ($REMOTE_FLAG)..."
  # Single statement: looks up the user id and inserts in one shot. Inserts zero
  # rows (no error) if the user has never signed in, since user_id is FK -> users(id).
  run_d1 "INSERT INTO platform_roles (id, user_id, role, granted_by, created_at)
          SELECT lower(hex(randomblob(16))), id, 'platform_admin', 'bootstrap', strftime('%s','now')*1000
          FROM users WHERE email = '$EMAIL_ESC'
          ON CONFLICT(user_id, role) DO NOTHING;"
else
  echo ">> Revoking platform_admin from '$EMAIL' on '$DB' ($REMOTE_FLAG)..."
  run_d1 "DELETE FROM platform_roles
          WHERE role = 'platform_admin'
            AND user_id IN (SELECT id FROM users WHERE email = '$EMAIL_ESC');"
fi

echo ">> Verifying..."
run_d1 "SELECT pr.user_id, u.email, pr.role, pr.granted_by, pr.created_at
        FROM platform_roles pr JOIN users u ON u.id = pr.user_id
        WHERE u.email = '$EMAIL_ESC';"

echo ">> Done. A row above => active grant. No rows after a grant => the user has"
echo "   no 'users' record yet (never signed in); have them sign in once, then re-run."
