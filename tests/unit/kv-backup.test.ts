import { describe, expect, it } from 'vitest'
import { exportKvNamespaceToR2 } from '../../functions/api/lib/kv-backup'
import { KVMock } from '../helpers/kv-mock'

class ListableKVMock extends KVMock {
  async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
    let keys = this.keys()
    const prefix = options?.prefix
    if (prefix) keys = keys.filter((k) => k.startsWith(prefix))
    const start = options?.cursor ? Number.parseInt(options.cursor, 10) : 0
    const limit = options?.limit ?? 1000
    const slice = keys.slice(start, start + limit)
    const next = start + limit < keys.length ? String(start + limit) : undefined
    return {
      keys: slice.map((name) => ({ name })),
      list_complete: next === undefined,
      ...(next ? { cursor: next } : {}),
    }
  }
}

class R2Mock {
  objects = new Map<string, string>()

  async put(key: string, value: string): Promise<void> {
    this.objects.set(key, value)
  }
}

describe('kv-backup (OPS-DR-GAP-01)', () => {
  it('exports KV keys to R2 under kv-backups/{namespace}/{date}/', async () => {
    const kv = new ListableKVMock()
    await kv.put('audit:team-1', '{"event":"login"}')
    await kv.put('audit:team-2', '{"event":"logout"}')

    const r2 = new R2Mock()
    const result = await exportKvNamespaceToR2(
      kv as unknown as KVNamespace,
      r2 as unknown as R2Bucket,
      'audit',
    )

    expect(result).not.toBeNull()
    expect(result!.keysExported).toBe(2)
    expect(result!.r2Key).toMatch(/^kv-backups\/audit\/\d{4}-\d{2}-\d{2}\/batch-0\.json$/)
    expect(result!.truncated).toBe(false)

    const stored = JSON.parse(r2.objects.get(result!.r2Key)!)
    expect(stored.keys['audit:team-1']).toContain('login')
    expect(stored.listComplete).toBe(true)
  })

  it('returns null when namespace is empty', async () => {
    const kv = new ListableKVMock()
    const r2 = new R2Mock()
    const result = await exportKvNamespaceToR2(
      kv as unknown as KVNamespace,
      r2 as unknown as R2Bucket,
      'actions',
    )
    expect(result).toBeNull()
  })
})
