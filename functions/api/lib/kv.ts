import type { ZodSchema } from 'zod'
import { validateKvJson } from './protocol-schemas'

export async function readKvJson<T>(kv: KVNamespace, key: string, schema?: ZodSchema<T>): Promise<T | null> {
  try {
    const raw = await kv.get(key)
    return validateKvJson(raw, schema)
  } catch {
    return null
  }
}

export async function writeKvJson<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  options?: KVNamespacePutOptions,
): Promise<void> {
  await kv.put(key, JSON.stringify(value), options)
}
