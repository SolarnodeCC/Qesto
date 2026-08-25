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

### Step 2 cannot be enabled as the policy stands

Verified on 2026-08-25 against a clean checkout of `main`:

```
$ jankurai audit . --mode ratchet --baseline target/jankurai/accepted-baseline.json
score=66 raw=77 caps=12 findings=86
Error: audit decision failed in ratchet mode: status=fail score=66 minimum_score=85
```

The *ratchet* comparison itself passes — `score_delta: 0`, `new_caps: []`,
`new_hard_findings: []`. What fails is the **absolute floor**: `minimum_score = 85`
in `agent/audit-policy.toml` against an actual score of 66. Making this lane a
required check today would therefore block *every* pull request, including ones
that improve the score, because the gate is unconditional rather than
differential.

So step 2 has a prerequisite. Pick one before enabling it:

1. **Split the gate (recommended).** Make the required check assert only the
   ratchet delta — no new caps, no new hard findings, `score_delta >= 0` — and
   keep the score-85 floor as a separate advisory lane. This gates regressions
   from day one, which is what #612 actually asks for, without demanding the
   repo be finished first.
2. **Lower `minimum_score` to the current score** and raise it as remediation
   lands, so the floor ratchets upward with the repo.
3. **Reach 85 first**, then enable. This leaves the gap open for as long as
   remediation takes — 12 caps are currently applied, several blocked on
   upstream detector fixes (#691), so this is the slowest path.

Whichever is chosen, note that `minimum_score = 85` is documented in the policy
as aspirational. It is not a description of the repo's current state, and
treating it as an enforcement threshold is what makes the gate unusable.

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


## The jankurai lane has four failing steps hidden by `continue-on-error`

Before making **`jankurai audit`** a required check, know what is currently red
inside it. The job reports success only because five steps carry
`continue-on-error: true`; four of them fail on every run. Verified 2026-08-25 by
running each step against a clean `origin/main` worktree.

| Step | Failure | Cause | Ours? |
|---|---|---|---|
| `security` | `security lane blocked by required tool evidence: gitleaks, npm` | The lane wants tool-evidence artifacts the workflow never produces. A **security** lane that cannot run is the most consequential of the four. | Pre-existing |
| `db-migration-analyze` | `error: unexpected argument '--json' found` | Workflow invokes `jankurai migrate . --analyze --json …`, but the CLI signature is `jankurai migrate --analyze <REPO>` — it takes no `--json`. The step has never worked. | Pre-existing |
| `ux-qa` | `Cannot find module packages/ux-qa/dist/cli.js` | `jankurai ux audit` shells out to a local CLI that is never built in CI. | Pre-existing |
| `proofbind` | `read ./<path>: No such file or directory` | `jankurai_proofbind::classify::classify_changed_path` reads every path in the `--changed-from` diff without checking it still exists, so **any commit that deletes or renames a file** fails the step. | Upstream bug, triggered by any rename |

The first three are independent of repo content and reproduce on `main`. The
fourth is transient per-branch: once a rename merges, later diffs against the new
`main` no longer list the deleted path, so it self-heals — but it will recur on
every future PR that deletes a file.

**Consequence for step 2 above:** making this lane required would turn every PR
red for four reasons that have nothing to do with the PR. Fix or drop these steps
first, or scope the required check to the ratchet delta only, as recommended
above. Re-tightening the `continue-on-error` flags (tracked in #688 and #613) is
not just a policy decision — three of these steps are broken and would need
repairing before the flags can come off.
