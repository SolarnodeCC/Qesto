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

## References

- [knowledge-base/quality/](../knowledge-base/quality/)
- [VALIDATION_PATTERNS.md](./VALIDATION_PATTERNS.md)
- [VALIDATION_STRATEGY.md](./VALIDATION_STRATEGY.md)
