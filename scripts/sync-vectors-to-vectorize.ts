#!/usr/bin/env npx ts-node
/**
 * Direct Vectorize sync for Phase 1 bulk embedding.
 * Reads .kb-vectors-pending.json and upserts directly to Vectorize index.
 * Bypasses Worker authentication (useful when Cloudflare Access blocks endpoints).
 *
 * Usage:
 *   npx tsx scripts/sync-vectors-to-vectorize.ts
 *   npx tsx scripts/sync-vectors-to-vectorize.ts --dry-run
 *   npx tsx scripts/sync-vectors-to-vectorize.ts --resume-from=<offset>
 *
 * Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 */

import fs from 'fs'
import path from 'path'

const apiKey = process.env.CLOUDFLARE_API_TOKEN || ''
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || ''
const indexName = 'qesto-kb-production'

if (!apiKey || !accountId) {
  console.error('Error: Missing env vars. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID')
  process.exit(1)
}

const vectorFile = path.join(process.cwd(), '.kb-vectors-pending.json')
if (!fs.existsSync(vectorFile)) {
  console.error(`Error: Vector file not found: ${vectorFile}`)
  console.error(`Run 'npm run kb:embed' first to generate vectors`)
  process.exit(1)
}

const vectors = JSON.parse(fs.readFileSync(vectorFile, 'utf8'))
console.log(`Loaded ${vectors.length} vectors from ${vectorFile}`)

/**
 * Upsert via the Vectorize **v2** HTTP API: newline-delimited JSON at
 * `/vectorize/v2/indexes/{name}/upsert` with `Content-Type:
 * application/x-ndjson`. The previous code posted a JSON array to the v1 path,
 * which does not serve a v2 index (audit #15).
 */
async function upsertBatch(batch: Array<{ id: string; values: number[]; metadata: unknown }>) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName}/upsert`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-ndjson',
    },
    body: batch.map((v) => JSON.stringify(v)).join('\n'),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Vectorize upsert failed: ${response.status}\n${text}`)
  }

  return response.json()
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  // Resume a run that died partway: skip the first N vectors.
  const resumeArg = process.argv.find((a) => a.startsWith('--resume-from='))
  const resumeFrom = resumeArg ? Number(resumeArg.split('=')[1]) : 0
  if (!Number.isInteger(resumeFrom) || resumeFrom < 0) {
    console.error('--resume-from must be a non-negative integer')
    process.exit(1)
  }

  console.log(`\n${dryRun ? '[DRY RUN] Would sync' : 'Syncing'} ${vectors.length - resumeFrom} vectors to Vectorize...`)
  console.log(`Index: ${indexName}`)
  console.log(`Account: ${accountId}`)
  if (resumeFrom > 0) console.log(`Resuming from offset ${resumeFrom}`)
  console.log()

  const batchSize = 500
  let totalUpserted = 0
  let batchNum = 0

  for (let i = resumeFrom; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize)
    batchNum++

    if (dryRun) {
      console.log(`  [DRY] batch ${batchNum}: ${batch.length} vectors (offset ${i})`)
      totalUpserted += batch.length
      continue
    }

    try {
      await upsertBatch(batch)
      totalUpserted += batch.length
      console.log(`✓ Batch ${batchNum}: ${batch.length} vectors (total: ${totalUpserted}/${vectors.length - resumeFrom})`)
    } catch (err) {
      console.error(`✗ Batch ${batchNum} failed at offset ${i}:`, err)
      console.error(`  Resume with: npx tsx scripts/sync-vectors-to-vectorize.ts --resume-from=${i}`)
      process.exit(1)
    }
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] ${totalUpserted} vectors would be upserted. No writes performed.`)
    return
  }

  console.log(`\n✓ All ${totalUpserted} vectors upserted successfully!`)
  console.log(`\nNext: Verify search works`)
  console.log(
    `curl -X POST https://qesto.cc/api/knowledge-base/search -H "Authorization: Bearer <TOKEN>" \\`,
  )
  console.log(`  -H "Content-Type: application/json" -d '{"query": "architecture deployment"}'`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
