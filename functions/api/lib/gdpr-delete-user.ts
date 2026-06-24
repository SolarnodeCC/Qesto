/**
 * GDPR-BADGE-01 — delete all personal data for an authenticated user.
 */
import { hardDeleteSession } from './session-delete'
import { teamDocumentKey, userPrefsKey } from './kv-keys'
import { readKvText, writeKvJson, deleteKv } from './kv'

export type GdprDeleteResult = {
  sessionsDeleted: number
  userRowDeleted: boolean
  /** Third privacy layer — decision vectors removed from DECISIONS_VECTORIZE. */
  vectorsDeleted: number
}

export async function deleteUserGdprData(
  env: {
    DB: D1Database
    USERS_KV: KVNamespace
    TEAMS_KV: KVNamespace
    SESSIONS_KV?: KVNamespace
    // Third privacy layer. Optional so existing callers keep working; when
    // supplied, the user's decision vectors (keyed by session id, see
    // insights-vectorize.ts) are purged alongside content + metadata.
    DECISIONS_VECTORIZE?: VectorizeIndex
  },
  userId: string,
): Promise<GdprDeleteResult> {
  const { results: sessions } = await env.DB.prepare(
    `SELECT id FROM sessions WHERE owner_id = ?1`,
  )
    .bind(userId)
    .all<{ id: string }>()

  const sessionIds = (sessions ?? []).map((s) => s.id)

  // Layer 3 (vector index) FIRST, while the id set is still known.
  // DECISIONS_VECTORIZE entries are keyed by session id. HELP_VECTORIZE is
  // intentionally NOT touched — it is keyed by help-document id and holds no
  // user-linked PII. Best-effort: a vector-purge failure must not block the
  // D1/KV deletion (the legal floor) that follows.
  let vectorsDeleted = 0
  if (env.DECISIONS_VECTORIZE && sessionIds.length > 0) {
    try {
      const res = (await env.DECISIONS_VECTORIZE.deleteByIds(sessionIds)) as { count?: number } | undefined
      vectorsDeleted = typeof res?.count === 'number' ? res.count : sessionIds.length
    } catch {
      /* swallow — durable-record deletion below is what GDPR Art. 17 requires */
    }
  }

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
    vectorsDeleted,
  }
}
