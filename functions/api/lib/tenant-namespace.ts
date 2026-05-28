/**
 * EDGE-NAMESPACE-ISOLATION-01 — per-tenant KV namespace prefixes (S77).
 */
export type TenantNamespace = {
  teamId: string
  prefix: string
  isolatedBindings: string[]
}

export function tenantNamespacePrefix(teamId: string): string {
  return `tn:${teamId}:`
}

export function namespacedKey(teamId: string, key: string): string {
  return `${tenantNamespacePrefix(teamId)}${key}`
}

export function describeTenantNamespace(teamId: string): TenantNamespace {
  return {
    teamId,
    prefix: tenantNamespacePrefix(teamId),
    isolatedBindings: ['SESSIONS_KV', 'INTEGRATIONS_KV', 'ACTIONS_KV'],
  }
}
