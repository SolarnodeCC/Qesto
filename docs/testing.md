# Testing and proof lanes

## Canonical commands

| Goal | Command |
|------|---------|
| Setup | `just setup` or `npm run setup` |
| Fast iteration | `just fast` |
| Pre-commit | `just check` |
| Full unit suite | `just test` or `npm test` |
| Pre-push / CI parity | `just verify` or `bash ops/ci/quality-gates.sh` |
| Repo audit score | `just score` |
| Security scan | `just security` |

## Repair receipts

Do not accept summary claims without rerunning proof:

```bash
# Standard green path (record exit codes in PR)
just fast && just check && npm run build
```

Raw CI logs and artifact paths:
- Unit tests: Vitest output from `npm test`
- Typecheck: `npm run typecheck`
- Contracts: `npm run check:contracts`
- Jankurai: `agent/repo-score.json`, `agent/repo-score.md`
- Secrets: `bash ops/ci/secret-scan.sh`

## Cost budgets (paid / unbounded operations)

| Surface | Budget | Stop condition |
|---------|--------|----------------|
| Workers AI (`c.env.AI.run`) | Dev: local unsupported; prod: plan-gated | Circuit breaker in `functions/api/lib/resilience/` |
| Vectorize queries | TopK ≤ 20 per request | Timeout in help/insights vectorize libs |
| KB embed script | `--limit N` for dry runs | `npm run kb:embed -- --dry-run` |
| Playwright CI | 60 min job timeout | `playwright.yml` |
| npm audit / gitleaks | Advisory in supply-chain lane | `continue-on-error` only where documented |

Kill switch: set `CIRCUIT_BREAKER_ENABLED=false` or disable AI routes via plan middleware.

## Human review evidence (marketing / claims)

Marketing agents must attach replayable proof for factual claims:
- Competitor comparisons: link to primary source + date accessed
- Performance claims: `just check` green + link to benchmark doc
- Never commit untested competitor claims or fabricated social proof without a cited source

## Web / E2E

```bash
npm run test:e2e:fullstack   # requires local full stack — see tests/docs/playwright-local.md
npm run test:a11y            # axe via Vitest
```

## Route → proof map

See `agent/test-map.json` for path-level proof routing.
