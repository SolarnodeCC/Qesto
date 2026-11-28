/**
 * Requirement: ADR-0001 (DO per session) + team RBAC — a session owner always controls their own session.
 */
import { describe, expect, it } from 'vitest'
import { presenterPermissionsForSession } from '../../functions/api/routes/sessions/shared'
import { KVMock } from '../helpers/kv-mock'
import type { Env } from '../../functions/api/types'

const env = { TEAMS_KV: new KVMock() as unknown as KVNamespace } as unknown as Env
const session = { id: 's1', owner_id: 'owner', team_id: 'team_gone' } as unknown as Parameters<typeof presenterPermissionsForSession>[1]

describe('presenterPermissionsForSession — team document missing', () => {
  it('owner keeps full control (undefined = unrestricted)', async () => {
    expect(await presenterPermissionsForSession(env, session, 'owner')).toBeUndefined()
  })
  it('non-owners get no permissions', async () => {
    expect(await presenterPermissionsForSession(env, session, 'someone_else')).toEqual([])
  })
})
