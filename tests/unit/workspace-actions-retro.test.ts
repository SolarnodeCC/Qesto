import { describe, expect, it } from 'vitest'
import { mergeRetroActionsOnClose, readWorkspaceActions } from '../../functions/api/lib/workspace-actions'
import { KVMock } from '../helpers/kv-mock'

describe('mergeRetroActionsOnClose', () => {
  it('adds new action items and dedupes by text', async () => {
    const kv = new KVMock() as unknown as KVNamespace
    const teamId = 'team_1'
    const wsId = 'ws_1'
    const sessionId = 'sess_1'

    const added = await mergeRetroActionsOnClose(kv, teamId, wsId, sessionId, [
      'Improve CI',
      'Improve CI',
      'Add tests',
    ])
    expect(added).toBe(2)

    const blob = await readWorkspaceActions(kv, teamId, wsId)
    expect(blob.items).toHaveLength(2)
    expect(blob.items.map((i) => i.text).sort()).toEqual(['Add tests', 'Improve CI'])
    expect(blob.items.every((i) => i.status === 'open')).toBe(true)
  })

  it('skips duplicates already in workspace actions', async () => {
    const kv = new KVMock() as unknown as KVNamespace
    const teamId = 'team_1'
    const wsId = 'ws_1'

    await mergeRetroActionsOnClose(kv, teamId, wsId, 'sess_a', ['Existing item'])
    const added = await mergeRetroActionsOnClose(kv, teamId, wsId, 'sess_b', ['Existing item', 'Fresh item'])
    expect(added).toBe(1)

    const blob = await readWorkspaceActions(kv, teamId, wsId)
    expect(blob.items).toHaveLength(2)
  })
})
