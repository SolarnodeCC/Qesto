# Runbook — Grant / revoke platform admin

How to make a user a **platform admin** (full access to `/api/admin/*` and the
Admin dashboard). Platform admin is stored in the D1 `platform_roles` table
(`migrations/0068_platform_roles.sql`) — separate from team `user_roles`, so
team ownership never confers platform admin (#586).

There are three ways in, in order of preference:

## 1. In-app API (preferred — audited, no DB access)

If an existing platform admin is available, grant via the admin API. This writes
the `platform_roles` row with a real `granted_by` and an audit-log entry.

```bash
# By existing user id
curl -X PATCH https://qesto.cc/api/admin/users/<id> \
  -H "Cookie: qesto_session=<jwt>" -H "Content-Type: application/json" \
  -d '{"admin_role":"admin"}'

# Revoke
curl -X PATCH https://qesto.cc/api/admin/users/<id> \
  -H "Cookie: qesto_session=<jwt>" -H "Content-Type: application/json" \
  -d '{"admin_role":null}'
```

Routes: `functions/api/routes/admin/users.ts` (guarded by `adminMiddleware`).

## 2. Explicit D1 grant (durable, no existing admin needed)

Requires Cloudflare auth (`wrangler login` or `CLOUDFLARE_API_TOKEN`). Use the
helper script:

```bash
scripts/grant-platform-admin.sh <email>                 # production grant
scripts/grant-platform-admin.sh <email> --env staging   # staging grant
scripts/grant-platform-admin.sh <email> --revoke        # revoke
```

It runs a single `INSERT ... SELECT` that looks up the user id by email and is
upsert-safe (`ON CONFLICT(user_id, role) DO NOTHING`), then prints a verification
query.

**FK caveat:** `platform_roles.user_id` references `users(id)`. If the user has
never signed in, no `users` row exists and the grant inserts **zero rows**
(verification shows nothing). Have them sign in once, then re-run.

D1 database names (`wrangler.toml`): prod `qesto_3_db`, staging `qesto-staging`.

## 3. Bootstrap env allowlist (initial setup)

`isPlatformAdmin()` (`functions/api/lib/platform-admin.ts`) treats any email
matching `SUPERUSER_EMAIL` or `SEED_ADMIN_EMAIL` as platform admin **without a DB
row**. Set as a secret, never in committed config (TD-14):

```bash
wrangler pages secret put SUPERUSER_EMAIL
```

This is convenient but env-dependent and not audited — prefer method 1 or 2 for
ongoing grants. Frontend Admin nav also keys off `VITE_SUPERUSER_EMAIL`
(must match the API `SUPERUSER_EMAIL`).

## Verify any method

```bash
wrangler d1 execute qesto_3_db --remote --command \
 "SELECT pr.user_id, u.email, pr.role, pr.granted_by, pr.created_at
  FROM platform_roles pr JOIN users u ON u.id = pr.user_id
  WHERE u.email = '<email>';"
```

Then log in as the user and confirm `GET /api/admin/kpis` returns 200 and the
Admin panel is visible.
