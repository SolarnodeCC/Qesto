// Lightweight in-memory KV stub that covers the KVNamespace methods used by
// auth routes (get, put, delete). Not a full implementation — extend as needed.

export class KVMock {
  private store = new Map<string, string>()

  async get(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<unknown> {
    const raw = this.store.get(key) ?? null
    if (raw === null) return null
    if (type === 'json') return JSON.parse(raw)
    return raw
  }

  async put(key: string, value: string, _opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  // Allow test code to inspect the store directly.
  has(key: string): boolean {
    return this.store.has(key)
  }

  getRaw(key: string): string | undefined {
    return this.store.get(key)
  }
}
