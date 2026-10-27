/**
 * Platform-admin impersonation tokens (DD-23, issue #895).
 *
 * Before DD-23 an impersonation token was an ordinary session JWT signed with
 * JWT_SECRET whose `jti` happened to start with `imp:`. Its safety rested on an
 * unenforced invariant across every mint path — that no route ever lets a
 * caller influence `jti` — and nothing server-side knew an impersonation was
 * active, so a demoted admin kept a working cookie until expiry.
 *
 * Now:
 *   1. Impersonation tokens are signed with a SEPARATE key: `IMPERSONATION_SECRET`
 *      when set, otherwise a key derived from JWT_SECRET under a fixed domain
 *      label. Sessions are signed with JWT_SECRET itself, so no session-minting
 *      path can produce a token that verifies here, whatever claims it accepts.
 *   2. TTL is capped at IMPERSONATION_MAX_TTL_SECONDS (30 min); a token whose
 *      lifetime exceeds the cap is rejected even if correctly signed.
 *   3. Every active impersonation is registered in ACTIONS_KV. A token without
 *      a registry entry is rejected, and stop/logout deletes the entry.
 *   4. On every use the acting admin must STILL be a platform admin, so
 *      demotion revokes all of their impersonations immediately.
 */
import { signJwt, verifyJwtWithSecrets, type AuthClaims } from './jwt'
import { hmacSign } from './shared/crypto'
import { readKvJson, writeKvJson, deleteKv } from './kv'
import { isPlatformAdmin } from './platform-admin'
import { ulid } from './ulid'
import type { Env } from '../types'

/** Lifetime of a freshly minted impersonation token. */
export const IMPERSONATION_TTL_SECONDS = 15 * 60
/** Hard ceiling: impersonation is a support action, not a session. */
export const IMPERSONATION_MAX_TTL_SECONDS = 30 * 60

const DERIVATION_LABEL = 'qesto/impersonation-token/v1'
const JTI_PREFIX = 'imp:'

type RegistryEntry = { adminId: string; adminEmail: string; targetId: string }

export function activeImpersonationKey(jti: string): string {
  return `impersonation:active:${jti}`
}

/** Signing/verification keys for impersonation tokens — never JWT_SECRET itself. */
export async function impersonationSecrets(
  env: Pick<Env, 'JWT_SECRET' | 'JWT_SECRET_PREV' | 'IMPERSONATION_SECRET'>,
): Promise<string[]> {
  if (env.IMPERSONATION_SECRET) return [env.IMPERSONATION_SECRET]
  const out: string[] = []
  for (const base of [env.JWT_SECRET, env.JWT_SECRET_PREV]) {
    if (!base) continue
    const derived = await hmacSign(base, DERIVATION_LABEL)
    if (!out.includes(derived)) out.push(derived)
  }
  return out
}

export async function mintImpersonationToken(
  env: Env,
  args: { adminId: string; adminEmail: string; target: { id: string; email: string } },
): Promise<{ token: string; jti: string; ttlSeconds: number }> {
  const jti = `${JTI_PREFIX}${args.adminId}:${ulid()}`
  const [secret] = await impersonationSecrets(env)
  if (!secret) throw new Error('No impersonation signing key — JWT_SECRET is not configured')
  if (!env.ACTIONS_KV) throw new Error('ACTIONS_KV is required to register impersonations')
  const entry: RegistryEntry = { adminId: args.adminId, adminEmail: args.adminEmail, targetId: args.target.id }
  await writeKvJson(env.ACTIONS_KV, activeImpersonationKey(jti), entry, {
    expirationTtl: IMPERSONATION_TTL_SECONDS,
  })
  const token = await signJwt(
    { sub: args.target.id, email: args.target.email, jti },
    secret,
    IMPERSONATION_TTL_SECONDS,
  )
  return { token, jti, ttlSeconds: IMPERSONATION_TTL_SECONDS }
}

/**
 * Verify an impersonation cookie. Returns null — never throws — for anything
 * that is not a live, registered impersonation by a current platform admin;
 * callers then fall back to the caller's own session.
 */
export async function resolveImpersonation(
  env: Env,
  token: string,
): Promise<{ claims: AuthClaims; impersonatorId: string } | null> {
  const claims = await verifyJwtWithSecrets(token, await impersonationSecrets(env))
  if (!claims || typeof claims.jti !== 'string' || !claims.jti.startsWith(JTI_PREFIX)) return null
  if (claims.exp - claims.iat > IMPERSONATION_MAX_TTL_SECONDS) return null
  if (!env.ACTIONS_KV) return null
  const entry = await readKvJson<RegistryEntry>(env.ACTIONS_KV, activeImpersonationKey(claims.jti)).catch(
    () => null,
  )
  if (!entry || entry.targetId !== claims.sub) return null
  const impersonatorId = claims.jti.split(':')[1] ?? ''
  if (!impersonatorId || impersonatorId !== entry.adminId) return null
  if (!(await isPlatformAdmin(env, entry.adminId, entry.adminEmail))) return null
  return { claims, impersonatorId }
}

/** Remove the registry entry so the token stops resolving everywhere. */
export async function endImpersonation(env: Env, token: string): Promise<void> {
  if (!env.ACTIONS_KV) return
  const claims = await verifyJwtWithSecrets(token, await impersonationSecrets(env))
  if (!claims?.jti?.startsWith(JTI_PREFIX)) return
  await deleteKv(env.ACTIONS_KV, activeImpersonationKey(claims.jti))
}
