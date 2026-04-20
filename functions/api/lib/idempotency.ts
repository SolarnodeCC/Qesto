// Idempotency-Key support for POST routes. Wraps the request handler so that
// repeated calls with the same key + same user return the original response.
//
// Storage: ACTIONS_KV, 24h TTL. If ACTIONS_KV isn't bound (pre-bootstrap), the
// wrapper silently degrades to no-op — duplicate requests will execute
// normally. See docs/DEPLOY_BOOTSTRAP.md.

export type CachedResponse = {
  status: number
  body: unknown
}

const TTL_SECONDS = 24 * 60 * 60

function kvKey(userId: string, key: string): string {
  return `idem:${userId}:${key}`
}

export async function withIdempotency<T>(
  kv: KVNamespace | undefined,
  userId: string,
  key: string | undefined,
  exec: () => Promise<{ status: number; body: T }>,
): Promise<{ status: number; body: T; replayed: boolean }> {
  if (!key || !kv) {
    const res = await exec()
    return { ...res, replayed: false }
  }

  const existing = await kv.get(kvKey(userId, key), 'json')
  if (existing) {
    const cached = existing as CachedResponse
    return { status: cached.status, body: cached.body as T, replayed: true }
  }

  const res = await exec()
  const payload: CachedResponse = { status: res.status, body: res.body }
  await kv.put(kvKey(userId, key), JSON.stringify(payload), { expirationTtl: TTL_SECONDS })
  return { ...res, replayed: false }
}
