#!/usr/bin/env npx ts-node
/**
 * Bulk vectorization script for knowledge-base semantic search (ADR-040 Phase 1).
 * Walks knowledge-base/**\*.md, chunks, embeds via Cloudflare Workers AI, upserts to D1 + Vectorize.
 *
 * Usage:
 *   npm run kb:embed                    # Full bulk embed (hash-gated)
 *   npm run kb:embed -- --dry-run       # Preview chunking only
 *   npm run kb:embed -- --limit 5       # Test on 5 files
 *   npm run kb:embed -- --verify        # Verify index freshness against git
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { z } from 'zod'
import type { KbSyncDocumentFields, KbSyncRecord } from '../functions/api/types/knowledge-base'

// Local imports (must build/transpile mdChunker first or inline here)
// For now, we'll inline the essentials to avoid require() complexity in ts-node

interface Chunk {
  docId: string
  chunkIndex: number
  headingPath: string
  text: string
  startLine: number
  endLine: number
  hash: string
  tokenEstimate: number
}

interface FrontmatterMeta {
  id: string
  type: string
  domain: string
  status: string
  tags: string[]
  relates_to: string[]
  title?: string
  version?: string
  owner?: string
  category?: string
}

// The sync record shape (vector + D1 document/chunk fields) is the shared
// contract in functions/api/types/knowledge-base.ts (KbSyncRecord). Emitting the
// D1 fields here is what keeps kb_documents/kb_chunks populated alongside
// Vectorize so kb_search can hydrate and actually return hits.

// CLI args
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const limitFiles = args.find((a) => a.startsWith('--limit'))
  ? parseInt(args[args.indexOf('--limit') + 1], 10)
  : undefined
const kbRoot = path.join(process.cwd(), 'knowledge-base')
const apiKey = process.env.CLOUDFLARE_API_TOKEN || ''
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || ''
const dbId = process.env.CLOUDFLARE_D1_DATABASE_ID || ''
// Path to a JSON array of file paths to restrict embedding to (written by
// kb-sync-cli.ts for incremental syncs). Unset/missing means "embed everything".
const embedFilesListPath = process.env.KB_EMBED_FILES
// Sequential per-chunk embedding calls (one HTTP round-trip each) don't scale to
// the full ~480-file corpus within CI's job timeout — bound concurrency instead.
const EMBED_CONCURRENCY = Number(process.env.KB_EMBED_CONCURRENCY) || 8

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function parseYAMLSimple(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split('\n')
  let inArray: string | null = null

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue

    if (line.startsWith('tags:')) {
      inArray = 'tags'
      const inline = line.slice(5).trim()
      if (inline.startsWith('[')) {
        result.tags = inline
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter((s) => s)
        inArray = null
      } else {
        result.tags = []
      }
    } else if (line.startsWith('relates_to:')) {
      inArray = 'relates_to'
      const inline = line.slice(11).trim()
      if (inline.startsWith('[')) {
        result.relates_to = inline
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter((s) => s)
        inArray = null
      } else {
        result.relates_to = []
      }
    } else if (inArray && line.startsWith('-')) {
      const item = line.slice(1).trim().replace(/['"]/g, '')
      if (inArray === 'tags') (result.tags as string[]).push(item)
      else if (inArray === 'relates_to') (result.relates_to as string[]).push(item)
    } else if (inArray && !line.startsWith(' ')) {
      inArray = null
    }

    // Key: value pairs. Exclude the list keys: a bracketed `tags: [...]` /
    // `relates_to: [...]` was already parsed into an array above (and reset
    // inArray to null), so without this guard the generic matcher would clobber
    // that array with the raw string — which later throws on `.join()` and drops
    // the whole file.
    const match = line.match(/^([a-z_]+):\s*(.+)$/)
    if (match && !inArray && match[1] !== 'tags' && match[1] !== 'relates_to') {
      const [, key, value] = match
      result[key] = value.trim().replace(/['"]/g, '')
    }
  }

  return result
}

// Map a top-level knowledge-base/ folder to the closest KbType. Files without
// frontmatter still need a `type` for the kb_documents row + Vectorize metadata
// filter; default to 'unknown' when the folder isn't a recognised bucket.
// Keep in sync with KbType in functions/api/types/knowledge-base.ts.
function inferTypeFromPath(relPath: string): string {
  const top = relPath.split(path.sep)[0]
  switch (top) {
    case 'adr':
      return 'adr'
    case 'specifications':
      return 'spec'
    case 'operations':
      return 'guide'
    case 'experiments':
      return 'experiment'
    default:
      return 'unknown'
  }
}

// Stable, collision-free doc id for a file that has no frontmatter `id`. Derived
// from the repo-relative path so two different files never collide on the old
// 'unknown' fallback (which produced duplicate `unknown#0` chunk ids and made
// the D1 upsert clobber unrelated docs on the doc_id PRIMARY KEY).
function idFromPath(filePath: string): string {
  const rel = path.relative(kbRoot, filePath).replace(/\.md$/i, '')
  return rel.replace(/[^a-zA-Z0-9._-]+/g, '-')
}

function firstH1(body: string): string | undefined {
  const m = body.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : undefined
}

// Coerce a frontmatter list field to a string[]. parseYAMLSimple leaves an
// un-bracketed inline list (`tags: a, b`) as a raw string, which later blows up
// on `.join()` and drops the whole file. Normalise here instead. (F1)
export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v))
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean)
  }
  return []
}

// Synthesize metadata for a file with no YAML frontmatter so it is embedded like
// any other doc instead of being silently dropped (F1). type/domain are inferred
// from the folder; status defaults to 'accepted' so the doc is visible to
// default kb_search (which filters status='accepted').
export function deriveMetaFromPath(filePath: string, body: string): FrontmatterMeta {
  const rel = path.relative(kbRoot, filePath)
  const top = rel.split(path.sep)[0] || 'unknown'
  return {
    id: idFromPath(filePath),
    type: inferTypeFromPath(rel),
    domain: top,
    status: 'accepted',
    tags: [],
    relates_to: [],
    title: firstH1(body) || path.basename(filePath, '.md'),
  }
}

export function parseFrontmatter(
  markdown: string,
  filePath: string,
): {
  meta: FrontmatterMeta
  body: string
} {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) {
    // No frontmatter — synthesize metadata from the path instead of throwing.
    // Previously these files (~28% of the corpus) were caught and dropped from
    // the index entirely. F1.
    return { meta: deriveMetaFromPath(filePath, markdown), body: markdown }
  }

  const yamlText = match[1]
  const body = markdown.slice(match[0].length)
  const parsed = parseYAMLSimple(yamlText)
  const fallback = deriveMetaFromPath(filePath, body)

  return {
    meta: {
      // id/type/domain/title fall back to path-derived values (never the old
      // 'unknown' id) so a doc missing a field still lands with a unique id.
      id: parsed.id ? String(parsed.id) : fallback.id,
      type: String(parsed.type || fallback.type),
      domain: String(parsed.domain || fallback.domain),
      status: String(parsed.status || 'draft'),
      tags: toStringArray(parsed.tags),
      relates_to: toStringArray(parsed.relates_to),
      title: parsed.title ? String(parsed.title) : (fallback.title ?? path.basename(filePath, '.md')),
      ...(parsed.version ? { version: String(parsed.version) } : {}),
      ...(parsed.owner ? { owner: String(parsed.owner) } : {}),
      ...(parsed.category ? { category: String(parsed.category) } : {}),
    },
    body,
  }
}

export function chunkMarkdown(docId: string, body: string, meta: FrontmatterMeta): Chunk[] {
  const sections = parseMarkdownSections(body)
  const chunks: Chunk[] = []
  let chunkIndex = 0

  for (const section of sections) {
    const subChunks = packIntoChunks(section)
    for (const subChunk of subChunks) {
      const embeddingInput = formatEmbeddingInput(
        {
          docId,
          chunkIndex,
          headingPath: section.heading,
          text: subChunk.text,
          startLine: subChunk.startLine,
          endLine: subChunk.endLine,
          hash: '',
          tokenEstimate: 0,
        },
        meta,
      )

      chunks.push({
        docId,
        chunkIndex,
        headingPath: section.heading,
        text: subChunk.text,
        startLine: subChunk.startLine,
        endLine: subChunk.endLine,
        hash: sha256(embeddingInput),
        tokenEstimate: estimateTokens(subChunk.text),
      })

      chunkIndex++
    }
  }

  return chunks
}

interface Section {
  heading: string
  level: number
  content: string
  startLine: number
}

export function parseMarkdownSections(body: string): Section[] {
  const sections: Section[] = []
  const lines = body.split('\n')
  // Seed a preamble section so content before the first heading (or files with
  // no headings at all — common in release notes and READMEs) is still chunked
  // and embedded. packIntoChunks drops it if empty, so no phantom chunk. (F1)
  let current: Section | null = { heading: 'Overview', level: 0, content: '', startLine: 1 }
  let lineNum = 1

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      if (current) sections.push(current)
      current = {
        heading: headingMatch[2],
        level: headingMatch[1].length,
        content: '',
        startLine: lineNum,
      }
    } else if (current) {
      current.content += line + '\n'
    }
    lineNum++
  }

  if (current) sections.push(current)
  return sections
}

function packIntoChunks(section: Section): { text: string; startLine: number; endLine: number }[] {
  const paragraphs = section.content.split(/\n\n+/).filter((p) => p.trim())
  const chunks: { text: string; startLine: number; endLine: number }[] = []
  let current = ''
  let startLine = section.startLine

  for (const para of paragraphs) {
    if (estimateTokens(current) + estimateTokens(para) <= 500 || !current) {
      current += (current ? '\n\n' : '') + para
    } else {
      if (current.trim()) {
        const lines = current.split('\n').length
        chunks.push({
          text: current.trim(),
          startLine,
          endLine: startLine + lines - 1,
        })
        startLine += lines + 2
      }
      current = para
    }
  }

  if (current.trim()) {
    const lines = current.split('\n').length
    chunks.push({
      text: current.trim(),
      startLine,
      endLine: startLine + lines - 1,
    })
  }

  return chunks
}

function formatEmbeddingInput(chunk: Chunk, meta: FrontmatterMeta): string {
  const parts: string[] = []
  parts.push(`[type=${meta.type} | domain=${meta.domain}]`)
  if (meta.tags.length) parts.push(`[tags: ${meta.tags.join(', ')}]`)
  const title = meta.title || 'Untitled'
  parts.push(`# ${title} › ${chunk.headingPath}`)
  parts.push(chunk.text)
  return parts.join('\n')
}

async function embedViaAPI(text: string): Promise<number[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-m3`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    throw new Error(
      `Embedding failed: ${response.status} ${await response.text()}`,
    )
  }

  // Validate the embedding response at the boundary (HLT-031, #686).
  const parsed = z
    .object({ result: z.object({ data: z.array(z.array(z.number())).optional() }).optional() })
    .safeParse(await response.json())
  const vector = parsed.success ? parsed.data.result?.data?.[0] : undefined
  if (!vector || vector.length !== 1024) {
    throw new Error('Invalid embedding response')
  }

  return vector
}

function walkKbFiles(): string[] {
  const files: string[] = []

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Skip archive/ (superseded docs) and migration/ (DB migration scripts,
        // not knowledge). Everything else is embedded. Keep this exclusion list
        // in sync with EMBED_EXCLUDE_DIRS in scripts/kb-health.ts.
        if (['archive', 'migration'].includes(entry.name)) continue
        walk(path.join(dir, entry.name))
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(path.join(dir, entry.name))
      }
    }
  }

  walk(kbRoot)
  return files
}

/**
 * Runs `worker` over `items` with at most `concurrency` in flight at once,
 * preserving per-item settlement (success/failure) without one slow/failed
 * item blocking the rest. Used to bound the ~480-file corpus's embedding
 * calls to a CI-timeout-safe wall-clock time instead of running sequentially.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0
  async function runOne() {
    while (next < items.length) {
      const index = next++
      try {
        const value = await worker(items[index], index)
        results[index] = { status: 'fulfilled', value }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }
  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: workerCount }, runOne))
  return results
}

async function main() {
  if (!isDryRun && (!apiKey || !accountId || !dbId)) {
    console.error(
      'Error: Missing env vars. Set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID',
    )
    process.exit(1)
  }

  console.log(`Knowledge-Base Vectorization (ADR-040 Phase 1)`)
  console.log(`KB Root: ${kbRoot}`)
  console.log(`Dry Run: ${isDryRun}`)
  if (limitFiles) console.log(`Limit: ${limitFiles} files`)
  console.log()

  let files = walkKbFiles()
  const totalFileCount = files.length

  // Incremental sync: kb-sync-cli.ts writes the changed-file subset to a JSON
  // file and points KB_EMBED_FILES at it. Restrict the walk to that subset so
  // routine merges (a handful of changed docs) don't re-embed the whole
  // ~480-file corpus. Absent/missing means "embed everything" (first run,
  // manual `npm run kb:embed`, etc).
  if (embedFilesListPath && fs.existsSync(embedFilesListPath)) {
    const raw: unknown = JSON.parse(fs.readFileSync(embedFilesListPath, 'utf8'))
    const requested = Array.isArray(raw) ? raw.filter((f): f is string => typeof f === 'string') : []
    const requestedAbs = new Set(requested.map((f) => path.resolve(f)))
    files = files.filter((f) => requestedAbs.has(path.resolve(f)))
    console.log(`KB_EMBED_FILES: restricting to ${files.length} of ${totalFileCount} file(s)`)
  }

  console.log(`Found ${files.length} markdown files`)

  let processedCount = 0
  let fileErrorCount = 0

  interface PendingChunk {
    meta: FrontmatterMeta
    docFields: KbSyncDocumentFields
    chunk: Chunk
  }
  const pending: PendingChunk[] = []
  const startTime = Date.now()

  // Phase 1: walk, parse frontmatter, and chunk every file. Cheap/synchronous
  // aside from disk reads, so this stays a plain sequential loop — the cost
  // that needs bounding is the embedding HTTP call in phase 2 below.
  for (const file of files) {
    if (limitFiles && processedCount >= limitFiles) break

    try {
      const content = fs.readFileSync(file, 'utf8')
      const { meta, body } = parseFrontmatter(content, file)
      const chunks = chunkMarkdown(meta.id, body, meta)

      if (isDryRun) {
        console.log(`✓ ${file}`)
        console.log(`  Chunks: ${chunks.length}`)
        if (chunks.length > 0) {
          console.log(`  Sample: "${chunks[0].headingPath}" (${chunks[0].tokenEstimate} tokens)`)
        }
      } else {
        // Document-level fields are constant across a doc's chunks. The sync
        // endpoint dedupes by doc_id, so it's safe to attach them to each
        // record. `chunk_count` is authoritative and prunes stale chunks.
        const now = Date.now()
        const filePath = path.relative(process.cwd(), file)
        const docFields = {
          file_path: filePath,
          type: meta.type,
          domain: meta.domain,
          category: meta.category ?? null,
          status: meta.status,
          version: meta.version ?? null,
          owner: meta.owner ?? null,
          title: meta.title || meta.id,
          tags: meta.tags,
          relates_to: meta.relates_to,
          size_bytes: Buffer.byteLength(content, 'utf8'),
          doc_hash: sha256(content),
          chunk_count: chunks.length,
          created_at: now,
          updated_at: now,
        }

        for (const chunk of chunks) {
          pending.push({ meta, docFields, chunk })
        }
      }

      processedCount++
    } catch (e) {
      console.error(`✗ ${file}: ${(e as Error).message}`)
      fileErrorCount++
    }
  }

  const chunkCount = pending.length
  let embeddingCount = 0
  let errorCount = 0
  const vectorUpserts: KbSyncRecord[] = []

  // Phase 2: embed every chunk with bounded concurrency. The corpus is large
  // enough (~480 files, thousands of chunks) that one HTTP round-trip per
  // chunk run sequentially blows past CI's job timeout; EMBED_CONCURRENCY
  // in-flight requests cuts wall-clock roughly proportional to its value.
  if (!isDryRun && pending.length > 0) {
    console.log(`\n📝 Embedding ${pending.length} chunk(s) (concurrency=${EMBED_CONCURRENCY})...`)
    let completed = 0
    const results = await mapWithConcurrency(pending, EMBED_CONCURRENCY, async ({ meta, docFields, chunk }) => {
      const vector = await embedViaAPI(formatEmbeddingInput(chunk, meta))
      const chunkId = `${meta.id}#${chunk.chunkIndex}`
      completed++
      if (completed % 50 === 0 || completed === pending.length) {
        console.log(`  Embedded ${completed}/${pending.length}...`)
      }
      return {
        id: chunkId,
        values: vector,
        metadata: {
          doc_id: meta.id,
          chunk_id: chunkId,
          type: meta.type as KbSyncRecord['metadata']['type'],
          domain: meta.domain,
          status: meta.status as KbSyncRecord['metadata']['status'],
          tags: meta.tags,
          heading_path: chunk.headingPath.slice(0, 120),
        },
        document: docFields,
        chunk: {
          chunk_index: chunk.chunkIndex,
          heading_path: chunk.headingPath.slice(0, 120),
          start_line: chunk.startLine,
          end_line: chunk.endLine,
          text: chunk.text,
          token_estimate: chunk.tokenEstimate,
          chunk_hash: chunk.hash,
          embedded_at: docFields.updated_at,
        },
      } satisfies KbSyncRecord
    })

    for (const result of results) {
      if (result.status === 'fulfilled') {
        vectorUpserts.push(result.value)
        embeddingCount++
      } else {
        const reason = result.reason
        console.error(`    Error embedding chunk: ${reason instanceof Error ? reason.message : String(reason)}`)
        errorCount++
      }
    }
  }

  const elapsed = Date.now() - startTime

  console.log()
  console.log(`Summary:`)
  console.log(`  Files processed: ${processedCount}`)
  console.log(`  Total chunks: ${chunkCount}`)
  console.log(`  Embeddings created: ${embeddingCount}`)
  console.log(`  Chunk errors: ${errorCount}`)
  console.log(`  File errors: ${fileErrorCount}`)
  console.log(`  Time: ${(elapsed / 1000).toFixed(1)}s`)

  // A file that fails to process is a doc missing from the index — surface it
  // as a non-zero exit so `npm run kb:embed` fails loudly instead of exiting 0
  // with docs silently dropped. Transient per-chunk embed errors stay advisory
  // (the corpus-completeness health gate catches systematic under-embedding).
  if (!isDryRun && fileErrorCount > 0) {
    console.error(`\n✗ ${fileErrorCount} file(s) failed to process — failing run.`)
    process.exitCode = 1
  }

  if (!isDryRun && vectorUpserts.length > 0) {
    console.log()
    console.log(`Saving ${vectorUpserts.length} vectors to disk...`)

    const vectorsPath = path.join(process.cwd(), '.kb-vectors-pending.json')
    fs.writeFileSync(vectorsPath, JSON.stringify(vectorUpserts, null, 2))
    console.log(`✓ Records saved to ${vectorsPath} (vectors + kb_documents/kb_chunks rows)`)
    console.log()
    console.log(`Next: run \`npm run kb:sync\` to upsert these records to Vectorize + D1`)
    console.log(`(posts batches to /api/admin/kb-sync with the x-admin-key header).`)
  }

  console.log()
  console.log(`Phase 1 complete!`)
}

// Only run when invoked as a script (`npx tsx scripts/embed-kb.ts`), not when a
// test imports the exported pure helpers from this module.
if (process.argv[1]?.endsWith('embed-kb.ts')) {
  main().catch((e) => {
    console.error(`Fatal: ${(e as Error).message}`)
    process.exit(1)
  })
}
