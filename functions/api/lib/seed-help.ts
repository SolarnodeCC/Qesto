import type { D1Database, VectorizeIndex, Ai } from '@cloudflare/workers-types'
import { safeLogContext } from './log'

// Simple ULID-like ID generator (128-bit timestamp + random)
function generateId(): string {
  const now = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `${now.toString(36)}-${random}`
}

export interface HelpDocumentSeed {
  id: string
  title: string
  topic: string
  scope: 'free' | 'starter' | 'team'
  excerpt: string
  content: string
}

export interface HelpDocument extends HelpDocumentSeed {
  embedding_id: string | null
  created_at: number
  updated_at: number
  published_at: number | null
}

const EMBEDDING_MODEL = '@cf/baai/bge-m3'
const EMBEDDING_TIMEOUT_MS = 10_000

/**
 * Embed text using bge-m3 model via Workers AI.
 * Returns vector (array of numbers) or null on timeout/error.
 */
async function embedText(ai: Ai, text: string): Promise<number[] | null> {
  try {
    const start = Date.now()
    const result = (await Promise.race([
      ai.run(EMBEDDING_MODEL, { text }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Embedding timeout')), EMBEDDING_TIMEOUT_MS)
      ),
    ])) as any

    const elapsed = Date.now() - start
    console.log(`[seed] embedded "${text.substring(0, 50)}..." in ${elapsed}ms`)

    // Extract vector from result
    if (Array.isArray(result?.data?.[0]?.embedding)) {
      return result.data[0].embedding
    }
    return null
  } catch (err) {
    safeLogContext(err, { traceId: 'system', route: 'seed/embed-text', errorClass: err instanceof Error ? err.name : 'UnknownError' })
    return null
  }
}

/**
 * Seed help documents into D1 and Vectorize.
 */
export async function seedHelpDocuments(
  documents: HelpDocumentSeed[],
  db: D1Database,
  vectorize: VectorizeIndex,
  ai: Ai,
): Promise<void> {
  console.log(`[seed] Starting to seed ${documents.length} help documents...`)

  const now = Date.now()
  const published_at = Math.floor(now / 1000) // Unix timestamp

  let embeddings_created = 0
  let docs_inserted = 0

  for (const doc of documents) {
    let embedding_id = generateId()
    let vector: number[] | null = null

    // Embed the document (title + excerpt for RAG retrieval)
    const text_to_embed = `${doc.title} ${doc.excerpt}`
    vector = await embedText(ai as any, text_to_embed)

    // Insert into D1
    try {
      await db
        .prepare(
          `INSERT INTO help_documents (id, title, content, topic, scope, excerpt, embedding_id, created_at, updated_at, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          doc.id,
          doc.title,
          doc.content,
          doc.topic,
          doc.scope,
          doc.excerpt,
          vector ? embedding_id : null,
          Math.floor(now / 1000),
          Math.floor(now / 1000),
          published_at,
        )
        .run()

      docs_inserted++
      console.log(`[seed] inserted document: ${doc.id}`)
    } catch (err) {
      safeLogContext(err, { traceId: 'system', route: 'seed/insert-document', errorClass: err instanceof Error ? err.name : 'UnknownError' })
      continue
    }

    // Upsert into Vectorize (only if we have a vector)
    if (vector && vector.length > 0) {
      try {
        await vectorize.upsert([
          {
            id: embedding_id,
            values: vector,
            metadata: {
              document_id: doc.id,
              title: doc.title,
              topic: doc.topic,
              scope: doc.scope,
            },
          },
        ])

        embeddings_created++
        console.log(`[seed] upserted embedding: ${embedding_id} for ${doc.id}`)
      } catch (err) {
        safeLogContext(err, { traceId: 'system', route: 'seed/upsert-embedding', errorClass: err instanceof Error ? err.name : 'UnknownError' })
      }
    }
  }

  console.log(
    `[seed] completed: ${docs_inserted}/${documents.length} documents inserted, ${embeddings_created} embeddings created`,
  )
}
