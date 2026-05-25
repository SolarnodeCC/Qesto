/**
 * LDAP-01 — directory sync (mock + HTTP bridge). No raw LDAP TCP on Workers.
 */
import { ulid } from './ulid'
import type { Team, TeamMember } from '../routes/teams'
import { teamDocumentKey, userTeamsIndexKey } from './kv-keys'
import { readKvJson, writeKvJson } from './kv'
import {
  entryPassesFilter,
  loadLdapGroupMap,
  resolveRoleForGroups,
  type LdapGroupMap,
  type LdapSyncFilter,
} from './ldap-group-map'

export type LdapDirectoryEntry = {
  email: string
  displayName?: string
  externalId: string
  active: boolean
  groups?: string[]
  ou?: string
}

export type LdapSyncResult = {
  created: number
  updated: number
  deactivated: number
  membersAdded: number
  total: number
}

const MOCK_DIRECTORY: LdapDirectoryEntry[] = [
  {
    email: 'ada@example.com',
    displayName: 'Ada Lovelace',
    externalId: 'ldap:ada',
    active: true,
    groups: ['qesto-admins'],
    ou: 'ou=people,dc=example,dc=com',
  },
  {
    email: 'grace@example.com',
    displayName: 'Grace Hopper',
    externalId: 'ldap:grace',
    active: true,
    groups: ['qesto-members'],
    ou: 'ou=people,dc=example,dc=com',
  },
]

function ldapProvisionedKey(teamId: string): string {
  return `ldap:provisioned:${teamId}`
}

export async function fetchLdapDirectory(env: {
  LDAP_URL?: string
  LDAP_BRIDGE_URL?: string
  LDAP_SYNC_MOCK?: string
}): Promise<LdapDirectoryEntry[]> {
  if (env.LDAP_SYNC_MOCK === 'true' || env.LDAP_URL === 'mock://ldap') {
    return MOCK_DIRECTORY
  }
  const bridge = env.LDAP_BRIDGE_URL?.trim()
  if (bridge) {
    const res = await fetch(bridge, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'search', base: 'dc=example,dc=com' }),
    })
    if (!res.ok) {
      throw new Error(`ldap_bridge_error:${res.status}`)
    }
    const data = (await res.json()) as { entries?: LdapDirectoryEntry[] }
    return data.entries ?? []
  }
  throw new Error('ldap_provider_unconfigured')
}

export async function syncLdapDirectoryToTeam(
  db: D1Database,
  teamsKv: KVNamespace,
  teamId: string,
  entries: LdapDirectoryEntry[],
  opts?: { filter?: LdapSyncFilter; groupMap?: LdapGroupMap },
): Promise<LdapSyncResult> {
  const team = await readKvJson<Team>(teamsKv, teamDocumentKey(teamId))
  if (!team) {
    throw new Error('team_not_found')
  }

  const result: LdapSyncResult = {
    created: 0,
    updated: 0,
    deactivated: 0,
    membersAdded: 0,
    total: entries.length,
  }
  const now = Date.now()
  const filter = opts?.filter ?? {}
  const groupMap = opts?.groupMap ?? (await loadLdapGroupMap(teamsKv, teamId))
  const activeExternalIds = new Set<string>()

  for (const entry of entries) {
    const email = entry.email.trim().toLowerCase()
    if (!email || !entry.active) {
      result.deactivated++
      continue
    }
    if (!entryPassesFilter(entry, filter)) continue
    activeExternalIds.add(entry.externalId)

    const existing = await db
      .prepare('SELECT id, email, display_name FROM users WHERE email = ?1')
      .bind(email)
      .first<{ id: string; email: string; display_name: string | null }>()

    let userId: string
    if (existing) {
      userId = existing.id
      if (entry.displayName && entry.displayName !== existing.display_name) {
        await db
          .prepare('UPDATE users SET display_name = ?1 WHERE id = ?2')
          .bind(entry.displayName, userId)
          .run()
        result.updated++
      }
    } else {
      userId = ulid()
      await db
        .prepare(
          `INSERT INTO users (id, email, display_name, created_at, last_login_at, plan)
           VALUES (?1, ?2, ?3, ?4, NULL, 'team')`,
        )
        .bind(userId, email, entry.displayName ?? null, now)
        .run()
      result.created++
    }

    if (!team.members.some((m) => m.userId === userId)) {
      const role = resolveRoleForGroups(entry.groups ?? [], groupMap)
      const member: TeamMember = {
        userId,
        email,
        role,
        joinedAt: now,
      }
      team.members.push(member)
      result.membersAdded++
      const ids = (await readKvJson<string[]>(teamsKv, userTeamsIndexKey(userId))) ?? []
      if (!ids.includes(teamId)) {
        ids.push(teamId)
        await writeKvJson(teamsKv, userTeamsIndexKey(userId), ids)
      }
    } else {
      const member = team.members.find((m) => m.userId === userId)
      if (member && entry.groups?.length) {
        member.role = resolveRoleForGroups(entry.groups, groupMap, member.role)
      }
    }
  }

  const provisioned =
    (await readKvJson<string[]>(teamsKv, ldapProvisionedKey(teamId))) ?? []
  for (const extId of provisioned) {
    if (activeExternalIds.has(extId)) continue
    const entry = entries.find((e) => e.externalId === extId)
    const email = entry?.email?.toLowerCase()
    if (!email) continue
    const before = team.members.length
    team.members = team.members.filter((m) => m.email !== email || m.role === 'owner')
    if (team.members.length < before) result.deactivated++
  }
  await writeKvJson(teamsKv, ldapProvisionedKey(teamId), [...activeExternalIds])

  await writeKvJson(teamsKv, teamDocumentKey(teamId), team)
  return result
}
