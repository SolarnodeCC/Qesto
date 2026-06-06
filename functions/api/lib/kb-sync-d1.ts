import type { KbSyncChunkFields, KbSyncDocumentFields } from '../types/knowledge-base'

/** A validated sync record (vector fields always present; D1 fields optional). */
export type KbSyncValidRecord = {
  id: string
  values: number[]
  metadata: Record<string, unknown>
  document?: KbSyncDocumentFields
  chunk?: KbSyncChunkFields
}

export function isKbSyncValidRecord(v: unknown): v is KbSyncValidRecord {
  return (
    !!v &&
    typeof (v as KbSyncValidRecord).id === 'string' &&
    Array.isArray((v as KbSyncValidRecord).values) &&
    typeof (v as KbSyncValidRecord).metadata === 'object' &&
    (v as KbSyncValidRecord).metadata !== null
  )
}

const DOC_SQL = `INSERT INTO kb_documents
      (doc_id, file_path, type, domain, category, status, version, owner, title,
       tags_json, relates_to_json, size_bytes, doc_hash, chunk_count, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
    ON CONFLICT(doc_id) DO UPDATE SET
      file_path = excluded.file_path, type = excluded.type, domain = excluded.domain,
      category = excluded.category, status = excluded.status, version = excluded.version,
      owner = excluded.owner, title = excluded.title, tags_json = excluded.tags_json,
      relates_to_json = excluded.relates_to_json, size_bytes = excluded.size_bytes,
      doc_hash = excluded.doc_hash, chunk_count = excluded.chunk_count,
      updated_at = excluded.updated_at`

const CHUNK_SQL = `INSERT INTO kb_chunks
      (chunk_id, doc_id, chunk_index, heading_path, start_line, end_line, text,
       token_estimate, chunk_hash, vector_id, embedded_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    ON CONFLICT(chunk_id) DO UPDATE SET
      doc_id = excluded.doc_id, chunk_index = excluded.chunk_index,
      heading_path = excluded.heading_path, start_line = excluded.start_line,
      end_line = excluded.end_line, text = excluded.text,
      token_estimate = excluded.token_estimate, chunk_hash = excluded.chunk_hash,
      vector_id = excluded.vector_id, embedded_at = excluded.embedded_at`

const PRUNE_SQL = `DELETE FROM kb_chunks WHERE doc_id = ?1 AND chunk_index >= ?2`

/** Upsert kb_documents + kb_chunks for records carrying document/chunk fields. */
export async function writeKbSyncD1Rows(
  db: D1Database,
  records: KbSyncValidRecord[],
): Promise<{ documentsUpserted: number; chunksUpserted: number }> {
  const docsById = new Map<string, { docId: string; doc: KbSyncDocumentFields }>()
  const chunkStatements: D1PreparedStatement[] = []

  for (const r of records) {
    const docId = typeof r.metadata.doc_id === 'string' ? r.metadata.doc_id : undefined
    if (!docId || !r.document || !r.chunk) continue

    docsById.set(docId, { docId, doc: r.document })
    const c = r.chunk
    chunkStatements.push(
      db
        .prepare(CHUNK_SQL)
        .bind(
          r.id,
          docId,
          c.chunk_index,
          c.heading_path,
          c.start_line,
          c.end_line,
          c.text,
          c.token_estimate,
          c.chunk_hash,
          r.id,
          c.embedded_at,
        ),
    )
  }

  if (docsById.size === 0) return { documentsUpserted: 0, chunksUpserted: 0 }

  const docStatements: D1PreparedStatement[] = []
  const pruneStatements: D1PreparedStatement[] = []
  for (const { docId, doc } of docsById.values()) {
    docStatements.push(
      db
        .prepare(DOC_SQL)
        .bind(
          docId,
          doc.file_path,
          doc.type,
          doc.domain,
          doc.category ?? null,
          doc.status,
          doc.version ?? null,
          doc.owner ?? null,
          doc.title,
          JSON.stringify(doc.tags ?? []),
          JSON.stringify(doc.relates_to ?? []),
          doc.size_bytes,
          doc.doc_hash,
          doc.chunk_count,
          doc.created_at,
          doc.updated_at,
        ),
    )
    pruneStatements.push(db.prepare(PRUNE_SQL).bind(docId, doc.chunk_count))
  }

  await db.batch(docStatements)
  await db.batch(chunkStatements)
  await db.batch(pruneStatements)

  return { documentsUpserted: docStatements.length, chunksUpserted: chunkStatements.length }
}

const DELETE_CHUNK_SQL = `DELETE FROM kb_chunks WHERE chunk_id = ?1`

const DELETE_ORPHAN_DOC_SQL = `DELETE FROM kb_documents
            WHERE doc_id = ?1
              AND NOT EXISTS (SELECT 1 FROM kb_chunks WHERE kb_chunks.doc_id = ?1)`

/** Delete chunk rows by chunk_id, then drop orphaned parent documents. */
export async function deleteKbSyncD1Rows(db: D1Database, chunkIds: string[]): Promise<number> {
  if (chunkIds.length === 0) return 0

  const docIds = new Set<string>()
  for (const id of chunkIds) {
    const hash = id.lastIndexOf('#')
    if (hash > 0) docIds.add(id.slice(0, hash))
  }

  const deleteStatements: D1PreparedStatement[] = chunkIds.map((id) =>
    db.prepare(DELETE_CHUNK_SQL).bind(id),
  )
  for (let i = 0; i < deleteStatements.length; i += 100) {
    await db.batch(deleteStatements.slice(i, i + 100))
  }

  const orphanCleanup: D1PreparedStatement[] = []
  for (const docId of docIds) {
    orphanCleanup.push(db.prepare(DELETE_ORPHAN_DOC_SQL).bind(docId))
  }
  if (orphanCleanup.length > 0) await db.batch(orphanCleanup)

  return chunkIds.length
}
