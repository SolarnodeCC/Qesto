import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  crossRegionEnergizerKey,
  mirrorEnergizerToKv,
  loadEnergizerMirrorFromKv,
} from '../../functions/api/lib/session-room-cross-region'
import type { LiveEnergizerState } from '../../functions/api/realtime'

describe('session-room-cross-region', () => {
  const store = new Map<string, string>()
  const kv = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => store.set(k, v)),
    delete: vi.fn(async (k: string) => store.delete(k)),
  } as unknown as KVNamespace

  beforeEach(() => {
    store.clear()
    vi.clearAllMocks()
  })

  it('mirrors and loads energizer state', async () => {
    const state: LiveEnergizerState = {
      id: 'e1',
      kind: 'team_quiz',
      title: 'Quiz',
      status: 'active',
    }
    await mirrorEnergizerToKv(kv, 'sess-1', state)
    expect(store.has(crossRegionEnergizerKey('sess-1'))).toBe(true)
    const loaded = await loadEnergizerMirrorFromKv(kv, 'sess-1')
    expect(loaded?.id).toBe('e1')
  })
})
