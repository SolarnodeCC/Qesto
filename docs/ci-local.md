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
just hooks          # enable pre-push only (re-run after clone)
just doctor         # verify tool versions
```

On Windows (PowerShell):

```powershell
pwsh scripts/install-git-hooks.ps1
```

## Pre-push

Install once per clone (`just hooks`). The `ops/git-hooks/pre-push` hook selects a lane automatically:

| Lane | When | Command |
|------|------|---------|
| **full** | Push to `main`/`master`, or trust/AI paths changed | `ops/ci/quality-gates.sh` (CI parity: tsc, `test:eval`, coverage) |
| **fast** | Feature branches, low-risk diffs | `ops/ci/quality-gates-fast.sh` (tsc + `npm test`) |
| **skip** | `knowledge-base/`, `docs/`, `*.md` only | No code gates |

Overrides:

- `QESTO_PREPUSH_MODE=fast|full|ci` — force a lane
- `QESTO_SKIP_PREPUSH=1` — emergency bypass (avoid on `main`)

Dry run without pushing:

```bash
bash scripts/test-pre-push-hook.sh
bash scripts/test-pre-push-hook.sh full
```

**Windows:** hooks run under **Git for Windows** bash when you `git push` (not WSL `git` unless Node is installed in WSL). Verify with:

```bash
"C:\Program Files\Git\bin\bash.exe" scripts/test-pre-push-hook.sh fast
```

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
