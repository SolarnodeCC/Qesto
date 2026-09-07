#!/usr/bin/env node
/**
 * Report — and optionally create — the Vectorize metadata indexes the query
 * paths depend on (audit #13).
 *
 * A Vectorize `filter` only takes effect on a property that has a metadata
 * index. Without one the filter does not narrow the search the way the calling
 * code assumes, and there is no error to notice. Every tenant-scoped query in
 * this codebase therefore ALSO re-checks the scope on the returned rows, so a
 * missing index degrades efficiency and recall rather than isolation — but the
 * indexes still need to exist for the filters to do their job.
 *
 * Two properties of the Cloudflare API make this worth a dedicated tool:
 *   - Metadata indexes are NOT retroactive. "Vectors upserted before a metadata
 *     index was created won't have their metadata contained in that index."
 *     Creating one therefore requires re-upserting the whole index afterwards.
 *   - Only 10 metadata indexes are allowed per Vectorize index.
 *
 * Usage:
 *   npx tsx scripts/vectorize-metadata-indexes.ts             # report only (default)
 *   npx tsx scripts/vectorize-metadata-indexes.ts --apply     # create the missing ones
 *
 * Requires CLOUDFLARE_API_TOKEN (Vectorize Read, plus Vectorize Edit for
 * --apply) and CLOUDFLARE_ACCOUNT_ID.
 */

const REQUIRED: Array<{ index: string; property: string; type: 'string'; usedBy: string }> = [
  // kbVectorRepository.queryVector() filters on all three.
  { index: 'qesto-kb-production', property: 'status', type: 'string', usedBy: 'kbVectorRepository.queryVector' },
  { index: 'qesto-kb-production', property: 'domain', type: 'string', usedBy: 'kbVectorRepository.queryVector' },
  { index: 'qesto-kb-production', property: 'type', type: 'string', usedBy: 'kbVectorRepository.queryVector' },
  // Tenant scoping for decision memory.
  { index: 'qesto-decisions', property: 'team_id', type: 'string', usedBy: 'insights-vectorize, studio-suggest, agent-grounding' },
  // Plan-scope filtering for the help assistant (currently post-query only).
  { index: 'qesto-help', property: 'scope', type: 'string', usedBy: 'help-vectorize (post-query today)' },
]

function cfEnv() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!apiToken || !accountId) {
    console.error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID.')
    process.exit(1)
  }
  return { apiToken, accountId }
}

function base(accountId: string, index: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${index}`
}

async function listMetadataIndexes(accountId: string, apiToken: string, index: string): Promise<string[] | null> {
  const res = await fetch(`${base(accountId, index)}/metadata_index/list`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })
  if (!res.ok) {
    console.error(`  ! could not list metadata indexes for ${index}: ${res.status} ${await res.text()}`)
    return null
  }
  const body = (await res.json()) as {
    result?: { metadataIndexes?: Array<{ propertyName?: string }> }
  }
  return (body.result?.metadataIndexes ?? []).map((m) => m.propertyName ?? '').filter(Boolean)
}

async function createMetadataIndex(
  accountId: string,
  apiToken: string,
  index: string,
  propertyName: string,
  indexType: string,
): Promise<boolean> {
  const res = await fetch(`${base(accountId, index)}/metadata_index/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyName, indexType }),
  })
  if (!res.ok) {
    console.error(`  ✗ create ${index}.${propertyName} failed: ${res.status} ${await res.text()}`)
    return false
  }
  return true
}

async function main() {
  const apply = process.argv.includes('--apply')
  const { apiToken, accountId } = cfEnv()

  console.log(`Vectorize metadata indexes — ${apply ? 'APPLY' : 'report only (pass --apply to create)'}\n`)

  const indexes = [...new Set(REQUIRED.map((r) => r.index))]
  let missingTotal = 0
  let createdTotal = 0

  for (const index of indexes) {
    console.log(`${index}:`)
    const existing = await listMetadataIndexes(accountId, apiToken, index)
    if (existing === null) continue

    for (const req of REQUIRED.filter((r) => r.index === index)) {
      if (existing.includes(req.property)) {
        console.log(`  ✓ ${req.property} (${req.usedBy})`)
        continue
      }
      missingTotal++
      if (!apply) {
        console.log(`  ✗ ${req.property} MISSING — filtered by ${req.usedBy}`)
        continue
      }
      if (await createMetadataIndex(accountId, apiToken, index, req.property, req.type)) {
        createdTotal++
        console.log(`  + ${req.property} created`)
      }
    }
    console.log()
  }

  if (missingTotal === 0) {
    console.log('All required metadata indexes exist.')
    return
  }

  if (!apply) {
    console.log(`${missingTotal} metadata index(es) missing. Re-run with --apply to create them.`)
    process.exitCode = 1
    return
  }

  console.log(`Created ${createdTotal} of ${missingTotal} missing metadata index(es).`)
  console.log()
  console.log('⚠  Metadata indexes are NOT retroactive: vectors upserted before')
  console.log('   creation are not represented in them. Re-upsert each affected')
  console.log('   index before relying on the filters:')
  console.log('     qesto-kb-production  ->  npm run kb:sync -- --force')
  console.log('     qesto-help           ->  npm run help:sync -- --force')
  console.log('     qesto-decisions      ->  fills forward from closed sessions;')
  console.log('                              historical vectors need a backfill.')
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
