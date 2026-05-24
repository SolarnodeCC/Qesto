import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordCoachingAction, listCoachingActions } from '../../functions/api/lib/coaching-actions'

describe('coaching-actions', () => {
  const store = new Map<string, string>()

  const kv = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
  } as unknown as KVNamespace

  beforeEach(() => {
    store.clear()
    vi.clearAllMocks()
  })

  it('records and lists actions', async () => {
    await recordCoachingAction(kv, 'sess-1', {
      sessionId: 'sess-1',
      action: 'accepted',
      headline: 'Use open questions',
      at: Date.now(),
    })
    const actions = await listCoachingActions(kv, 'sess-1')
    expect(actions).toHaveLength(1)
    expect(actions[0]?.action).toBe('accepted')
  })
})
