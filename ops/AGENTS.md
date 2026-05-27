# ops/ — CI, hooks, and deployment lanes

## Owns
- `ops/ci/*.sh` — shared CI lanes invoked by GitHub Actions and `scripts/ci-local.sh`
- `ops/git-hooks/` — pre-push quality gates (`git config core.hooksPath ops/git-hooks`)

## Forbidden
- Product API or UI logic (belongs in `functions/api/` and `src/`)
- Committed secrets or inline credentials in shell scripts

## Proof lane
```bash
bash scripts/ci-doctor.sh
bash scripts/ci-local.sh quality-gates
bash ops/ci/secret-scan.sh
```
