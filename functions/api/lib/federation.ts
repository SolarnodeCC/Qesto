import { absent } from './absent'
/**
 * FEDERATION-01 / ADR-0033 — cross-org trust links (metadata only).
 */
import { z } from 'zod'
import { readKvJson, writeKvJson } from './kv'
import { ulid } from './ulid'

export const FederationScopeSchema = z.enum(['read_sessions', 'share_templates', 'co_host_live'])
export type FederationScope = z.infer<typeof FederationScopeSchema>

export const FederationLinkSchema = z.object({
  id: z.string(),
  sourceTeamId: z.string(),
  targetTeamId: z.string(),
  scopes: z.array(FederationScopeSchema),
  status: z.enum(['pending', 'active', 'revoked']),
  consentAt: z.number().optional(),
  createdAt: z.number(),
  createdBy: z.string(),
})

export type FederationLink = z.infer<typeof FederationLinkSchema>

export function federationLinkKey(id: string): string {
  return `federation:link:${id}`
}

export function teamFederationIndexKey(teamId: string): string {
  return `federation:index:${teamId}`
}

export async function createFederationLink(
  kv: KVNamespace,
  params: {
    sourceTeamId: string
    targetTeamId: string
    scopes: FederationScope[]
    createdBy: string
  },
): Promise<FederationLink> {
  const link: FederationLink = {
    id: ulid(),
    sourceTeamId: params.sourceTeamId,
    targetTeamId: params.targetTeamId,
    scopes: params.scopes,
    status: 'pending',
    createdAt: Date.now(),
    createdBy: params.createdBy,
  }
  await writeKvJson(kv, federationLinkKey(link.id), link)
  for (const teamId of [params.sourceTeamId, params.targetTeamId]) {
    const index = (await readKvJson<string[]>(kv, teamFederationIndexKey(teamId))) ?? []
    if (!index.includes(link.id)) {
      index.push(link.id)
      await writeKvJson(kv, teamFederationIndexKey(teamId), index)
    }
  }
  return link
}

export async function consentFederationLink(kv: KVNamespace, linkId: string): Promise<FederationLink | null> {
  const link = await readKvJson<FederationLink>(kv, federationLinkKey(linkId))
  if (!link || link.status !== 'pending') {
    return absent()
  }
  const updated: FederationLink = { ...link, status: 'active', consentAt: Date.now() }
  await writeKvJson(kv, federationLinkKey(linkId), updated)
  return updated
}

export async function listTeamFederationLinks(kv: KVNamespace, teamId: string): Promise<FederationLink[]> {
  const index = (await readKvJson<string[]>(kv, teamFederationIndexKey(teamId))) ?? []
  const out: FederationLink[] = []
  for (const id of index) {
    const raw = await readKvJson<unknown>(kv, federationLinkKey(id))
    const parsed = raw ? FederationLinkSchema.safeParse(raw) : null
    if (parsed?.success) out.push(parsed.data)
  }
  return out
}
