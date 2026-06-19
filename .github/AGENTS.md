# GitHub Actions — workflow entrypoints

Workflow YAML files live here for GitHub discovery. **Implementation** lives in `ops/ci/*.sh` (local/CI parity).

| Workflow | Delegates to |
|----------|--------------|
| `ci.yml` | `ops/ci/quality-gates.sh`, `secret-scan.sh`, `jankurai.sh` |
| `jankurai.yml` | `ops/ci/jankurai.sh`, `supply-chain.sh` |
| `playwright.yml` | `ops/ci/playwright.sh` |
| `help-sync-on-merge.yml` | `ops/ci/help-sync.sh` |
| `kb-sync-on-merge.yml` | `ops/ci/kb-sync.sh` |
| `copilot-setup-steps.yml` | Installs `gh-aw` CLI for Copilot Agent (MCP) |
| `daily-repo-status.md` | GitHub Agentic Workflow — daily repo status issue (compiled: `daily-repo-status.lock.yml`) |

## GitHub Agentic Workflows (`gh aw`)

- **Custom agent:** `.github/agents/agentic-workflows.md`
- **MCP:** `.github/mcp.json` → `gh aw mcp-server`
- **Secret (repo):** `COPILOT_GITHUB_TOKEN` — fine-grained PAT with **Copilot Requests: Read** recommended
- **Windows:** use WSL — `bash scripts/gh-aw-wsl.sh aw run daily-repo-status` (native `gh-aw.exe` may hang)

```bash
gh aw compile daily-repo-status --validate   # after editing *.md frontmatter
gh aw run daily-repo-status                  # manual trigger
gh aw logs daily-repo-status                 # debug
```

Canonical ops profile: `ops/AGENTS.md`, `ops/PROFILE.md`.

Proof: `just score`, `just security`, `docs/ci-local.md`.
