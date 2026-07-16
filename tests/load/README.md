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

Validates scale-proof metadata for the **50k concurrent voter** staging gate (moderation queue p95 <2s). Full 50k proof runs on dedicated staging infra, not in CI.

## Townhall 50k scale load (`TOWNHALL-SCALE-PROOF-50K-01`, S85)

```bash
# Local dev (auto-reduced to 100 VUs / 30s):
k6 run tests/load/townhall-scale-50k.js -e BASE_URL=http://localhost:8787

# Dedicated k6 cloud (50,000 VUs, 17-minute ramp):
k6 run tests/load/townhall-scale-50k.js -e BASE_URL=https://<target-host>
```

Full load scenario for the **50k concurrent voter** evidence gate. Exercises townhall join → submit question → upvote queue rankings under production scale. Validates:
- **Moderation queue ranking p95 < 2s** (upvotes desc, submission time asc)
- **Duplicate upvote suppression** (zero duplicate-vote accepts)
- **Zero anonymity leakage** (no author-identifying info in broadcast)
- **Error rate < 5%** at scale

Results are recorded in `knowledge-base/quality/load/TOWNHALL_SCALE_PROOF_50K.md`.
