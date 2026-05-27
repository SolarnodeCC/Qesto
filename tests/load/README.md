# Load tests (S71+)

## k6 smoke (`LOAD-FRAMEWORK-71`)

Requires [k6](https://k6.io/) installed locally.

```bash
k6 run tests/load/k6-smoke.js -e BASE_URL=http://localhost:8787
```

With wrangler dev running, this hits health, platform version, and scale-proof endpoints as a baseline before 50k/100k proof work (S75).
