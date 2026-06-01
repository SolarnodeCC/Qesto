import type { ZodSchema } from 'zod'
import { validateKvJson } from './protocol-schemas'

/**
 * Read and JSON-parse a KV value. Returns null on miss, parse failure, or any
 * read error (fail-soft). Optionally validates the parsed value with a Zod
 * schema. Use for cache reads where a missing/corrupt value should degrade to
 * "not cached" rather than throw.
 */
export async function readKvJson<T>(kv: KVNamespace, key: string, schema?: ZodSchema<T>): Promise<T | null> {
  try {
    const raw = await kv.get(key)
    return validateKvJson(raw, schema)
  } catch {
    return null
  }
}

/**
 * Read a raw string KV value. Exact passthrough of `kv.get(key)` — preserves
 * the caller's error and null-handling semantics. Use when the caller already
 * parses/validates the value itself, or stores raw strings (counters, flags,
 * ids).
 */
export function readKvText(kv: KVNamespace, key: string): Promise<string | null> {
  return kv.get(key)
}

/**
 * JSON-serialize and write a KV value. Equivalent to
 * `kv.put(key, JSON.stringify(value), options)`.
 */
export async function writeKvJson<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  options?: KVNamespacePutOptions,
): Promise<void> {
  await kv.put(key, JSON.stringify(value), options)
}

/**
 * Write a raw string KV value. Exact passthrough of `kv.put(key, value, options)`.
 * Use for non-JSON values (counters, flags, ids).
 */
export function writeKvText(
  kv: KVNamespace,
  key: string,
  value: string,
  options?: KVNamespacePutOptions,
): Promise<void> {
  return kv.put(key, value, options)
}

/**
 * Delete a KV key. Exact passthrough of `kv.delete(key)`; errors propagate so
 * callers can `.catch()` if a failed delete is non-fatal.
 */
export function deleteKv(kv: KVNamespace, key: string): Promise<void> {
  return kv.delete(key)
}
