---
id: KB_SYNC_CLI_PHASE4
type: guide
domain: operations
category: deployment
status: active
version: 1.0
created: 2026-05-13
updated: 2026-05-13
tags:
  - kb-sync
  - automation
  - knowledge-base
  - vectorize
  - cli
---

# Phase 4: Automated KB Sync CLI

**Objective:** Enable automatic detection, embedding, and synchronization of knowledge-base changes to Cloudflare Vectorize without manual intervention.

**Status:** ✅ Available as `npm run kb:sync`

---

## Overview

The KB Sync CLI automates the entire knowledge-base update pipeline:

1. **Change Detection** — Detects new, modified, and deleted `.md` files in `knowledge-base/`
2. **Incremental Embedding** — Re-embeds only changed files (not the entire KB)
3. **Batch Upload** — Uploads vectors to Vectorize in 200-vector batches
4. **Manifest Tracking** — Maintains `.kb-sync-manifest.json` to avoid duplicate work
5. **Error Recovery** — Graceful failure handling with detailed logging

This enables:
- **Automated CI/CD workflows** (runs on content merges)
- **Local development syncing** (quick iteration)
- **Scheduled updates** (cron jobs, worker triggers)
- **Incremental scaling** (sync only what changed)

---

## Quick Start

### Prerequisites

Set environment variables (see **Configuration** section below):

```bash
export CLOUDFLARE_API_TOKEN="cfat_..."
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_D1_DATABASE_ID="..."
export CF_ACCESS_CLIENT_ID="..."
export CF_ACCESS_CLIENT_SECRET="..."
export KB_ADMIN_KEY="qesto-kb-admin-phase1"
```

### Basic Usage

```bash
# Sync changes (default command)
npm run kb:sync

# Check sync status
npm run kb:sync -- status

# Reset manifest (forces full re-embed on next sync)
npm run kb:sync -- reset
```

---

## Commands

### `npm run kb:sync` (default)

Detects changes and syncs to Vectorize.

**Output:**
```
🔄 KB Sync CLI — Phase 4 Automated Update

📊 Detected 3 change(s):
  ➕ knowledge-base/product/backlog/BACKLOG_MASTER.md
  🔄 knowledge-base/architecture/ARCHITECTURE.md
  ❌ knowledge-base/deprecated/old-spec.md

📝 Embedding 2 file(s)...
[...embedding in progress...]

⬆️  Uploading 127 vector(s)...
  ✓ Batch 1/1: 127 vectors

📈 Upload complete: 127 successful, 0 failed

✅ Sync complete! (Sync #5)
```

**Exit codes:**
- `0` — Success
- `1` — Error (check stderr)

---

### `npm run kb:sync -- status`

Show sync history and pending changes.

**Output:**
```
📊 KB Sync Status

Last sync: 2026-05-13T16:45:32.123Z
Total syncs: 5
Tracked files: 47
Total vectors: 2165

Pending changes: 2
  ➕ knowledge-base/product/releases/v2.2_NOTES.md
  🔄 knowledge-base/architecture/ARCHITECTURE.md
```

Use this to verify:
- Last sync timestamp
- How many changes are pending
- Total vector count in index

---

### `npm run kb:sync -- reset`

Clear the sync manifest (`.kb-sync-manifest.json`).

Next sync will treat all `.md` files as "new" and re-embed everything.

⚠️ **Use with caution** — triggers full KB re-embedding.

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | ✅ | Cloudflare API token (`cfat_...`) |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | Cloudflare account ID (hex string) |
| `CLOUDFLARE_D1_DATABASE_ID` | ✅ | D1 database ID (UUID) |
| `CF_ACCESS_CLIENT_ID` | ✅ | Cloudflare Access Service Token client ID |
| `CF_ACCESS_CLIENT_SECRET` | ✅ | Cloudflare Access Service Token client secret |
| `KB_ADMIN_KEY` | ✅ | Admin key for `/api/admin/kb-sync` endpoint |
| `KB_SYNC_ENDPOINT` | ❌ | Override endpoint (default: `https://qesto-api.oostelaar.workers.dev/api/admin/kb-sync`) |

### Local Development (.env)

Create `.env.local` or use inline exports:

