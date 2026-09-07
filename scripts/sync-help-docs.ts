#!/usr/bin/env node
/**
 * sync-help-docs.ts — push the help-assistant RAG index to Cloudflare on merge.
 *
 * SINGLE SOURCE OF TRUTH: functions/api/seed/help-documents.json, which is itself
 * generated from knowledge-base/help/*.md by scripts/generate-help-seed.mjs (one
 * chunk per H2). This script indexes those chunked documents with stable ids — no
 * more "whole-file vs chunked" divergence in the qesto-help index.
 *
 * For each chunk it:
 *   - embeds `title + excerpt + content` with bge-m3 (1024-dim)
 *   - upserts a Vectorize vector with the STABLE id `help-<chunk.id>` (re-syncs
 *     overwrite in place instead of orphaning timestamped duplicates)
 *   - upserts the D1 help_documents row (id = chunk.id, published_at set)
 * Chunks removed since the last run (tracked in the manifest) are deleted from
 * both Vectorize and D1. The whole script is advisory — per-chunk failures are
 * counted, never fatal (help sync must not block a merge).
 *
 * Usage:
 *   npx tsx scripts/sync-help-docs.ts            # live
 *   npx tsx scripts/sync-help-docs.ts --dry-run  # no network writes
 *   npx tsx scripts/sync-help-docs.ts --force     # re-sync every chunk
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { fileURLToPath } from 'url'
import { z } from 'zod'
import { BGE_M3_MODEL, BGE_M3_EMBED_DIM, workersAiRunUrl } from '../functions/api/lib/embedding-model'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MANIFEST_FILE = '.help-sync-manifest.json'
const SEED_FILE = path.join(__dirname, '../functions/api/seed/help-documents.json')
const INDEX_NAME = 'qesto-help'
// Single source of truth — must match the qesto-help index (see VECTORIZE_DIM_FIX_2026-06).
const EMBED_DIM = BGE_M3_EMBED_DIM

interface HelpChunk {
  id: string
  title: string
  topic: string
  scope: 'free' | 'starter' | 'team'
  excerpt: string
  content: string
}

interface HelpSyncManifest {
  version: 2
  lastSync: number
  syncCount: number
  /** chunkId -> { hash, syncedAt } */
  chunks: Record<string, { hash: string; syncedAt: number }>
}

function loadManifest(): HelpSyncManifest {
  if (fs.existsSync(MANIFEST_FILE)) {
    try {
      const m = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'))
      if (m && m.version === 2 && m.chunks) return m as HelpSyncManifest
    } catch {
      // fall through to a fresh manifest (e.g. legacy v1 file)
    }
  }
  return { version: 2, lastSync: 0, syncCount: 0, chunks: {} }
}

function saveManifest(manifest: HelpSyncManifest): void {
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2))
}

function chunkHash(c: HelpChunk): string {
  return crypto
    .createHash('sha256')
    .update(`${c.title}\n${c.scope}\n${c.topic}\n${c.excerpt}\n${c.content}`)
    .digest('hex')
}

function loadChunks(): HelpChunk[] {
  if (!fs.existsSync(SEED_FILE)) throw new Error(`Seed not found: ${SEED_FILE} (run npm run help:seed:build)`)
  const docs = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8')) as HelpChunk[]
  for (const d of docs) {
    for (const k of ['id', 'title', 'topic', 'scope', 'excerpt', 'content'] as const) {
      if (!d[k]) throw new Error(`Seed chunk missing "${k}": ${JSON.stringify(d).slice(0, 120)}`)
    }
  }
  return docs
}

function cfEnv() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!apiToken || !accountId) throw new Error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID')
  return { apiToken, accountId }
}

async function embedWithCF(text: string): Promise<number[]> {
  const { apiToken, accountId } = cfEnv()
  // Routed through AI Gateway when configured (audit #20).
  const url = workersAiRunUrl(accountId, BGE_M3_MODEL, process.env.CLOUDFLARE_AI_GATEWAY_ID)
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`Embed failed: ${res.status} ${await res.text()}`)
  // Validate the embedding response at the boundary (HLT-031, #686) instead of `as any`.
  const parsed = z
    .object({
      result: z
        .object({
          data: z.array(z.object({ embeddings: z.array(z.number()).optional() })).optional(),
          embeddings: z.array(z.number()).optional(),
        })
        .optional(),
    })
    .safeParse(await res.json())
  const result = parsed.success ? parsed.data.result : undefined
  const embeddings = result?.data?.[0]?.embeddings || result?.embeddings
  if (!Array.isArray(embeddings)) throw new Error('Invalid embedding response')
  if (embeddings.length !== EMBED_DIM) throw new Error(`Expected ${EMBED_DIM}-dim (bge-m3), got ${embeddings.length}`)
  return embeddings
}

type VectorRecord = { id: string; values: number[]; metadata: Record<string, unknown> }

/**
 * Vectors per upsert request. Cloudflare allows 5000 over the HTTP API; 200
 * keeps each request comfortably small (a 1024-dim float32 vector serialises to
 * ~20KB of JSON) while replacing what used to be one HTTP round-trip per chunk
 * (audit #16).
 */
const UPSERT_BATCH_SIZE = 200

