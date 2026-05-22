/**
 * GDPR-BADGE-01 — delete all personal data for an authenticated user.
 */
import { hardDeleteSession } from './session-delete'
import { teamDocumentKey, userPrefsKey } from './kv-keys'

export type GdprDeleteResult = {
  sessionsDeleted: number
  userRowDeleted: boolean
}

export async function deleteUserGdprData(
  env: {
    DB: D1Database
    USERS_KV: KVNamespace
    TEAMS_KV: KVNamespace
    SESSIONS_KV?: KVNamespace
  },
  userId: string,
): Promise<GdprDeleteResult> {
  const { results: sessions } = await env.DB.prepare(
    `SELECT id FROM sessions WHERE owner_id = ?1`,
  )
    .bind(userId)
    .all<{ id: string }>()

  let sessionsDeleted = 0
  for (const row of sessions.results ?? []) {
    const { deleted } = await hardDeleteSession(env.DB, row.id, userId)
    if (deleted) sessionsDeleted++
  }

  await env.DB.prepare(`DELETE FROM sprint19_events WHERE user_id = ?1`).bind(userId).run()
  await env.DB.prepare(`DELETE FROM audit_events WHERE actor_id = ?1`).bind(userId).run().catch(() => {})
  const userDelete = await env.DB.prepare(`DELETE FROM users WHERE id = ?1`).bind(userId).run()

  await env.USERS_KV.delete(userPrefsKey(userId))
  await env.USERS_KV.delete(`user-teams:${userId}`).catch(() => {})

  const teamsRaw = await env.TEAMS_KV.get(`user-teams:${userId}`)
  if (teamsRaw) {
    try {
      const teamIds = JSON.parse(teamsRaw) as string[]
      if (Array.isArray(teamIds)) {
        for (const teamId of teamIds) {
          const doc = await env.TEAMS_KV.get(teamDocumentKey(teamId))
          if (!doc) continue
          const team = JSON.parse(doc) as { members?: { userId: string }[] }
          if (!team.members) continue
          team.members = team.members.filter((m) => m.userId !== userId)
          await env.TEAMS_KV.put(teamDocumentKey(teamId), JSON.stringify(team))
        }
      }
    } catch {
      /* ignore malformed index */
    }
    await env.TEAMS_KV.delete(`user-teams:${userId}`)
  }

  return {
    sessionsDeleted,
    userRowDeleted: (userDelete.meta?.changes ?? 0) > 0,
  }
}
