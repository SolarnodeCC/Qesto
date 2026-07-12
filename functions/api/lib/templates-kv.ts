// Marketing template storage (Growth Engine).
//
// Split-store design (pipeline audit MKTP-005/009/010/012):
//   - D1 `marketing_templates` is the registry: listing/filter queries, publish
//     and discard state, atomic usage counting, and content-hash dedup.
//   - MARKETING_KV holds the full multilingual TemplateRecord blob under
//     `template:{id}` — never queried, only fetched by id.
//
// The old KV read-modify-write index lists (`templates:index`,
// `templates:by-industry:*`, `templates:by-theme:*`, `templates:by-lang:*`)
// are gone: KV has no compare-and-swap, so concurrent writers silently lost
// entries and counts. Templates without a registry row (pre-registry records,
// which contained placeholder AI content — see MKTP-001) are intentionally
// invisible.

import { TemplateRecord } from './template-schemas'
import type { Industry, Theme, Lang } from './template-schemas'
import { nanoid } from 'nanoid'

// Re-export types for convenience
export type { Industry, Theme, Lang } from './template-schemas'

export function templateKey(templateId: string): string {
  return `template:${templateId}`
}

export const TEMPLATE_LANGS = ['en', 'nl', 'de', 'fr'] as const

interface RegistryRow {
  id: string
  is_public: number
  is_discarded: number
  usage_count: number
}

