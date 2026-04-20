import { describe, expect, it } from 'vitest'
import { IdempotencyInFlightError, withIdempotency } from '../../functions/api/lib/idempotency'

class KVMock {
  private store = new Map<string, { value: string; expiresAt: number }>()

  async get(key: string, _type: 'json'): Promise<unknown> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }
    return JSON.parse(entry.value)
  }

  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    const ttl = opts?.expirationTtl ?? 60
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  raw(key: string): unknown {
    const e = this.store.get(key)
    return e ? JSON.parse(e.value) : null
  }
}

describe('withIdempotency', () => {
  it('runs the handler and caches the result', async () => {
    const kv = new KVMock()
    let count = 0
    const run = () =>
      withIdempotency(kv as unknown as KVNamespace, 'u1', 'key-1', async () => {
        count++
        return { status: 201, body: { ok: true as const, value: count } }
      })

    const first = await run()
    expect(first.status).toBe(201)
    expect(first.replayed).toBe(false)
    expect(first.body.value).toBe(1)

    const second = await run()
    expect(second.replayed).toBe(true)
    expect(second.body.value).toBe(1)
    expect(count).toBe(1)
  })

  it('writes a PENDING sentinel while the handler executes and rejects concurrent callers', async () => {
    const kv = new KVMock()

    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    // First call: slow handler, still running when the second call arrives.
    const firstP = withIdempotency(kv as unknown as KVNamespace, 'u1', 'race', async () => {
      await gate
      return { status: 201, body: { ok: true as const } }
    })

    // Give the first call a tick to write the PENDING sentinel.
    await new Promise((r) => setTimeout(r, 5))

    // Second call sees PENDING and rejects immediately.
    await expect(
      withIdempotency(kv as unknown as KVNamespace, 'u1', 'race', async () => {
        throw new Error('should not execute')
      }),
    ).rejects.toBeInstanceOf(IdempotencyInFlightError)

    // Release the first handler; it should finish and cache the real result.
    release()
    const first = await firstP
    expect(first.status).toBe(201)
    expect(first.replayed).toBe(false)

    // Now a subsequent call returns the cached (done) value.
    const third = await withIdempotency(kv as unknown as KVNamespace, 'u1', 'race', async () => {
      throw new Error('should not execute')
    })
    expect(third.replayed).toBe(true)
  })

  it('releases the PENDING lock when the handler throws so retries can proceed', async () => {
    const kv = new KVMock()
    await expect(
      withIdempotency(kv as unknown as KVNamespace, 'u1', 'boom', async () => {
        throw new Error('handler failed')
      }),
    ).rejects.toThrow('handler failed')

    // After failure the key should be gone — a retry must execute the handler.
    let executed = false
    const res = await withIdempotency(kv as unknown as KVNamespace, 'u1', 'boom', async () => {
      executed = true
      return { status: 201, body: { ok: true as const } }
    })
    expect(executed).toBe(true)
    expect(res.replayed).toBe(false)
  })

  it('is a no-op when KV is undefined', async () => {
    let count = 0
    const res = await withIdempotency(undefined, 'u1', 'k', async () => {
      count++
      return { status: 200, body: { ok: true as const } }
    })
    expect(res.replayed).toBe(false)
    expect(count).toBe(1)
  })

  it('is a no-op when the key is undefined', async () => {
    const kv = new KVMock()
    let count = 0
    const run = () =>
      withIdempotency(kv as unknown as KVNamespace, 'u1', undefined, async () => {
        count++
        return { status: 200, body: { ok: true as const } }
      })
    await run()
    await run()
    expect(count).toBe(2)
  })
})
