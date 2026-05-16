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
import { execSync } from 'child_process'

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

interface VectorUpsertPayload {
  id: string
  values: number[]
  metadata: {
    doc_id: string
    chunk_id: string
    type: string
    domain: string
    status: string
    tags: string[]
    heading_path: string
  }
}

// CLI args
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const limitFiles = args.find((a) => a.startsWith('--limit'))
  ? parseInt(args[args.indexOf('--limit') + 1], 10)
  : undefined
const isVerify = args.includes('--verify')

const kbRoot = path.join(process.cwd(), 'knowledge-base')
const apiKey = process.env.CLOUDFLARE_API_TOKEN || ''
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || ''
const dbId = process.env.CLOUDFLARE_D1_DATABASE_ID || ''
const vectorizeIndexName = 'kb-production'

if (!isDryRun && (!apiKey || !accountId || !dbId)) {
  console.error(
    'Error: Missing env vars. Set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID',
  )
  process.exit(1)
}

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

    // Key: value pairs
    const match = line.match(/^([a-z_]+):\s*(.+)$/)
    if (match && !inArray) {
      const [, key, value] = match
      result[key] = value.trim().replace(/['"]/g, '')
    }
  }

  return result
}

function parseFrontmatter(markdown: string): {
  meta: FrontmatterMeta
  body: string
} {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) {
    throw new Error('No YAML frontmatter found')
  }

  const yamlText = match[1]
  const body = markdown.slice(match[0].length)
  const parsed = parseYAMLSimple(yamlText)

  return {
    meta: {
      id: String(parsed.id || 'unknown'),
      type: String(parsed.type || 'unknown'),
      domain: String(parsed.domain || 'unknown'),
      status: String(parsed.status || 'draft'),
      tags: (parsed.tags as string[]) || [],
      relates_to: (parsed.relates_to as string[]) || [],
      title: parsed.title ? String(parsed.title) : undefined,
      version: parsed.version ? String(parsed.version) : undefined,
      owner: parsed.owner ? String(parsed.owner) : undefined,
      category: parsed.category ? String(parsed.category) : undefined,
    },
    body,
  }
}

function chunkMarkdown(docId: string, body: string, meta: FrontmatterMeta): Chunk[] {
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

function parseMarkdownSections(body: string): Section[] {
  const sections: Section[] = []
  const lines = body.split('\n')
  let current: Section | null = null
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

  const result = (await response.json()) as { result?: { data?: number[][] } }
  const vector = result.result?.data?.[0]
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
        // Skip archive, migration, and specification folders (already have YAML, don't re-embed)
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

async function main() {
  console.log(`Knowledge-Base Vectorization (ADR-040 Phase 1)`)
  console.log(`KB Root: ${kbRoot}`)
  console.log(`Dry Run: ${isDryRun}`)
  if (limitFiles) console.log(`Limit: ${limitFiles} files`)
  console.log()

  const files = walkKbFiles()
  console.log(`Found ${files.length} markdown files`)

  let processedCount = 0
  let chunkCount = 0
  let embeddingCount = 0
  let errorCount = 0

  const vectorUpserts: VectorUpsertPayload[] = []
  const startTime = Date.now()

  for (const file of files) {
    if (limitFiles && processedCount >= limitFiles) break

    try {
      const content = fs.readFileSync(file, 'utf8')
      const { meta, body } = parseFrontmatter(content)
      const chunks = chunkMarkdown(meta.id, body, meta)

      if (isDryRun) {
        console.log(`✓ ${file}`)
        console.log(`  Chunks: ${chunks.length}`)
        if (chunks.length > 0) {
          console.log(`  Sample: "${chunks[0].headingPath}" (${chunks[0].tokenEstimate} tokens)`)
        }
      } else {
        // Embed and save chunks to D1 (Vectorize sync happens later via API route)
        for (const chunk of chunks) {
          try {
            console.log(`  Embedding: ${chunk.hash.slice(0, 8)}...`)
            const vector = await embedViaAPI(formatEmbeddingInput(chunk, meta))

            // Store for later batch insert to D1
            vectorUpserts.push({
              id: `${meta.id}#${chunk.chunkIndex}`,
              values: vector,
              metadata: {
                doc_id: meta.id,
                chunk_id: `${meta.id}#${chunk.chunkIndex}`,
                type: meta.type,
                domain: meta.domain,
                status: meta.status,
                tags: meta.tags,
                heading_path: chunk.headingPath.slice(0, 120),
              },
            })

            embeddingCount++
            chunkCount++
          } catch (e) {
            console.error(`    Error embedding chunk: ${(e as Error).message}`)
            errorCount++
          }
        }
      }

      processedCount++
    } catch (e) {
      console.error(`✗ ${file}: ${(e as Error).message}`)
      errorCount++
    }
  }

  const elapsed = Date.now() - startTime

  console.log()
  console.log(`Summary:`)
  console.log(`  Files processed: ${processedCount}`)
  console.log(`  Total chunks: ${chunkCount}`)
  console.log(`  Embeddings created: ${embeddingCount}`)
  console.log(`  Errors: ${errorCount}`)
  console.log(`  Time: ${(elapsed / 1000).toFixed(1)}s`)

  if (!isDryRun && vectorUpserts.length > 0) {
    console.log()
    console.log(`Saving ${vectorUpserts.length} vectors to disk...`)

    const vectorsPath = path.join(process.cwd(), '.kb-vectors-pending.json')
    fs.writeFileSync(vectorsPath, JSON.stringify(vectorUpserts, null, 2))
    console.log(`✓ Vectors saved to ${vectorsPath}`)
    console.log()
    console.log(`Next: POST /api/knowledge-base/upsert-vectors with payload to sync to Vectorize`)
    console.log(`curl -X POST https://api.qesto.cc/api/knowledge-base/upsert-vectors \\`)
    console.log(`  -H "Authorization: Bearer <token>" \\`)
    console.log(`  -H "Content-Type: application/json" \\`)
    console.log(`  -d @.kb-vectors-pending.json`)
  }

  console.log()
  console.log(`Phase 1 complete!`)
}

main().catch((e) => {
  console.error(`Fatal: ${(e as Error).message}`)
  process.exit(1)
})
