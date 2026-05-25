import { describe, expect, it } from 'vitest'
import { fetchLdapDirectory, syncLdapDirectoryToTeam } from '../../functions/api/lib/ldap-sync'
import type { Team } from '../../functions/api/routes/teams'
import { teamDocumentKey } from '../../functions/api/lib/kv-keys'

function mockDb() {
  const users = new Map<string, { id: string; email: string; display_name: string | null }>()
  return {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          if (sql.includes('WHERE email')) {
            const email = String(args[0]).toLowerCase()
            for (const u of users.values()) {
              if (u.email === email) return u
            }
            return null
          }
          return null
        },
        run: async () => {
          if (sql.includes('INSERT INTO users')) {
            users.set(String(args[0]), {
              id: String(args[0]),
              email: String(args[1]).toLowerCase(),
              display_name: args[2] as string | null,
            })
          }
          return { success: true }
        },
      }),
    }),
    _users: users,
  } as unknown as D1Database
}

function mockKv(team: Team) {
  const store = new Map<string, string>()
  store.set(teamDocumentKey(team.id), JSON.stringify(team))
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
  } as unknown as KVNamespace
}

describe('ldap-sync', () => {
  it('returns mock directory when LDAP_SYNC_MOCK=true', async () => {
    const entries = await fetchLdapDirectory({ LDAP_SYNC_MOCK: 'true' })
    expect(entries.length).toBeGreaterThanOrEqual(2)
    expect(entries[0]?.email).toContain('@')
  })

  it('upserts users and adds team members', async () => {
    const team: Team = {
      id: 'team_test',
      name: 'Test',
      ownerId: 'owner1',
      members: [{ userId: 'owner1', email: 'owner@example.com', role: 'owner', joinedAt: 1 }],
      plan: 'team',
      samlConfig: null,
      createdAt: 1,
    }
    const kv = mockKv(team)
    const db = mockDb()
    const entries = await fetchLdapDirectory({ LDAP_URL: 'mock://ldap' })
    const result = await syncLdapDirectoryToTeam(db, kv, team.id, entries)
    expect(result.created).toBeGreaterThanOrEqual(1)
    expect(result.membersAdded).toBeGreaterThanOrEqual(1)
  })
})
