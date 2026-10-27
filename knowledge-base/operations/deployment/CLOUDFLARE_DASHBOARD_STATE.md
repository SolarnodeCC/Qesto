# Cloudflare dashboard state (DD-20, issue #893)

**Purpose.** Production infrastructure is `wrangler.toml` **plus** state that lives only in the
Cloudflare dashboard. That second half was invisible to every repository-only review, so a
dashboard change (e.g. a Workers Builds branch filter) could ship code with no PR and no trail.
This file is the reviewed record of that state. **Changing any dashboard item below requires a PR
updating this file first** (CODEOWNERS routes `knowledge-base/operations/` for review).

Legend: ✅ derived from the repository (verifiable here) · ✍️ dashboard-only — an account admin
must fill in / confirm the value and the date checked.

## 1. Deploy paths

| Item | Value | Source |
|---|---|---|
| Intended production deploy | GitHub Actions `ci.yml` → `environment: production` job: API (`scripts/deploy-api.mjs`) **before** frontend (`wrangler pages deploy dist`) | ✅ `.github/workflows/ci.yml` |
| Workers Builds Git integration (`qesto-api`) | ✍️ enabled? branch filter? build command? — **should be DISABLED** (DD-08, #881: otherwise the API deploys twice per push, outside the approval gate) | dashboard |
| Pages Git integration (`qesto`) | ✍️ enabled? production branch? build command? — **should be DISABLED** for the same reason | dashboard |
| `production` GitHub Environment | ✍️ required reviewer / wait timer configured? | GitHub settings |
| Last checked | ✍️ YYYY-MM-DD by @handle | — |

## 2. Secret inventory (names only — never values)

Set with `wrangler secret put <NAME>` (Worker) / `wrangler pages secret put <NAME>` (Pages).
✅ names from `functions/api/types/env.ts`; ✍️ mark which are actually set in production.

| Group | Secrets |
|---|---|
| Sessions & auth | `JWT_SECRET`, `JWT_SECRET_PREV` (rotation window), `IMPERSONATION_SECRET` (optional, DD-23), `MFA_ENCRYPTION_KEY` (optional, DD-04) |
| Internal service keys | `KB_ADMIN_KEY`, `KB_SEARCH_SERVICE_KEY`, `MARKETING_WEBHOOK_SECRET`, `EMBED_WIDGET_SECRET`, `CONNECT_INVITE_SECRET`, `VIDEO_PREVIEW_SIGNING_KEY`, `SOVEREIGN_AUDIT_SIGNING_KEY`, `DELIBERATE_VOTER_SALT`, `OAUTH_TOKEN_MEK` |
| Email / payments | `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| AI gateway | `CLOUDFLARE_AI_GATEWAY_TOKEN` |
| OAuth / SSO providers | `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_SECRET`, `SLACK_CLIENT_SECRET`, `ZOOM_CLIENT_SECRET`, `SALESFORCE_CLIENT_SECRET`, `NOTION_CLIENT_SECRET`, `LINKEDIN_CLIENT_SECRET`, `REDDIT_CLIENT_SECRET`, `YOUTUBE_CLIENT_SECRET` |
| Directory / LTI | `LDAP_BIND_PASSWORD`, `LTI_CONSUMER_SECRET` |
| Alerting | `ALERT_WEBHOOK_URL`, `SENTRY_DSN`, `GITHUB_ALERT_TOKEN` |
| Push | `VAPID_PRIVATE_KEY` |
| CI-only (GitHub Actions secrets) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` |

> DD-41 (#913): the Cloudflare API token, Access service token and `KB_ADMIN_KEY` that were
> committed to documentation must be **rotated**; record the rotation date here: ✍️

## 3. Rate-limit namespaces (`[[ratelimits]]`)

✅ from `wrangler.toml`. Bindings are inert while `ATOMIC_RATE_LIMIT_ENABLED = "false"`.

| Binding | namespace_id | Limit |
|---|---|---|
| `RL_API_KEY` | 1001 | 120 / 60s |
| `RL_EMBED_READ` | 1002 | 120 / 60s |
| `RL_EMBED_HANDSHAKE` | 1003 | 30 / 60s |
| `RL_JOIN` | 1004 | 20 / 60s |
| `RL_PUBLIC_EVENT` | 1005 | 60 / 60s |
| `RL_WEBHOOK` | 1006 | 100 / 60s |
| `RL_AUTH_BURST` | 1007 | 5 / 60s |
| `RL_REPORT_BURST` | 1008 | 5 / 60s |
| `RL_KB_SEARCH` | 1009 | 60 / 60s |
| `RL_ADMIN_AUDIT_Q` | 1010 | 120 / 60s |
| `RL_AI_BURST` | 1011 | 10 / 60s |

## 4. Zone (`qesto.cc`) security settings

| Item | Value |
|---|---|
| WAF managed rules / custom rules | ✍️ |
| Bot management / Bot Fight Mode | ✍️ |
| Zone-level rate limiting rules | ✍️ |
| `workers.dev` route for `qesto-api` | ✍️ confirm **disabled** after `workers_dev = false` deploy (DD-28, #900) |
| Cloudflare Access in front of admin/preview surfaces | ✍️ |
| Notifications (Workers errors, Pages build failures) | ✍️ (#939) |
| Pages project observability / Logpush | ✍️ (#942) |

## 5. Known gaps tracked elsewhere

- No `[env.staging]` bindings yet — previews still talk to production (DD-25, #897).
- Terraform/OpenTofu for the above is the long-term fix so drift becomes a diff.
