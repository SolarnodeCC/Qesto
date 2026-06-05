#!/usr/bin/env node
/**
 * KB Vectorize health check.
 *
 * Confirms the knowledge-base vector pipeline is actually populated and
 * consistent — the question "is our KB Vectorize working well?" answered with
 * numbers instead of assumptions.
 *
 * Two layers:
 *   1. LOCAL  — walks knowledge-base/*.md, reads .kb-sync-manifest.json, and
 *               reports tracked files, expected vector total, and pending
 *               (un-synced) changes. Always runs; needs no credentials.
 *   2. REMOTE — if CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN are set, queries
 *               the Vectorize v2 REST API for each index's live dimensions and
 *               vector count, and compares the KB index against the manifest.
 *
 * Exit codes: 0 = healthy (or local-only), 1 = a hard problem was found
 * (KB index empty while files exist, or KB index dimension != expected).
 *
 * Usage:  npm run kb:health
 */
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const KB_DIR = 'knowledge-base'
const MANIFEST_FILE = '.kb-sync-manifest.json'
const KB_EXPECTED_DIM = 1024 // bge-m3 — must match scripts/embed-kb.ts and kbSearchService.ts

interface ManifestFile {
  hash: string
  vectorCount: number
}
interface SyncManifest {
  lastSync?: number
  syncCount?: number
  files?: Record<string, ManifestFile>
}

interface IndexSpec {
  binding: string
  name: string
  expectedDim?: number // asserted (hard fail) when set
  fileBacked?: boolean // true only for the index fed by knowledge-base/*.md (empty-check uses file count)
}

// All three indexes embed with bge-m3 (1024 dims). A different dimension means
// the index was created for the wrong model and retrieval is broken.
const INDEXES: IndexSpec[] = [
  { binding: 'KB_VECTORIZE', name: 'qesto-kb-production', expectedDim: KB_EXPECTED_DIM, fileBacked: true },
  { binding: 'HELP_VECTORIZE', name: 'qesto-help', expectedDim: 1024 },
  { binding: 'DECISIONS_VECTORIZE', name: 'qesto-decisions', expectedDim: 1024 },
]

function loadManifest(): SyncManifest {
  if (!fs.existsSync(MANIFEST_FILE)) return {}
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8')) as SyncManifest
  } catch {
    return {}
  }
}

function walkKbFiles(): string[] {
  const out: string[] = []
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full)
    }
  }
  if (fs.existsSync(KB_DIR)) walk(KB_DIR)
  return out.sort()
}

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file, 'utf-8')).digest('hex')
}

/** Files that are new or changed vs the manifest, plus files deleted from disk. */
function pendingChanges(manifest: SyncManifest): { changed: string[]; deleted: string[] } {
  const tracked = manifest.files ?? {}
  const current = new Set(walkKbFiles())
  const changed: string[] = []
  for (const file of current) {
    const known = tracked[file]
    if (!known || known.hash !== sha256(file)) changed.push(file)
  }
  const deleted = Object.keys(tracked).filter((f) => !current.has(f))
  return { changed, deleted }
}

interface IndexInfo {
  name: string
  dimensions?: number
  vectorCount?: number
  error?: string
}

async function fetchIndexInfo(accountId: string, token: string, name: string): Promise<IndexInfo> {
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${name}`
  const headers = { Authorization: `Bearer ${token}` }
  try {
    const [cfg, info] = await Promise.all([
      fetch(base, { headers }).then((r) => r.json() as Promise<any>),
      fetch(`${base}/info`, { headers }).then((r) => r.json() as Promise<any>),
    ])
    if (cfg?.success === false) {
      return { name, error: cfg.errors?.[0]?.message ?? 'index not found' }
    }
    const dimensions: unknown = cfg?.result?.config?.dimensions ?? info?.result?.dimensions
    // Count key has drifted across Vectorize API versions — accept any spelling.
    const vectorCount: unknown =
      info?.result?.vectorCount ?? info?.result?.vectorsCount ?? info?.result?.count
    const out: IndexInfo = { name }
    if (typeof dimensions === 'number') out.dimensions = dimensions
    if (typeof vectorCount === 'number') out.vectorCount = vectorCount
    return out
  } catch (err) {
    return { name, error: err instanceof Error ? err.message : String(err) }
  }
}

async function main() {
  let hardFailure = false
  const manifest = loadManifest()
  const files = walkKbFiles()
  const expectedVectors = Object.values(manifest.files ?? {}).reduce((s, f) => s + (f.vectorCount ?? 0), 0)
  const { changed, deleted } = pendingChanges(manifest)

  console.log('KB Vectorize health check\n=========================\n')

  // ── Local ────────────────────────────────────────────────────────────────
  console.log('Local (knowledge-base/ + manifest):')
  console.log(`  KB markdown files on disk : ${files.length}`)
  console.log(`  Files tracked in manifest : ${Object.keys(manifest.files ?? {}).length}`)
  console.log(`  Expected vectors (manifest): ${expectedVectors}`)
  console.log(`  Last sync                 : ${manifest.lastSync ? new Date(manifest.lastSync).toISOString() : 'never'}`)
  console.log(`  Pending changes           : ${changed.length} changed/new, ${deleted.length} deleted`)
  if (changed.length || deleted.length) {
    console.log('  → KB is out of date vs the index. Run `npm run kb:sync` (CI does this on merge).')
  }
  console.log('')

  // ── Remote ───────────────────────────────────────────────────────────────
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!accountId || !token) {
    console.log('Remote: skipped (set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to check live indexes).')
    console.log('\nVerdict: local-only check passed.')
    process.exit(0)
  }

  console.log('Remote (Cloudflare Vectorize):')
  for (const spec of INDEXES) {
    const info = await fetchIndexInfo(accountId, token, spec.name)
    if (info.error) {
      console.log(`  ✗ ${spec.binding} (${spec.name}): ${info.error}`)
      if (spec.expectedDim) hardFailure = true
      continue
    }
    const dim = info.dimensions ?? 'unknown'
    const count = info.vectorCount ?? 'unknown'
    console.log(`  • ${spec.binding} (${spec.name}): ${count} vectors, ${dim} dims`)

    if (spec.expectedDim && typeof info.dimensions === 'number' && info.dimensions !== spec.expectedDim) {
      console.log(`    ✗ dimension ${info.dimensions} != expected ${spec.expectedDim} — retrieval will fail`)
      hardFailure = true
    }
    if (spec.fileBacked && typeof info.vectorCount === 'number' && info.vectorCount === 0 && files.length > 0) {
      console.log(`    ✗ index is EMPTY but ${files.length} KB files exist — never synced. Run \`npm run kb:sync\`.`)
      hardFailure = true
    } else if (!spec.fileBacked && info.vectorCount === 0) {
      console.log(`    ⚠ index is empty — ${spec.binding} feature has no vectors to retrieve (re-seed/re-index).`)
    }
    if (
      spec.fileBacked &&
      typeof info.vectorCount === 'number' &&
      info.vectorCount > 0 &&
      expectedVectors > 0 &&
      info.vectorCount < expectedVectors * 0.9
    ) {
      console.log(`    ⚠ index has ${info.vectorCount} vectors but manifest expects ~${expectedVectors} (possible drift)`)
    }
  }

  console.log(`\nVerdict: ${hardFailure ? 'PROBLEMS FOUND (see ✗ above)' : 'healthy'}.`)
  process.exit(hardFailure ? 1 : 0)
}

main().catch((err) => {
  console.error('kb-health failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
