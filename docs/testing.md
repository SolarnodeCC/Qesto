# Testing and proof lanes

Cost **budget/stop-condition policy** for paid and unbounded operations: [`agent/cost-budget.toml`](../agent/cost-budget.toml). Includes spend cap, token limit, quota, stop condition, and kill-switch controls. Rerun: `just check`.

## One-command entry points

| Command | Purpose |
|---------|---------|
| `just setup` | `npm ci` + configure `ops/git-hooks` |
| `just doctor` | Verify local tools match CI |
| `just check` | Typecheck + unit tests (pre-merge default) |
| `just fast` | Quality gates + production build |
| `just typecheck` | TypeScript only (~15s) |
| `just test-fast` | Typecheck + Vitest `--changed` (narrow lane) |
| `just test-changed` | Vitest changed-since `origin/main` |
| `just test-file <path>` | Single test file or pattern |
| `just test` | Unit tests only (`npx vitest run`) |
| `just just-cache` | Warm npm cache before narrow lanes |
| `just audit-fast` | Jankurai `--changed-fast` → `target/jankurai/audit-fast.json` |
| `just fast-score` | Jankurai fast score → `target/jankurai/fast-score.json` |
| `just bench` | Jankurai build-speed benchmark smoke |
| `just score` | Jankurai audit → `agent/repo-score.json` |
| `just security` | npm audit + jankurai security lane |
| `just ux-qa` | Playwright smoke (rendered UX evidence) |
| `just verify` | Full local CI simulation |

Local CI runner: `bash scripts/ci-local.sh [quality-gates|full|doctor]`

## Lane mapping

Path → command routing lives in `agent/test-map.json`.

## CI parity

GitHub Actions call the same scripts as local:

- `bash ops/ci/quality-gates.sh` — typecheck + Vitest
- `bash ops/ci/jankurai.sh` — advisory audit artifacts under `target/jankurai/`
- `bash ops/ci/supply-chain.sh` — dependency / secret posture

Pre-push: `git config core.hooksPath ops/git-hooks` (runs quality gates).

## Evidence for reviews

- Attach **raw CI logs** or job URLs, not summaries-only claims.
- Playwright: traces under `tests/playwright/` and CI artifact `playwright-report`.
- Jankurai: upload `agent/repo-score.json` + `agent/repo-score.md` from `just score`.

## Release readiness (launch gate)

| Control | Evidence | Rerun command |
|---------|----------|---------------|
| Security scan | `ops/ci/secret-scan.sh`, `ops/ci/supply-chain.sh` CI artifacts | `just security` |
| Backups | D1 export runbook in `knowledge-base/operations/` | `npm test -- --run tests/unit/migrations` |
| Monitoring | Analytics Engine + `writeEvent` traces (`functions/api/lib/observability.ts`) | `just fast` |
| Rollback | Cloudflare Pages deploy previous commit (`wrangler pages deploy`) | `just verify` |
| Abuse controls | Rate limits (`functions/api/middleware/rate-limit.ts`), CSRF middleware | `npm test -- --run tests/unit/rate-limit` |

Attach **raw CI logs** and replayable commands as repair receipts — not summary-only claims.

## Cost and spend budgets (stop-condition policy)

Machine-readable manifest: [`agent/cost-budget.toml`](../agent/cost-budget.toml).  
Rerun: `just check` (gates spend-risk surfaces before merge).

| Surface | Quota / budget | Stop condition | Kill-switch |
|---------|----------------|----------------|-------------|
| Workers AI (`c.env.AI.run`) | Per-tenant token caps in `functions/api/lib/ai/` | Circuit breaker open + plan middleware deny | `CIRCUIT_BREAKER_ENABLED=false`; AI routes off via `functions/api/lib/flags.ts` |
| Vectorize sync | Batch size quota in `scripts/kb-sync-cli.ts` | CLI exits non-zero on quota breach | Revoke `KB_SEARCH_SERVICE_KEY`; skip admin kb-sync |
| Playwright CI | 60 min job timeout (`.github/workflows/playwright.yml`) | Workflow cancel on timeout | Disable playwright workflow; local `just ux-qa` only |
| E2E fixtures | `PW_TEST_PASSWORD` env only — never production credentials | `bash ops/ci/secret-scan.sh` fails merge | Remove fixture secrets from CI env |
| Agent sessions | Stop after first failing `just check` | No `--no-verify` bypass | Halt agent run; human owner escalation |

Spend alerts: Analytics Engine `writeEvent` traces for AI and export usage (`functions/api/lib/observability.ts`).

## Agent-friendly errors

Structured API errors include `code`, `message`, `trace_id`, and `docs_url` hints. See `functions/api/lib/error-handler.ts` for the canonical envelope and **common fixes** in response `repair_hint` fields.

## References

- [knowledge-base/quality/](../knowledge-base/quality/)
- [VALIDATION_PATTERNS.md](./VALIDATION_PATTERNS.md)
- [VALIDATION_STRATEGY.md](./VALIDATION_STRATEGY.md)
