---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - governance
  - policy
  - guidelines
relates_to:
  - CONTRIBUTING
---

# Release Control Surface

## Version source

The authoritative version is `package.json#version`. All tags and changelogs derive from this value.

```bash
node -e "console.log(require('./package.json').version)"
```

## Release process

### 1. Prepare
- Ensure `main` branch CI is green (ci.yml + playwright.yml + jankurai.yml)
- Run `npm test` and `npm run typecheck` locally
- Update `CHANGELOG.md` with the new version section
- Bump `package.json#version` following semver

### 2. Tag
```bash
git tag -s v<version> -m "Release v<version>"
git push origin v<version>
```

### 3. Deploy
```bash
npm run build
wrangler pages deploy dist --project-name=qesto
```

### 4. Verify
```bash
npm run verify:deploy        # smoke-tests against production URL
```

### 5. Record evidence
After a successful deploy, commit the Jankurai audit baseline:
```bash
# Download target/jankurai/repo-score.json from the last CI run artifact
cp ~/Downloads/repo-score.json agent/repo-score.json
git add agent/repo-score.json
git commit -m "chore: update Jankurai baseline for v<version>"
```

## CI evidence required before release

| Check | Workflow | Passes |
|---|---|---|
| Unit tests (531) | ci.yml | required |
| TypeScript | ci.yml | required |
| Accessibility audit | ci.yml | required |
| Jankurai audit | jankurai.yml | advisory (score logged) |
| E2E (Playwright) | playwright.yml | required on main |

## Rollback guidance

### Cloudflare Pages rollback
```bash
# List recent deployments
wrangler pages deployment list --project-name=qesto

# Roll back to a previous deployment ID
wrangler pages deployment rollback <deployment-id> --project-name=qesto
```

### Database rollback
D1 migrations are **forward-only** in Cloudflare D1. Each migration file includes a
`-- rollback:` comment with the reverse SQL. To roll back a migration manually:

```bash
wrangler d1 execute qesto-prod --command="<rollback SQL from migration file>"
```

Always verify with:
```bash
wrangler d1 execute qesto-prod --command="SELECT COUNT(*) FROM <affected_table>"
```

## Integrity and provenance

- All production secrets are stored in Cloudflare Pages secrets (never in `wrangler.toml`)
- Build artifacts are produced by CI and deployed directly — no local build artifacts go to production
- Jankurai audit score is recorded in `agent/repo-score.json` per release
- Audit log of all data mutations is in the `audit_events` D1 table
