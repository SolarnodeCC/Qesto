---
id: CI_RUNNER_STATUS_2026_06_19
type: operations
domain: operations
category: ci
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - ops-ci-runner-01
  - rt-01
relates_to:
  - BACKLOG_ACTIVE
  - ci.yml
---

# CI Runner Status — 2026-06-19

_`OPS-CI-RUNNER-01` (RT-01). Root-cause analysis of GitHub Actions `ci.yml` failures._

## Verdict

| Layer | Status | Notes |
|-------|--------|-------|
| **GitHub Actions billing** | **Blocked** | Jobs never start — account payment/spending limit |
| **Local quality gates** | **Green** | tsc, 2225+ Vitest, build, i18n, eval, migration check |
| **Pre-push hooks** | **Green** | `ops/git-hooks` fast/full lanes (`OPS-GIT-HOOKS-01` done) |

## Root cause (GitHub)

Run `27825616668` (2026-06-19, PR #564):

```
The job was not started because recent account payments have failed or your
spending limit needs to be increased. Please check the 'Billing & plans' section
```

This is **not** a workflow syntax or test failure. The `quality-gates · audit` job exits in ~2s
with **no runner assigned** and **no logs**. Last 100 `ci.yml` runs show 0% success for the same
reason class.

### Operator action required

1. GitHub → **Settings → Billing & plans** — resolve failed payment or raise spending limit.
2. Re-run the latest failed workflow on `main` after billing is fixed.
3. Confirm the `build · deploy` health curl succeeds (wired in `ci.yml`).

## Engineering parity (runs locally)

```bash
npm run typecheck
npm test -- --run
npm run test:eval
npm run test:coverage
npm run build
npm run check:i18n
bash ops/ci/check-migration-numbers.sh
# Git Bash on Windows (node on PATH):
bash ops/ci/quality-gates.sh
bash ops/ci/contracts.sh
```

### Test fix shipped (2026-06-19)

`tests/integration/auth-hardening.test.ts` SAML characterization tests now set **both**
`SAML_SSO_ENABLED` and `SAML_SIGNATURE_VERIFY_ENABLED` to match the #529 dual gate
(`tests/unit/saml-killswitch.test.ts`).

`tests/integration/connect-scale-proof.test.ts` — `describe.sequential` + 90s timeouts on
scale loops (fixes flaky failure under full parallel Vitest load).

`scripts/smoke-platform-v7.mjs` — cross-platform platform smoke; wired in `ci.yml` after
staging and production health checks (`OPS-S99-CLOSEOUT-01`).

## RT-01 closure rule

`OPS-CI-RUNNER-01` closes when **billing is fixed** and the last 10 `main` pushes show green
`quality-gates · audit` jobs — not when local gates pass alone.