```bash
export CLOUDFLARE_API_TOKEN="cfat_0vbrivvzWjQcSKs1Z9lRhJ91ip7AflIRzsHLaX5749fa2e73"
export CLOUDFLARE_ACCOUNT_ID="5546763229b35df670e33d9316d7f2e0"
export CLOUDFLARE_D1_DATABASE_ID="d391bdd5-a03d-41bc-bc45-6b5f3bac1b1b"
export CF_ACCESS_CLIENT_ID="8475c8b4d945a84c6efe7608ee4fc50f.access"
export CF_ACCESS_CLIENT_SECRET="ca5bcf9ab5bb5345b7130c2fc455daf8562d639c763411710e54b13a141ca1f6"
export KB_ADMIN_KEY="qesto-kb-admin-phase1"

npm run kb:sync
```

### CI/CD Integration

Use GitHub Secrets or equivalent:

```yaml
# .github/workflows/kb-sync.yml
on:
  push:
    paths:
      - 'knowledge-base/**'
      - '.github/workflows/kb-sync.yml'

jobs:
  kb-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run kb:sync
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_D1_DATABASE_ID: ${{ secrets.CLOUDFLARE_D1_DATABASE_ID }}
          CF_ACCESS_CLIENT_ID: ${{ secrets.CF_ACCESS_CLIENT_ID }}
          CF_ACCESS_CLIENT_SECRET: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}
          KB_ADMIN_KEY: ${{ secrets.KB_ADMIN_KEY }}
```

---

## How It Works

### Phase 1: Change Detection

1. **Scan KB directory** — Find all `.md` files in `knowledge-base/`
2. **Compute SHA-256 hash** of each file
3. **Compare to manifest** — Load `.kb-sync-manifest.json`
4. **Classify changes:**
   - `new` — File not in manifest
   - `modified` — Hash differs from manifest
   - `deleted` — In manifest but file no longer exists

### Phase 2: Embedding

For each changed file:

1. **Filter files** — Pass only changed files to embedding script
2. **Generate embeddings** — Use `scripts/embed-kb.ts` with Workers AI
3. **Group by source** — Organize vectors by source file
4. **Cache vectors** — Write to `.kb-vectors-pending.json`

### Phase 3: Upload

1. **Split into batches** — 200 vectors per batch (respects Worker timeout)
2. **Authenticate** — Use Cloudflare Access Service Token
3. **POST to `/api/admin/kb-sync`** — Upsert vectors to Vectorize index
4. **Track success** — Count upserted vectors per batch

### Phase 4: Manifest Update

1. **Record hashes** — Store SHA-256 of each synced file
2. **Log metadata** — Vector count, sync timestamp per file
3. **Increment counter** — Bump `syncCount` for audit trail
4. **Persist manifest** — Write `.kb-sync-manifest.json`

---

## Manifest Schema

`.kb-sync-manifest.json`:

```json
{
  "version": 1,
  "lastSync": 1715604332123,
  "syncCount": 5,
  "files": {
    "knowledge-base/product/backlog/BACKLOG_MASTER.md": {
      "hash": "a1b2c3d4...",
      "vectorCount": 127,
      "syncedAt": 1715604332123
    },
    "knowledge-base/architecture/ARCHITECTURE.md": {
      "hash": "e5f6g7h8...",
      "vectorCount": 95,
      "syncedAt": 1715604332123
    }
  }
}
```

---

## Error Handling

### Missing Environment Variables

```
❌ Error: Missing environment variables: CLOUDFLARE_API_TOKEN, CF_ACCESS_CLIENT_ID
```

**Fix:** Set all required variables (see **Configuration**).

### Embedding Failure

```
❌ Error: Embedding failed: CLOUDFLARE_D1_DATABASE_ID not recognized
```

**Fix:**
1. Verify D1 database ID in `wrangler.toml`
2. Confirm API token has D1 access

### Upload Authentication Failure

```
❌ Error: HTTP 403: Unauthorized
```

**Fix:**
1. Verify `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`
2. Check Service Token is not expired
3. Confirm token is assigned to the Cloudflare Access policy

### Vector Dimension Mismatch

```
❌ Error: HTTP 400: the vector length is incorrect for this index; must be 1024
```

**Fix:** Re-run `npm run kb:embed` to generate correct dimensions.

