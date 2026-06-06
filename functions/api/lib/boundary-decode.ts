/**
 * Boundary decoders — safe wrappers for external data ingress.
 *
 * Every KV read or external JSON parse that previously used `JSON.parse(x) as T`
 * should route through one of these helpers so type safety is validated at runtime,
 * not just asserted at compile time.
 */
import { z } from 'zod'

/**
 * Parse a KV string value with a Zod schema. Returns null on any failure
 * (missing value, malformed JSON, schema mismatch) so callers only need
 * one null-check rather than try/catch + type-guard.
 */
export function decodeKvJson<T>(raw: string | null, schema: z.ZodSchema<T>): T | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const result = schema.safeParse(parsed)
  return result.success ? result.data : null
}

/**
 * Parse a plain JavaScript object (e.g. from `DO.storage.get<unknown>()`)
 * with a Zod schema. Returns null on schema mismatch.
 */
export function decodeObject<T>(raw: unknown, schema: z.ZodSchema<T>): T | null {
  const result = schema.safeParse(raw)
  return result.success ? result.data : null
}

/**
 * Parse the body of an incoming HTTP request with a Zod schema.
 * Returns `{ ok: true, data }` or `{ ok: false, error }` — never throws.
 */
export async function decodeRequestBody<T>(
  req: Request,
  schema: z.ZodSchema<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: z.ZodError }> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = null
  }
  const result = schema.safeParse(body)
  if (result.success) return { ok: true, data: result.data }
  return { ok: false, error: result.error }
}
