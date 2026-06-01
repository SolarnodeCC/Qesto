/**
 * GDPR-BADGE-01 — delete all personal data for an authenticated user.
 */
import { hardDeleteSession } from './session-delete'
import { teamDocumentKey, userPrefsKey } from './kv-keys'
import { readKvText, writeKvJson, deleteKv } from './kv'

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
  for (const row of sessions ?? []) {
    const { deleted } = await hardDeleteSession(env.DB, row.id, userId)
    if (deleted) sessionsDeleted++
  }

  await env.DB.prepare(`DELETE FROM sprint19_events WHERE user_id = ?1`).bind(userId).run()
  await env.DB.prepare(`DELETE FROM audit_events WHERE actor_id = ?1`).bind(userId).run().catch(() => {})
  const userDelete = await env.DB.prepare(`DELETE FROM users WHERE id = ?1`).bind(userId).run()

  await deleteKv(env.USERS_KV, userPrefsKey(userId))
  await deleteKv(env.USERS_KV, `user-teams:${userId}`).catch(() => {})

  const teamsRaw = await readKvText(env.TEAMS_KV, `user-teams:${userId}`)
  if (teamsRaw) {
    try {
      const parsed = JSON.parse(teamsRaw)
      const teamIds = Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
      if (teamIds.length) {
        for (const teamId of teamIds) {
          const doc = await readKvText(env.TEAMS_KV, teamDocumentKey(teamId))
          if (!doc) continue
          const teamParsed = JSON.parse(doc)
          if (!teamParsed || typeof teamParsed !== 'object') continue
          const members = (teamParsed as { members?: unknown }).members
          if (!Array.isArray(members)) continue
          const filtered = members.filter((m) => !(m && typeof m === 'object' && (m as { userId?: unknown }).userId === userId))
          await writeKvJson(env.TEAMS_KV, teamDocumentKey(teamId), { ...(teamParsed as Record<string, unknown>), members: filtered })
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
    await deleteKv(env.TEAMS_KV, `user-teams:${userId}`)
  }

  return {
    sessionsDeleted,
    userRowDeleted: (userDelete.meta?.changes ?? 0) > 0,
  }
}
