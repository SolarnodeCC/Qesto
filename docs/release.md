# Release control surface

## Version source
- `package.json` — application semver (`version` field)
- Cloudflare Pages project `qesto` — production deploy target

## Changelog
- Product releases: `knowledge-base/product/releases/ARCHIVED_SPRINTS.md`
- Security incidents: `.github/SECURITY_INCIDENT.md`

## Release process
1. `just verify` — typecheck, unit tests, build (see `docs/testing.md`)
2. `just check` — RC gate subset: `npm run check:rc`
3. `npm run build && npm run deploy:frontend` — Pages static assets
4. `npm run deploy:api` — API worker (requires Cloudflare credentials)

## Changelog
- Product releases: `knowledge-base/product/releases/ARCHIVED_SPRINTS.md`
- Version source: `package.json` `version` field

## CI evidence
- `.github/workflows/ci.yml` — quality gates + contract drift + audit artifacts
- `.github/workflows/jankurai.yml` — advisory repo score
- `ops/ci/supply-chain.sh` — npm audit + gitleaks (when Docker available)

## Integrity / provenance
- `package-lock.json` — lockfile; `npm ci` in CI
- GitHub Actions pinned to full commit SHAs (HLT-034)

## Rollback
- **Frontend:** redeploy previous Pages deployment from Cloudflare dashboard
- **API:** `wrangler deployments list` then rollback to prior deployment ID
- **D1:** restore from backup before applying destructive migrations; see `migrations/.metadata/README.md`
