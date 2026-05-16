# KB Sync CLI — Quick Start

## What is it?

Automated knowledge-base sync to Cloudflare Vectorize. Detects changes, embeds modified files, uploads vectors incrementally.

## Installation

Already included! Just use:

```bash
npm run kb:sync          # Sync changes
npm run kb:sync -- status    # Check status
npm run kb:sync -- reset     # Reset manifest (full re-embed)
```

## Setup (First Time)

```bash
# Set environment variables (see below)
export CLOUDFLARE_API_TOKEN="cfat_..."
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_D1_DATABASE_ID="..."
export CF_ACCESS_CLIENT_ID="..."
export CF_ACCESS_CLIENT_SECRET="..."
export KB_ADMIN_KEY="qesto-kb-admin-phase1"

# Sync all KB files
npm run kb:sync
```

## Environment Variables

Required (get from Cloudflare Dashboard):

- `CLOUDFLARE_API_TOKEN` — API token
- `CLOUDFLARE_ACCOUNT_ID` — Account ID
- `CLOUDFLARE_D1_DATABASE_ID` — D1 database ID (qesto_3_db)
- `CF_ACCESS_CLIENT_ID` — Service Token client ID
- `CF_ACCESS_CLIENT_SECRET` — Service Token secret
- `KB_ADMIN_KEY` — Admin key (`qesto-kb-admin-phase1`)

Optional:

- `KB_SYNC_ENDPOINT` — Override endpoint URL (default: production)

## Workflows

### Local Development

```bash
# Edit knowledge base
vim knowledge-base/my-doc.md

# Check what changed
npm run kb:sync -- status

# Sync to Vectorize
npm run kb:sync
```

### CI/CD (GitHub Actions)

Workflow file already at `.github/workflows/kb-sync-on-merge.yml`

Triggers automatically on:
- Push to `main` with changes in `knowledge-base/**`

Add secrets to GitHub:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`
- `KB_ADMIN_KEY`

### Manual Sync (Production)

```bash
# Pull latest KB
git pull origin main

# Sync
npm run kb:sync

# Verify
npm run kb:sync -- status
```

## Troubleshooting

**Missing env vars**
```bash
export CLOUDFLARE_API_TOKEN="..." && npm run kb:sync
```

**Check what's pending**
```bash
npm run kb:sync -- status
```

**Reset and re-sync everything**
```bash
npm run kb:sync -- reset && npm run kb:sync
```

## Files

- `kb-sync-cli.ts` — Main CLI script
- `.kb-sync-manifest.json` — Tracks what's been synced (auto-created)
- `.github/workflows/kb-sync-on-merge.yml` — CI/CD automation

## Documentation

Full docs: `knowledge-base/operations/deployment/KB_SYNC_CLI_PHASE4.md`