async function readRecord(kv: KVNamespace, templateId: string): Promise<TemplateRecord | null> {
  const raw = await kv.get(templateKey(templateId), 'json')
  if (!raw) return null
  const parsed = TemplateRecord.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** Merge the registry row's authoritative state into the KV record. */
function applyRegistryRow(record: TemplateRecord, row: RegistryRow): TemplateRecord {
  record.isPublic = row.is_public === 1
  record.isDiscarded = row.is_discarded === 1
  record.usageCount = row.usage_count
  return record
}

export async function getTemplate(
  db: D1Database,
  kv: KVNamespace,
  templateId: string,
): Promise<TemplateRecord | null> {
  const [row, record] = await Promise.all([
    db
      .prepare(
        `SELECT id, is_public, is_discarded, usage_count FROM marketing_templates WHERE id = ?1`,
      )
      .bind(templateId)
      .first<RegistryRow>(),
    readRecord(kv, templateId),
  ])
  if (!row || !record) return null
  return applyRegistryRow(record, row)
}

export interface TemplateListFilters {
  industry?: Industry
  theme?: Theme
  lang?: Lang
  /** Include drafts (admin/review surfaces only). Public listing omits this. */
  includeUnpublished?: boolean
  limit?: number
  offset?: number
}

export interface TemplateListResult {
  templates: TemplateRecord[]
  total: number
}

export async function listTemplates(
  db: D1Database,
  kv: KVNamespace,
  filters: TemplateListFilters = {},
): Promise<TemplateListResult> {
  const where: string[] = ['is_discarded = 0']
  const args: unknown[] = []
  if (!filters.includeUnpublished) where.push('is_public = 1')
  if (filters.industry) {
    args.push(filters.industry)
    where.push(`industry = ?${args.length}`)
  }
  if (filters.theme) {
    args.push(filters.theme)
    where.push(`theme = ?${args.length}`)
  }
  if (filters.lang) {
    args.push(filters.lang)
    where.push(`instr(langs, ?${args.length}) > 0`)
  }
  const whereSql = where.join(' AND ')
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100)
  const offset = Math.max(filters.offset ?? 0, 0)

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM marketing_templates WHERE ${whereSql}`)
    .bind(...args)
    .first<{ n: number }>()
  const { results } = await db
    .prepare(
      `SELECT id, is_public, is_discarded, usage_count FROM marketing_templates
        WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT ?${args.length + 1} OFFSET ?${args.length + 2}`,
    )
    .bind(...args, limit, offset)
    .all<RegistryRow>()

  const rows = (results ?? []) as RegistryRow[]
  const records = await Promise.all(rows.map((row) => readRecord(kv, row.id)))
  const templates: TemplateRecord[] = []
  rows.forEach((row, i) => {
    const record = records[i]
    if (record) templates.push(applyRegistryRow(record, row))
  })
  return { templates, total: countRow?.n ?? templates.length }
}

/**
 * Deterministic hash of the question set, used for duplicate detection: the
 * pipeline mints a template per closed public session, so near-identical
 * sessions must collapse to one gallery entry (MKTP-009).
 */
export async function computeTemplateContentHash(
  record: Pick<TemplateRecord, 'questions'>,
): Promise<string> {
  const normalized = record.questions
    .map((q) => `${q.type}:${(q.text.en ?? '').trim().toLowerCase()}`)
    .sort()
    .join('\n')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type StoreTemplateResult = { stored: true } | { stored: false; reason: 'duplicate' }

/**
 * Validate and persist a template: registry row first (its UNIQUE content_hash
 * is the atomic dedup gate), KV blob only after the insert wins. A duplicate
 * leaves both stores untouched.
 */
export async function storeTemplate(
  db: D1Database,
  kv: KVNamespace,
  template: TemplateRecord,
): Promise<StoreTemplateResult> {
  const record = TemplateRecord.parse(template)
  const now = Date.now()
  record.createdAt = record.createdAt || new Date(now).toISOString()
  record.updatedAt = new Date(now).toISOString()

  const contentHash = await computeTemplateContentHash(record)
  const langs = TEMPLATE_LANGS.filter((lang) => record.title[lang]).join(',')

  const insert = await db
    .prepare(
      `INSERT INTO marketing_templates
         (id, source_session_id, content_hash, industry, theme, topic, title_en,
          question_count, estimated_minutes, confidence, langs,
          is_public, is_discarded, usage_count, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
       ON CONFLICT(content_hash) DO NOTHING`,
    )
    .bind(
      record.id,
      record.sourceSessionId,
      contentHash,
      record.industry,
      record.theme,
      record.topic,
      record.title.en ?? record.topic,
      record.questions.length,
      Math.round(record.estimatedMinutes),
      Math.round(record.confidence),
      langs,
      record.isPublic ? 1 : 0,
      record.isDiscarded ? 1 : 0,
      record.usageCount,
      now,
      now,
    )
    .run()

  if ((insert.meta?.changes ?? 0) === 0) {
    return { stored: false, reason: 'duplicate' }
  }
  await kv.put(templateKey(record.id), JSON.stringify(record))
  return { stored: true }
}

/**
 * Flip publish state (draft ⇄ public). Returns the updated record, or null if
 * the template is unknown or discarded.
 */
export async function setTemplatePublished(
  db: D1Database,
  kv: KVNamespace,
  templateId: string,
  isPublic: boolean,
): Promise<TemplateRecord | null> {
  const now = Date.now()
  const res = await db
    .prepare(
      `UPDATE marketing_templates SET is_public = ?1, updated_at = ?2
        WHERE id = ?3 AND is_discarded = 0`,
    )
    .bind(isPublic ? 1 : 0, now, templateId)
    .run()
  if ((res.meta?.changes ?? 0) === 0) return null

  const record = await readRecord(kv, templateId)
  if (!record) return null
  record.isPublic = isPublic
  record.updatedAt = new Date(now).toISOString()
  await kv.put(templateKey(templateId), JSON.stringify(record))
  return record
}

/** Soft-discard: template drops out of every public surface but is preserved. */
export async function discardTemplate(
  db: D1Database,
  kv: KVNamespace,
  templateId: string,
  reason: string,
): Promise<boolean> {
  const now = Date.now()
  const res = await db
    .prepare(
      `UPDATE marketing_templates SET is_discarded = 1, is_public = 0, updated_at = ?1
        WHERE id = ?2`,
    )
    .bind(now, templateId)
    .run()
  if ((res.meta?.changes ?? 0) === 0) return false

  const record = await readRecord(kv, templateId)
  if (record) {
    record.isDiscarded = true
    record.isPublic = false
    record.discardReason = reason
    record.updatedAt = new Date(now).toISOString()
    await kv.put(templateKey(templateId), JSON.stringify(record))
  }
  return true
}

/**
 * Atomic usage counter (MKTP-010). Deliberately does NOT touch updated_at:
 * usage is not a content modification, and bumping it churned sitemap
 * <lastmod> / JSON-LD dateModified on every click (MKTP-016).
 */
export async function incrementUsageCount(db: D1Database, templateId: string): Promise<void> {
  await db
    .prepare(`UPDATE marketing_templates SET usage_count = usage_count + 1 WHERE id = ?1`)
    .bind(templateId)
    .run()
}

export function createTemplateId(): string {
  return `tmpl_${nanoid()}`
}
