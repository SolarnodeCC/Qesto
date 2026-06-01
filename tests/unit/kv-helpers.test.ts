import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { readKvJson, readKvText, writeKvJson, writeKvText, deleteKv } from '../../functions/api/lib/kv'
import { KVMock } from '../helpers/kv-mock'

const asKv = (m: KVMock) => m as unknown as KVNamespace

describe('kv helpers', () => {
  it('writeKvJson serializes and readKvJson parses round-trip', async () => {
    const kv = new KVMock()
    await writeKvJson(asKv(kv), 'k', { a: 1, b: 'x' })
    expect(kv.getRaw('k')).toBe('{"a":1,"b":"x"}')
    await expect(readKvJson(asKv(kv), 'k')).resolves.toEqual({ a: 1, b: 'x' })
  })

  it('readKvJson returns null on miss and validates with a schema', async () => {
    const kv = new KVMock()
    await expect(readKvJson(asKv(kv), 'missing')).resolves.toBeNull()
    await writeKvText(asKv(kv), 'bad', '{"n":"not-a-number"}')
    const schema = z.object({ n: z.number() })
    await expect(readKvJson(asKv(kv), 'bad', schema)).resolves.toBeNull()
  })

  it('writeKvText / readKvText pass raw strings through unchanged', async () => {
    const kv = new KVMock()
    await writeKvText(asKv(kv), 'flag', '1')
    expect(kv.getRaw('flag')).toBe('1')
    await expect(readKvText(asKv(kv), 'flag')).resolves.toBe('1')
    await expect(readKvText(asKv(kv), 'nope')).resolves.toBeNull()
  })

  it('deleteKv removes the key', async () => {
    const kv = new KVMock()
    await writeKvText(asKv(kv), 'k', 'v')
    await deleteKv(asKv(kv), 'k')
    expect(kv.has('k')).toBe(false)
  })
})
