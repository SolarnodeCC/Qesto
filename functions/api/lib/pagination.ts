/**
 * Keyset pagination (DD-14, issue #887).
 *
 * Offset paging is deliberately not offered: SQLite/D1 still scans every
 * skipped row, so OFFSET cost grows with the page number. Lists order by
 * `(created_at DESC, id DESC)` and page with an opaque cursor that encodes the
 * last row's sort key; the next page is `(created_at, id) < cursor`.
 */
import { z } from 'zod'

export const MAX_PAGE_SIZE = 100

export function pageQuerySchema(defaultLimit = 25) {
  return z.object({
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(defaultLimit),
    cursor: z.string().max(200).optional(),
  })
}

export type Cursor = { createdAt: number; id: string }

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
}

export function encodeCursor(c: Cursor): string {
  return b64urlEncode(`${c.createdAt}:${c.id}`)
}

/** Returns null for anything malformed — callers answer 400, never 500. */
export function decodeCursor(raw: string): Cursor | null {
  try {
    const decoded = b64urlDecode(raw)
    const sep = decoded.indexOf(':')
    if (sep <= 0) return null
    const createdAt = Number(decoded.slice(0, sep))
    const id = decoded.slice(sep + 1)
    if (!Number.isSafeInteger(createdAt) || !id || id.length > 64) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

/** Parse `?limit=&cursor=` from a query map; `error` is safe to return as a 400. */
export function parsePageQuery(
  query: Record<string, string | undefined>,
  defaultLimit = 25,
): { ok: true; page: { limit: number; cursor: Cursor | null } } | { ok: false; error: string } {
  const parsed = pageQuerySchema(defaultLimit).safeParse(query)
  if (!parsed.success) return { ok: false, error: `limit must be an integer between 1 and ${MAX_PAGE_SIZE}` }
  if (parsed.data.cursor === undefined) return { ok: true, page: { limit: parsed.data.limit, cursor: null } }
  const cursor = decodeCursor(parsed.data.cursor)
  if (!cursor) return { ok: false, error: 'Invalid cursor' }
  return { ok: true, page: { limit: parsed.data.limit, cursor } }
}

/**
 * Trim a `LIMIT limit + 1` result to `limit` rows and derive the next cursor
 * from the last kept row (null when this is the final page).
 */
export function toPage<T extends { created_at: number; id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null,
  }
}