### Partial Upload Failure

```
📈 Upload complete: 195 successful, 5 failed

✅ Sync complete! (Sync #5)
```

- Some batches succeed, others fail
- Manifest is only updated for successful uploads
- Re-run sync to retry failed files

---

## Best Practices

### Local Development

```bash
# 1. Create/edit KB files
vim knowledge-base/my-doc.md

# 2. Check status
npm run kb:sync -- status

# 3. Sync changes
npm run kb:sync

# 4. Verify in production
curl 'https://qesto-api.oostelaar.workers.dev/api/kb-search?q=...' \
  -H "Authorization: Bearer ..."
```

### CI/CD Automation

- **Trigger on KB changes** — Add GitHub workflow on `knowledge-base/**` path filter
- **Fail the workflow on errors** — Exit code 1 blocks merges
- **Log manifest** — Archive `.kb-sync-manifest.json` for audit
- **Slack notification** — Post sync summary to ops channel

### Scheduled Updates (Optional)

Use Cloudflare Workers Cron:

```typescript
// worker/cron.ts
export async function handleCron(req: Request, env: Env): Promise<Response> {
  // Trigger kb-sync via wrangler CLI
  const result = await runCommand('npm run kb:sync', {
    env: { ...process.env, ...env }
  });
  return new Response(result);
}
```

---

## Troubleshooting

### Vectors Not Appearing in Index

```bash
# 1. Check sync was successful
npm run kb:sync -- status

# 2. Verify Vectorize index exists
wrangler vectorize list

# 3. Query the index (use admin-only endpoint)
curl 'https://qesto-api.oostelaar.workers.dev/api/admin/kb-search?q=test' \
  -H "x-admin-key: qesto-kb-admin-phase1"
```

### Manifest Out of Sync

If manifest gets corrupted or out of sync:

```bash
# Reset and re-sync everything
npm run kb:sync -- reset
npm run kb:sync
```

### Performance: Large KB

If KB is very large (>500 files, >100k tokens):

1. Split into smaller domains (by `knowledge-base/*/` subdirectory)
2. Run separate syncs per domain
3. Customize `BATCH_SIZE` in `kb-sync-cli.ts` if Worker times out

---

## Example Workflows

### Sync After Merge

```bash
# On main branch after KB merge
git pull origin main
npm run kb:sync
```

### Daily Snapshot (Cron)

```bash
# In CI cron job (daily at 2 AM)
0 2 * * * cd /path/to/qesto && npm run kb:sync
```

### Manual Review + Deploy

```bash
# 1. Review changes locally
npm run kb:sync -- status

# 2. If satisfied, sync
npm run kb:sync

# 3. Commit manifest (optional, for audit trail)
git add .kb-sync-manifest.json
git commit -m "chore: Update KB sync manifest"
git push
```

---

## Metrics & Monitoring

Track in observability system:

| Metric | Query | Threshold |
|---|---|---|
| Sync success rate | `(success_count / (success_count + failed_count)) * 100` | ≥95% |
| Embedding latency | Time to embed all changed files | <5min for 50 files |
| Upload latency | Time to POST all batches | <2min for 2k vectors |
| Manifest freshness | `now() - lastSync` | <24h (for daily runs) |

---

## Next Steps

### Phase 5: Scheduled Sync Worker

Integrate with Cloudflare Workers Cron to auto-sync on schedule:

```typescript
// On cron tick
const result = await fetch('https://qesto-api.oostelaar.workers.dev/api/admin/kb-sync', {
  method: 'POST',
  headers: { /* auth */ },
  body: JSON.stringify(allPendingVectors),
});
```

### Phase 6: Knowledge-Base Search API

Add public search endpoint using Vectorize:

```typescript
// GET /api/kb-search?q=authentication
const results = await KB_VECTORIZE.query(embedding, { topK: 10 });
return json(results.map(r => ({ file: r.metadata.doc_id, excerpt: r.metadata.content })));
```

---

## See Also

- [KB Embedding Script](./KB_EMBEDDING_PHASE1.md)
- [Vectorize Setup](./VECTORIZE_SETUP.md)
- [Cloudflare Access Policy](./CF_ACCESS_SETUP.md)
- [Knowledge-Base Structure](../knowledge-base/README.md)
