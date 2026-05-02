export async function readKvJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  try {
    const raw = await kv.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
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
