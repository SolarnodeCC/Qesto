import { beforeEach, describe, expect, it } from 'vitest'
import { rateLimit } from '../../functions/api/lib/rate-limit'

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
}

describe('rateLimit', () => {
  let kv: KVMock
  beforeEach(() => {
    kv = new KVMock()
  })

  it('allows up to max calls in a window', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await rateLimit(kv as unknown as KVNamespace, 'user1', {
        max: 3,
        windowSeconds: 60,
        prefix: 'test',
      })
      expect(r.allowed).toBe(true)
    }
  })

  it('rejects the (max+1)th call in the same window', async () => {
    for (let i = 0; i < 3; i++) {
      await rateLimit(kv as unknown as KVNamespace, 'user1', { max: 3, windowSeconds: 60, prefix: 't' })
    }
    const r = await rateLimit(kv as unknown as KVNamespace, 'user1', { max: 3, windowSeconds: 60, prefix: 't' })
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('isolates callers by id', async () => {
    for (let i = 0; i < 3; i++) {
      await rateLimit(kv as unknown as KVNamespace, 'user1', { max: 3, windowSeconds: 60, prefix: 't' })
    }
    const other = await rateLimit(kv as unknown as KVNamespace, 'user2', {
      max: 3,
      windowSeconds: 60,
      prefix: 't',
    })
    expect(other.allowed).toBe(true)
  })

  it('isolates by prefix', async () => {
    for (let i = 0; i < 3; i++) {
      await rateLimit(kv as unknown as KVNamespace, 'user1', { max: 3, windowSeconds: 60, prefix: 'a' })
    }
    const other = await rateLimit(kv as unknown as KVNamespace, 'user1', {
      max: 3,
      windowSeconds: 60,
      prefix: 'b',
    })
    expect(other.allowed).toBe(true)
  })

  it('falls open when KV is undefined (tests / pre-bootstrap)', async () => {
    const r = await rateLimit(undefined, 'user1', { max: 1, windowSeconds: 60, prefix: 't' })
    expect(r.allowed).toBe(true)
  })
})
