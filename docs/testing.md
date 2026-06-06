# Testing and proof lanes

## One-command entry points

| Command | Purpose |
|---------|---------|
| `just setup` | `npm ci` + configure `ops/git-hooks` |
| `just doctor` | Verify local tools match CI |
| `just check` | Typecheck + unit tests (pre-merge default) |
| `just fast` | Quality gates + production build |
| `just test` | Unit tests only |
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

## Cost and spend budgets

| Surface | Budget | Stop condition |
|---------|--------|----------------|
| Workers AI (`c.env.AI.run`) | Per-tenant token caps in `functions/api/lib/ai/` | Circuit breaker + plan gate |
| Vectorize sync | Batch size limits in `scripts/kb-sync-cli.ts` | CLI exits non-zero on quota breach |
| Playwright CI | 60 min job timeout in `.github/workflows/playwright.yml` | Workflow cancel on timeout |
| E2E fixtures | `PW_TEST_PASSWORD` env only — never production credentials | `bash ops/ci/secret-scan.sh` |

Kill-switch: set `CIRCUIT_BREAKER_ENABLED=false` and disable AI routes via feature flags (`functions/api/lib/flags.ts`).

## Agent-friendly errors

Structured API errors include `code`, `message`, `trace_id`, and `docs_url` hints. See `functions/api/lib/error-handler.ts` for the canonical envelope and **common fixes** in response `repair_hint` fields.

## References

- [knowledge-base/quality/](../knowledge-base/quality/)
- [VALIDATION_PATTERNS.md](./VALIDATION_PATTERNS.md)
- [VALIDATION_STRATEGY.md](./VALIDATION_STRATEGY.md)
