# Load tests (S71+)

## k6 smoke (`LOAD-FRAMEWORK-71`)

Requires [k6](https://k6.io/) installed locally.

```bash
k6 run tests/load/k6-smoke.js -e BASE_URL=http://localhost:8787
```

With wrangler dev running, this hits health, platform version, and scale-proof endpoints as a baseline before 50k/100k proof work (S75).

## Townhall moderation smoke (`TOWNHALL-SCALE-PROOF-50K-01`, S84)

```bash
k6 run tests/load/townhall-moderation-smoke.js -e BASE_URL=http://localhost:8787
```

Validates scale-proof metadata for the **50k concurrent voter** staging gate (moderation queue p95 &lt;2s). Full 50k proof runs on dedicated staging infra, not in CI.
