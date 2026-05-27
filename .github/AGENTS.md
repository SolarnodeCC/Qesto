# GitHub Actions — workflow entrypoints

Workflow YAML files live here for GitHub discovery. **Implementation** lives in `ops/ci/*.sh` (local/CI parity).

| Workflow | Delegates to |
|----------|--------------|
| `ci.yml` | `ops/ci/quality-gates.sh`, `secret-scan.sh`, `jankurai.sh` |
| `jankurai.yml` | `ops/ci/jankurai.sh`, `supply-chain.sh` |
| `playwright.yml` | `ops/ci/playwright.sh` |
| `help-sync-on-merge.yml` | `ops/ci/help-sync.sh` |
| `kb-sync-on-merge.yml` | `ops/ci/kb-sync.sh` |

Canonical ops profile: `ops/AGENTS.md`, `ops/PROFILE.md`.

Proof: `just score`, `just security`, `docs/ci-local.md`.
