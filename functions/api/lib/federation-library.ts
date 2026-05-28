/**
 * FEDERATION-LIBRARY-01 — shared session templates across federation links (S74).
 */
import { listTeamFederationLinks, type FederationLink } from './federation'
import { readKvJson } from './kv'

export type FederationLibraryEntry = {
  linkId: string
  targetTeamId: string
  templateId: string
  title: string
  sharedAt: number
}

export async function listFederationLibrary(
  teamsKv: KVNamespace,
  templatesKv: KVNamespace,
  teamId: string,
): Promise<FederationLibraryEntry[]> {
  const links = await listTeamFederationLinks(teamsKv, teamId)
  const active = links.filter((l: FederationLink) => l.status === 'active' && l.scopes.includes('read_sessions'))
  const out: FederationLibraryEntry[] = []
  for (const link of active) {
    const index = await readKvJson<string[]>(templatesKv, `federation:library:${link.targetTeamId}`)
    for (const templateId of index ?? []) {
      const meta = await readKvJson<{ title?: string; sharedAt?: number }>(templatesKv, `template:${templateId}`)
      if (meta?.title) {
        out.push({
          linkId: link.id,
          targetTeamId: link.targetTeamId,
          templateId,
          title: meta.title,
          sharedAt: meta.sharedAt ?? 0,
        })
      }
    }
  }
  return out.sort((a, b) => b.sharedAt - a.sharedAt)
}
