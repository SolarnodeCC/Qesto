/**
 * LDAP-02 — map directory groups to Qesto team roles (KV-backed).
 */
import { readKvJson, writeKvJson } from './kv'
import type { TeamMember } from '../routes/teams'

export type LdapGroupRole = TeamMember['role']

export type LdapGroupMap = Record<string, LdapGroupRole>

export function ldapGroupMapKey(teamId: string): string {
  return `ldap:group-map:${teamId}`
}

export async function loadLdapGroupMap(kv: KVNamespace, teamId: string): Promise<LdapGroupMap> {
  return (await readKvJson<LdapGroupMap>(kv, ldapGroupMapKey(teamId))) ?? {}
}

export async function saveLdapGroupMap(kv: KVNamespace, teamId: string, map: LdapGroupMap): Promise<void> {
  await writeKvJson(kv, ldapGroupMapKey(teamId), map)
}

export function resolveRoleForGroups(groups: string[], map: LdapGroupMap, fallback: LdapGroupRole = 'member'): LdapGroupRole {
  for (const g of groups) {
    const role = map[g] ?? map[g.toLowerCase()]
    if (role) return role
  }
  return fallback
}

export type LdapSyncFilter = {
  allowedOus?: string[]
  allowedGroups?: string[]
}

export function ldapFilterKey(teamId: string): string {
  return `ldap:filter:${teamId}`
}

export function entryPassesFilter(
  entry: { groups?: string[]; ou?: string },
  filter: LdapSyncFilter,
): boolean {
  if (filter.allowedOus?.length) {
    const ou = entry.ou ?? ''
    if (!filter.allowedOus.some((prefix) => ou.startsWith(prefix))) return false
  }
  if (filter.allowedGroups?.length) {
    const groups = entry.groups ?? []
    if (!filter.allowedGroups.some((g) => groups.includes(g))) return false
  }
  return true
}
