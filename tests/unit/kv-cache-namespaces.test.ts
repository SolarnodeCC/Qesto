import { describe, expect, it } from 'vitest'
import { testJwtSecret } from '../helpers/test-credentials'
import {
  cacheLeaderboard,
  cachePlanUsage,
  cacheTeamMetadata,
  cacheUserRoles,
  getPlanUsageWithCache,
  invalidateCache,
  kvNamespaceForCacheKey,
} from '../../functions/api/middleware/kv-cache'
import type { Env } from '../../functions/api/types'
import { KVMock } from '../helpers/kv-mock'

function tinyEnv(partial: Partial<Env>): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: testJwtSecret(),
    ...partial,
  } as Env
}

describe('kvNamespaceForCacheKey (ST-04)', () => {
  it('routes team keys to TEAMS_KV', () => {
    expect(kvNamespaceForCacheKey('cache:team:tm_1')).toBe('TEAMS_KV')
  })

  it('routes leaderboard keys to SESSIONS_KV', () => {
    expect(kvNamespaceForCacheKey('cache:leaderboard:sess_1')).toBe('SESSIONS_KV')
  })

  it('routes plan and roles keys to USERS_KV', () => {
    expect(kvNamespaceForCacheKey('cache:plan:user_1')).toBe('USERS_KV')
    expect(kvNamespaceForCacheKey('cache:roles:user_1')).toBe('USERS_KV')
  })
})

describe('kv-cache writes target domain KV namespaces', () => {
  it('cachePlanUsage writes to USERS_KV', async () => {
    const usersKv = new KVMock()
    const teamsKv = new KVMock()
    const sessionsKv = new KVMock()
    const c = { env: tinyEnv({ USERS_KV: usersKv as unknown as KVNamespace, TEAMS_KV: teamsKv as unknown as KVNamespace, SESSIONS_KV: sessionsKv as unknown as KVNamespace }) }

    await cachePlanUsage(c as any, 'user_a', { plan: 'free' }, 60)

    expect(usersKv.has('cache:plan:user_a')).toBe(true)
    expect(teamsKv.keys().length).toBe(0)
    expect(sessionsKv.keys().length).toBe(0)
  })

  it('cacheTeamMetadata writes to TEAMS_KV', async () => {
    const usersKv = new KVMock()
    const teamsKv = new KVMock()
    const sessionsKv = new KVMock()
    const c = { env: tinyEnv({ USERS_KV: usersKv as unknown as KVNamespace, TEAMS_KV: teamsKv as unknown as KVNamespace, SESSIONS_KV: sessionsKv as unknown as KVNamespace }) }

    await cacheTeamMetadata(c as any, 'tm_9', { name: 'Alpha' })

    expect(teamsKv.has('cache:team:tm_9')).toBe(true)
    expect(usersKv.keys().length).toBe(0)
  })

  it('cacheUserRoles writes to USERS_KV', async () => {
    const usersKv = new KVMock()
    const teamsKv = new KVMock()
    const sessionsKv = new KVMock()
    const c = { env: tinyEnv({ USERS_KV: usersKv as unknown as KVNamespace, TEAMS_KV: teamsKv as unknown as KVNamespace, SESSIONS_KV: sessionsKv as unknown as KVNamespace }) }

    await cacheUserRoles(c as any, 'user_r', ['owner'])

    expect(usersKv.has('cache:roles:user_r')).toBe(true)
    expect(sessionsKv.keys().length).toBe(0)
  })

  it('cacheLeaderboard writes to SESSIONS_KV', async () => {
    const usersKv = new KVMock()
    const teamsKv = new KVMock()
    const sessionsKv = new KVMock()
    const c = { env: tinyEnv({ USERS_KV: usersKv as unknown as KVNamespace, TEAMS_KV: teamsKv as unknown as KVNamespace, SESSIONS_KV: sessionsKv as unknown as KVNamespace }) }

    await cacheLeaderboard(c as any, 'sess_z', [{ rank: 1 }])

    expect(sessionsKv.has('cache:leaderboard:sess_z')).toBe(true)
    expect(usersKv.keys().length).toBe(0)
  })

  it('invalidateCache deletes from the namespace implied by each key', async () => {
    const usersKv = new KVMock()
    const teamsKv = new KVMock()
    const sessionsKv = new KVMock()
    await usersKv.put('cache:plan:u1', '{}')
    await teamsKv.put('cache:team:t1', '{}')
    await sessionsKv.put('cache:leaderboard:s1', '{}')

    const env = tinyEnv({
      USERS_KV: usersKv as unknown as KVNamespace,
      TEAMS_KV: teamsKv as unknown as KVNamespace,
      SESSIONS_KV: sessionsKv as unknown as KVNamespace,
    })

    await invalidateCache({ env }, 'cache:plan:u1', 'cache:team:t1', 'cache:leaderboard:s1')

    expect(usersKv.has('cache:plan:u1')).toBe(false)
    expect(teamsKv.has('cache:team:t1')).toBe(false)
    expect(sessionsKv.has('cache:leaderboard:s1')).toBe(false)
  })
})

describe('getPlanUsageWithCache', () => {
  it('loads plan from D1 and monthly quota from SESSIONS_KV, caches snapshot on USERS_KV', async () => {
    const usersKv = new KVMock()
    const sessionsKv = new KVMock()
    const mockDb = {
      prepare(sql: string) {
        return {
          bind(..._args: unknown[]) {
            return {
              async first() {
                if (sql.includes('SELECT plan FROM users')) return { plan: 'starter' as const }
                return null
              },
            }
          },
        }
      },
    }

    const c = {
      env: tinyEnv({
        DB: mockDb as unknown as D1Database,
        USERS_KV: usersKv as unknown as KVNamespace,
        SESSIONS_KV: sessionsKv as unknown as KVNamespace,
        TEAMS_KV: new KVMock() as unknown as KVNamespace,
      }),
    }

    const usage = await getPlanUsageWithCache(c as any, 'host_1')

    expect(usage.plan).toBe('starter')
    expect(usage.sessions).toMatchObject({
      used: 0,
      limit: 50,
      remaining: 50,
    })
    expect(usersKv.has('cache:plan:host_1')).toBe(true)
  })
})
