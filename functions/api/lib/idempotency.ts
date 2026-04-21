// Idempotency-Key support for POST routes. Wraps the request handler so that
// repeated calls with the same key + same user return the original response.
//
// Storage: ACTIONS_KV, 24h TTL. If ACTIONS_KV isn't bound (pre-bootstrap), the
// wrapper silently degrades to no-op — duplicate requests will execute
// normally. See docs/DEPLOY_BOOTSTRAP.md.
//
// Concurrency protection (S6): the flow is get → execute → put, which is
// vulnerable to a race where two requests arriving within the same millisecond
// both see an empty slot and both execute. We close the window by writing a
// short-lived PENDING sentinel before the handler runs. A second request that
// sees PENDING short-circuits with 409 "idem_in_flight" so the client can
// retry once the real response has been cached. The PENDING TTL is small
// (30s) so a crashed / timed-out handler can't wedge the key forever.

export type CachedResponse = {
  status: number
  body: unknown
}

const TTL_SECONDS = 24 * 60 * 60
// PENDING sentinels are short-lived so a crashed handler releases the lock.
// Must comfortably exceed the worst-case handler latency — 30s covers D1 +
// DO init on a cold edge.
const PENDING_TTL_SECONDS = 30
const PENDING_MARKER = '__qesto_pending__' as const

type StoredValue =
  | { kind: 'done'; response: CachedResponse }
  | { kind: 'pending'; marker: typeof PENDING_MARKER; startedAt: number }

function kvKey(userId: string, key: string): string {
  return `idem:${userId}:${key}`
}

export class IdempotencyInFlightError extends Error {
  constructor() {
    super('idempotent_in_flight')
    this.name = 'IdempotencyInFlightError'
  }
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

  const k = kvKey(userId, key)
  const existing = (await kv.get(k, 'json')) as StoredValue | null
  if (existing) {
    if (existing.kind === 'done') {
      return { status: existing.response.status, body: existing.response.body as T, replayed: true }
    }
    if (existing.kind === 'pending') {
      // Another request is already executing this idempotent action. Tell the
      // client to retry — the final result will be cached by then.
      throw new IdempotencyInFlightError()
    }
  }

  // Claim the key with a PENDING sentinel before executing. Two concurrent
  // requests that both see an empty slot will both write PENDING — KV is
  // eventually consistent so perfect mutual exclusion isn't guaranteed, but
  // the window shrinks from "handler duration" to "single KV round-trip",
  // which is good enough for the abuse model (Stripe webhook style retries,
  // not adversarial concurrency).
  const pending: StoredValue = { kind: 'pending', marker: PENDING_MARKER, startedAt: Date.now() }
  await kv.put(k, JSON.stringify(pending), { expirationTtl: PENDING_TTL_SECONDS })

  let res: { status: number; body: T }
  try {
    res = await exec()
  } catch (err) {
    // On handler failure, release the PENDING lock so retries aren't blocked
    // for the full 30s sentinel TTL. Best-effort — swallow KV errors.
    try {
      await kv.delete(k)
    } catch {
      /* noop */
    }
    throw err
  }

  const stored: StoredValue = { kind: 'done', response: { status: res.status, body: res.body } }
  await kv.put(k, JSON.stringify(stored), { expirationTtl: TTL_SECONDS })
  return { ...res, replayed: false }
}
