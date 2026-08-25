# Branch protection — required checks

Some gates in this repo cannot be closed by committing code: they are GitHub
repository settings. This file records what must be configured, so the gap is
reviewable even though nothing in the tree can enforce it.

## Jankurai ratchet must block a PR (issue #612)

`agent/audit-policy.toml` declares `block_on_witness = true`. For that to mean
anything, the audit has to run *before* merge and its failure has to block.

| Step | Where | Status |
|---|---|---|
| 1. Run the ratchet audit on pull requests | `.github/workflows/jankurai.yml` | **Done** — the workflow has a `pull_request: branches: [main]` trigger |
| 2. Make the lane a required status check | GitHub → Settings → Branches → `main` → *Require status checks to pass before merging* → add **`jankurai audit`** | **Not done — repository setting, cannot be committed** |
| 3. Prove it blocks | Open a deliberately regressing PR; confirm the check turns red **on the PR** and merge is blocked | **Blocked on step 2** |

Until step 2 is configured by someone with admin rights on the repository, a PR
that adds a new hard cap or drops the score can still merge; the audit will only
report it afterwards. Step 1 removed the structural impossibility, not the gap.

### Verifying step 3

```bash
jankurai audit . --mode ratchet \
  --baseline target/jankurai/accepted-baseline.json \
  --json target/jankurai/repo-score.json
```

The advisory lanes in `jankurai.yml` (`proofbind`, `copy-code`, `security`,
`db-migration-analyze`, `ux-qa`) carry `continue-on-error: true` deliberately
while the repo sits below the aspirational `minimum_score = 85` floor. Dropping
those flags before remediation reaches the floor would turn the workflow red on
every run and block all merges, so they are re-tightened *after* the score
clears the floor, not before — tracked in #688 and #613.
