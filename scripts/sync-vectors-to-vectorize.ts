#!/usr/bin/env npx ts-node
/**
 * Direct Vectorize sync for Phase 1 bulk embedding.
 * Reads .kb-vectors-pending.json and upserts directly to Vectorize index.
 * Bypasses Worker authentication (useful when Cloudflare Access blocks endpoints).
 *
 * Usage:
 *   npx tsx scripts/sync-vectors-to-vectorize.ts
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

async function upsertBatch(batch: Array<{ id: string; values: number[]; metadata: unknown }>) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/indexes/${indexName}/upsert`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(batch),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Vectorize upsert failed: ${response.status}\n${text}`)
  }

  return response.json()
}

async function main() {
  console.log(`\nSyncing ${vectors.length} vectors to Vectorize...`)
  console.log(`Index: ${indexName}`)
  console.log(`Account: ${accountId}\n`)

  const batchSize = 500
  let totalUpserted = 0
  let batchNum = 0

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize)
    batchNum++

    try {
      await upsertBatch(batch)
      totalUpserted += batch.length
      console.log(`✓ Batch ${batchNum}: ${batch.length} vectors (total: ${totalUpserted}/${vectors.length})`)
    } catch (err) {
      console.error(`✗ Batch ${batchNum} failed:`, err)
      process.exit(1)
    }
  }

  console.log(`\n✓ All ${totalUpserted} vectors upser successfully!`)
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
