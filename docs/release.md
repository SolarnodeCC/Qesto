# Release process

## Version source

- Application version: `package.json` `version` field.
- Deploy target: Cloudflare Pages (`wrangler pages deploy` after `npm run build`).

## Pre-release checklist

1. `just verify` — quality gates, build, advisory jankurai score.
2. CI green on `main`: `.github/workflows/ci.yml`, `playwright.yml`, `jankurai.yml`.
3. Migrations applied to staging D1 before production (see [knowledge-base/product/releases/RELEASE_GUIDE.md](../knowledge-base/product/releases/RELEASE_GUIDE.md)).
4. Secrets rotated per [ops/PROFILE.md](../ops/PROFILE.md) — never committed in `wrangler.toml`.

## Changelog

- User-facing changes: note in PR description and `knowledge-base/product/releases/` as appropriate.
- Security fixes: follow `.github/SECURITY_INCIDENT.md` if credentials were exposed.

## Artifacts and integrity

| Artifact | Location |
|----------|----------|
| Production build | `dist/` from `npm run build` |
| Audit score | `agent/repo-score.json` (CI artifact / `just score`) |
| Playwright report | CI artifact `playwright-report` |

## Rollback

1. Revert merge commit on `main` or redeploy previous Pages deployment from Cloudflare dashboard.
2. D1: forward-only migrations; rollback uses documented steps in `migrations/.metadata/*.json`.
3. KV/DO: no automatic rollback — follow runbook in `knowledge-base/operations/`.

## Budgets and stop conditions

Machine-readable policy: [`agent/cost-budget.toml`](../agent/cost-budget.toml). Human summary: [`docs/testing.md#cost-and-spend-budgets-stop-condition-policy`](./testing.md).

- Workers AI calls: per-tenant token quota; circuit breaker + plan middleware stop condition.
- Vectorize sync: batch quota in `scripts/kb-sync-cli.ts`; non-zero exit on breach.
- CI: workflow `timeout-minutes` caps; cancel-in-progress concurrency on all workflows.
- Agent sessions: stop after `just check` fails; kill-switch = halt run (no `--no-verify`).

## Detailed guide

[knowledge-base/product/releases/RELEASE_GUIDE.md](../knowledge-base/product/releases/RELEASE_GUIDE.md)