/**
 * Upsert a batch of vectors via the Vectorize **v2** HTTP API.
 *
 * v2 takes newline-delimited JSON at
 * `/vectorize/v2/indexes/{name}/upsert` with `Content-Type:
 * application/x-ndjson`. The previous code posted a JSON object to the v1 path
 * `/vectorize/indexes/{name}/upsert`, which does not serve a v2 index (audit #15).
 */
async function upsertVectors(vectors: VectorRecord[]): Promise<void> {
  if (vectors.length === 0) return
  const { apiToken, accountId } = cfEnv()
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${INDEX_NAME}/upsert`
  for (let i = 0; i < vectors.length; i += UPSERT_BATCH_SIZE) {
    const batch = vectors.slice(i, i + UPSERT_BATCH_SIZE)
    const ndjson = batch.map((v) => JSON.stringify(v)).join('\n')
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/x-ndjson' },
      body: ndjson,
    })
    if (!res.ok) throw new Error(`Vectorize upsert failed: ${res.status} ${await res.text()}`)
  }
}

async function deleteVectors(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { apiToken, accountId } = cfEnv()
  // v2 spells this `delete_by_ids` (underscores); the v1 path was `delete-by-ids`.
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${INDEX_NAME}/delete_by_ids`
  for (let i = 0; i < ids.length; i += UPSERT_BATCH_SIZE) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids.slice(i, i + UPSERT_BATCH_SIZE) }),
    })
    if (!res.ok) throw new Error(`Vectorize delete failed: ${res.status} ${await res.text()}`)
  }
}

async function d1Query(sql: string, params: unknown[]): Promise<void> {
  const { apiToken, accountId } = cfEnv()
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID
  if (!databaseId) throw new Error('Missing CLOUDFLARE_D1_DATABASE_ID')
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  if (!res.ok) throw new Error(`D1 query failed: ${res.status} ${await res.text()}`)
}

/** Embed a chunk and return its vector record (no network write). */
async function buildChunkVector(c: HelpChunk): Promise<VectorRecord> {
  const embedding = await embedWithCF(`${c.title}\n${c.excerpt}\n\n${c.content}`)
  return {
    id: `help-${c.id}`,
    values: embedding,
    metadata: { document_id: c.id, title: c.title, topic: c.topic, scope: c.scope },
  }
}

async function writeChunkRow(c: HelpChunk): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await d1Query(
    `INSERT OR REPLACE INTO help_documents (id, title, content, topic, scope, excerpt, embedding_id, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.id, c.title, c.content, c.topic, c.scope, c.excerpt, `help-${c.id}`, now, now, now],
  )
}

async function deleteChunk(id: string): Promise<void> {
  await deleteVectors([`help-${id}`])
  await d1Query('DELETE FROM help_documents WHERE id = ?', [id])
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const force = process.argv.includes('--force')
  console.log(`🚀 Help Docs Sync (chunked) - ${dryRun ? '[DRY RUN]' : '[LIVE]'}`)

  const chunks = loadChunks()
  const manifest = loadManifest()
  const currentIds = new Set(chunks.map((c) => c.id))

  const toUpsert = chunks.filter((c) => force || manifest.chunks[c.id]?.hash !== chunkHash(c))
  const toDelete = Object.keys(manifest.chunks).filter((id) => !currentIds.has(id))

  console.log(`📊 ${chunks.length} chunks total · ${toUpsert.length} to upsert · ${toDelete.length} to delete`)

  if (dryRun) {
    for (const c of toUpsert) console.log(`  [DRY] upsert help-${c.id}`)
    for (const id of toDelete) console.log(`  [DRY] delete help-${id}`)
    console.log('✨ Dry run complete (no writes)')
    return
  }

  let synced = 0
  let failed = 0

  // Phase 1: embed every changed chunk (one AI call each — unavoidable).
  const pending: Array<{ chunk: HelpChunk; vector: VectorRecord }> = []
  for (const c of toUpsert) {
    try {
      pending.push({ chunk: c, vector: await buildChunkVector(c) })
    } catch (err) {
      failed++
      console.error(`  ❌ embed help-${c.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Phase 2: one batched upsert for everything that embedded successfully,
  // instead of one HTTP round-trip per chunk (audit #16).
  if (pending.length > 0) {
    try {
      await upsertVectors(pending.map((p) => p.vector))
      for (const { chunk } of pending) {
        await writeChunkRow(chunk)
        manifest.chunks[chunk.id] = { hash: chunkHash(chunk), syncedAt: Date.now() }
        synced++
        console.log(`  ✅ help-${chunk.id}`)
      }
    } catch (err) {
      failed += pending.length
      console.error(`  ❌ upsert batch failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  for (const id of toDelete) {
    try {
      await deleteChunk(id)
      delete manifest.chunks[id]
      console.log(`  🗑️  help-${id}`)
    } catch (err) {
      // Advisory: a failed delete leaves an orphan, never nukes unknown vectors.
      console.error(`  ⚠️  delete help-${id} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  manifest.lastSync = Date.now()
  manifest.syncCount++
  saveManifest(manifest)
  console.log(`📈 Summary: ${synced} synced, ${failed} failed, ${toDelete.length} removed`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
