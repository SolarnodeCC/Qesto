# Local CI parity

GitHub Actions workflows delegate to `ops/ci/*.sh`. Run the same lanes locally:

| Lane | Local command | CI workflow |
|------|---------------|-------------|
| Quality gates | `bash ops/ci/quality-gates.sh` or `just check` | `ci.yml` |
| Secret scan | `bash ops/ci/secret-scan.sh` | `ci.yml` |
| Contract drift | `npm run check:contracts` | `ci.yml` |
| Jankurai audit | `bash ops/ci/jankurai.sh` or `just score` | `ci.yml`, `jankurai.yml` |
| Supply chain | `bash ops/ci/supply-chain.sh` | `jankurai.yml` |
| Playwright E2E | `bash ops/ci/playwright.sh` | `playwright.yml` |
| Help sync | `bash ops/ci/help-sync.sh` | `help-sync-on-merge.yml` |
| KB sync | `bash ops/ci/kb-sync.sh` | `kb-sync-on-merge.yml` |

## Setup

```bash
just setup          # npm ci + git hooks
just doctor         # verify tool versions
git config core.hooksPath ops/git-hooks
```

## Pre-push

The `ops/git-hooks/pre-push` hook runs `bash ops/ci/quality-gates.sh`.

## Full local CI

```bash
bash scripts/ci-local.sh quality-gates
bash scripts/ci-local.sh full
bash scripts/ci-local.sh doctor
```

## Repair receipts

When a lane fails, rerun the exact command from CI logs:

1. `npm run typecheck` — TypeScript errors
2. `npm test` — unit test failures
3. `npm run check:contracts` — OpenAPI drift
4. `bash ops/ci/secret-scan.sh` — credential patterns in tree

Artifacts: `agent/repo-score.json`, `agent/repo-score.md` (jankurai), `target/security/` (scans).
