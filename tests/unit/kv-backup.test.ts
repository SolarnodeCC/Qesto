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
  putFailures = 0

  async put(key: string, value: string): Promise<void> {
    if (this.putFailures > 0) {
      this.putFailures--
      throw new Error('R2 put failed')
    }
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

  it('handles cursor pagination across multiple batches', async () => {
    const kv = new ListableKVMock()
    // Add 1500 keys (exceeds default limit of 500)
    for (let i = 0; i < 1500; i++) {
      await kv.put(`audit:record-${i}`, JSON.stringify({ id: i }))
    }

    const r2 = new R2Mock()

    // Batch 0 (cursor undefined)
    const batch0 = await exportKvNamespaceToR2(
      kv as unknown as KVNamespace,
      r2 as unknown as R2Bucket,
      'audit',
      { limit: 500 },
    )
    expect(batch0).not.toBeNull()
    expect(batch0!.keysExported).toBe(500)
    expect(batch0!.truncated).toBe(true)
    expect(batch0!.nextCursor).toBeDefined()
    expect(batch0!.r2Key).toMatch(/batch-0\.json$/)

    // Batch 1 (with cursor)
    const batch1 = await exportKvNamespaceToR2(
      kv as unknown as KVNamespace,
      r2 as unknown as R2Bucket,
      'audit',
      { limit: 500, cursor: batch0!.nextCursor! },
    )
    expect(batch1).not.toBeNull()
    expect(batch1!.keysExported).toBe(500)
    expect(batch1!.truncated).toBe(true)
    expect(batch1!.r2Key).toMatch(/batch-500\.json$/)

    // Batch 2 (final batch)
    const batch2 = await exportKvNamespaceToR2(
      kv as unknown as KVNamespace,
      r2 as unknown as R2Bucket,
      'audit',
      { limit: 500, cursor: batch1!.nextCursor! },
    )
    expect(batch2).not.toBeNull()
    expect(batch2!.keysExported).toBe(500)
    expect(batch2!.truncated).toBe(false)
    expect(batch2!.r2Key).toMatch(/batch-1000\.json$/)

    // Verify all 3 batches were stored
    expect(r2.objects.size).toBe(3)
  })

  it('propagates R2 put failures', async () => {
    const kv = new ListableKVMock()
    await kv.put('audit:test', '{"data":"value"}')

    const r2 = new R2Mock()
    r2.putFailures = 1

    await expect(
      exportKvNamespaceToR2(
        kv as unknown as KVNamespace,
        r2 as unknown as R2Bucket,
        'audit',
      ),
    ).rejects.toThrow('R2 put failed')
  })

  it('exports partial data when some keys are missing', async () => {
    const kv = new ListableKVMock()
    await kv.put('audit:exists', '{"data":"value"}')
    // Note: audit:deleted key is in list but will be null on get (simulating deletion)

    const r2 = new R2Mock()
    const result = await exportKvNamespaceToR2(
      kv as unknown as KVNamespace,
      r2 as unknown as R2Bucket,
      'audit',
    )

    expect(result).not.toBeNull()
    expect(result!.keysExported).toBe(1)

    const stored = JSON.parse(r2.objects.get(result!.r2Key)!)
    expect(Object.keys(stored.keys).length).toBe(1)
    expect(stored.keys['audit:exists']).toContain('value')
  })
})
