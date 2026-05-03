import { ulid } from '../../lib/ulid'

/** USERS_KV: pwd:{userId} → { hash: string } */
export const pwdKey = (userId: string) => `pwd:${userId}`

/** USERS_KV: oauth:{provider}:{sub} → { userId: string; email: string } */
export const oauthKey = (provider: string, sub: string) => `oauth:${provider}:${sub}`

/** ACTIONS_KV: pwd-reset:{tokenHash} → { userId; email } (TTL in caller) */
export const resetKey = (tokenHash: string) => `pwd-reset:${tokenHash}`

/** Upsert a user from an OAuth provider login. Identity link stored in USERS_KV, not D1. */
export async function upsertOAuthUser(
  db: D1Database,
  kv: KVNamespace,
  provider: 'google' | 'microsoft',
  providerSub: string,
  email: string,
): Promise<string> {
  const now = Date.now()
  const key = oauthKey(provider, providerSub)

  const stored = await kv.get(key)
  if (stored) {
    try {
      const { userId } = JSON.parse(stored) as { userId: string }
      await db.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`).bind(now, userId).run()
      return userId
    } catch (parseErr) {
      console.warn(`[auth] failed to parse oauth state for ${provider}/${providerSub}:`, parseErr)
    }
  }

  const emailNorm = email.toLowerCase().trim()
  let userId: string

  const byEmail = await db.prepare(`SELECT id FROM users WHERE email = ?1`).bind(emailNorm).first<{ id: string }>()
  if (byEmail) {
    userId = byEmail.id
    await db.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`).bind(now, userId).run()
  } else {
    userId = ulid()
    await db
      .prepare(`INSERT INTO users (id, email, created_at, last_login_at, plan) VALUES (?1, ?2, ?3, ?3, 'free')`)
      .bind(userId, emailNorm, now)
      .run()
  }

  await kv.put(key, JSON.stringify({ userId, email: emailNorm }))
  return userId
}
