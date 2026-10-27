/**
 * Multi-factor authentication — TOTP + recovery codes (DD-04, issue #877).
 *
 * Storage: one USERS_KV record per user (`mfa:<userId>`). The TOTP secret is
 * encrypted at rest with AES-256-GCM under `MFA_ENCRYPTION_KEY` (or, when that
 * secret is unset, a key derived from JWT_SECRET under a fixed domain label —
 * JWT_SECRET_PREV is tried on read so a JWT rotation does not lock users out).
 * Recovery codes are stored only as SHA-256 hashes and are single use.
 *
 * Login: when MFA is enabled, every first factor (password, magic link,
 * Google) yields only a 5-minute "mfa pending" token — signed with its own
 * derived key so it can never be presented as a session — and the session is
 * issued by POST /api/auth/mfa/verify. Sessions minted after a second factor
 * carry `mfa_at` (seconds); platformAdminGuard uses it for step-up
 * (ADMIN_MFA_REQUIRED).
 *
 * Replay: the last accepted TOTP step is stored; a code for that step or an
 * earlier one is refused, so a shoulder-surfed code cannot be reused.
 */
import type { Env } from '../types'
import { hmacSign } from './shared/crypto'
import { readKvJson, writeKvJson } from './kv'
import { signJwt, verifyJwtWithSecrets, type AuthClaims } from './jwt'
import { generateTotpSecret, verifyTotp } from './totp'
import { ulid } from './ulid'

export const MFA_PENDING_TTL_SECONDS = 5 * 60
/** Step-up window for sensitive actions. */
export const MFA_STEP_UP_MAX_AGE_SECONDS = 15 * 60
export const RECOVERY_CODE_COUNT = 10

type StoredSecret = { iv: string; ct: string }

export type MfaRecord = {
  /** Encrypted TOTP secret. */
  secret: StoredSecret
  /** Null while enrolment awaits its first code. */
  enabledAt: number | null
  lastStep: number
  recoveryCodeHashes: string[]
}

export function mfaKvKey(userId: string): string {
  return `mfa:${userId}`
}

type KeyEnv = Pick<Env, 'JWT_SECRET' | 'JWT_SECRET_PREV' | 'MFA_ENCRYPTION_KEY'>

function b64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))
}

async function aesKey(material: string): Promise<CryptoKey> {
  const raw = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material)))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/** Key material, current first. Never JWT_SECRET itself. */
async function encryptionMaterials(env: KeyEnv): Promise<string[]> {
  if (env.MFA_ENCRYPTION_KEY) return [env.MFA_ENCRYPTION_KEY]
  const out: string[] = []
  for (const base of [env.JWT_SECRET, env.JWT_SECRET_PREV]) {
    if (base) out.push(await hmacSign(base, 'qesto/mfa-secret-encryption/v1'))
  }
  return out
}

async function encryptSecret(env: KeyEnv, plain: string): Promise<StoredSecret> {
  const [material] = await encryptionMaterials(env)
  if (!material) throw new Error('No MFA encryption key available')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(material), new TextEncoder().encode(plain)),
  )
  return { iv: b64(iv), ct: b64(ct) }
}

async function decryptSecret(env: KeyEnv, stored: StoredSecret): Promise<string | null> {
  for (const material of await encryptionMaterials(env)) {
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: unb64(stored.iv) as BufferSource },
        await aesKey(material),
        unb64(stored.ct) as BufferSource,
      )
      return new TextDecoder().decode(plain)
    } catch {
      // Wrong key (e.g. pre-rotation material) — try the next one.
    }
  }
  return null
}

async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('')
}

function normaliseRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function generateRecoveryCodes(): string[] {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(10))
    const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
    return `${chars.slice(0, 5)}-${chars.slice(5)}`
  })
}

export async function loadMfa(env: Pick<Env, 'USERS_KV'>, userId: string): Promise<MfaRecord | null> {
  return readKvJson<MfaRecord>(env.USERS_KV, mfaKvKey(userId))
}

export async function isMfaEnabled(env: Pick<Env, 'USERS_KV'>, userId: string): Promise<boolean> {
  const rec = await loadMfa(env, userId)
  return typeof rec?.enabledAt === 'number'
}

/** Start (or restart) enrolment. Refused while MFA is already enabled. */
export async function beginEnrolment(
  env: Pick<Env, 'USERS_KV'> & KeyEnv,
  userId: string,
): Promise<{ secret: string } | { error: 'already_enabled' }> {
  const existing = await loadMfa(env, userId)
  if (existing?.enabledAt) return { error: 'already_enabled' }
  const secret = generateTotpSecret()
  const rec: MfaRecord = { secret: await encryptSecret(env, secret), enabledAt: null, lastStep: 0, recoveryCodeHashes: [] }
  await writeKvJson(env.USERS_KV, mfaKvKey(userId), rec)
  return { secret }
}

/** Confirm enrolment with a first valid code; returns the recovery codes ONCE. */
export async function confirmEnrolment(
  env: Pick<Env, 'USERS_KV'> & KeyEnv,
  userId: string,
  code: string,
  nowMs = Date.now(),
): Promise<{ recoveryCodes: string[] } | { error: 'not_started' | 'already_enabled' | 'invalid_code' }> {
  const rec = await loadMfa(env, userId)
  if (!rec) return { error: 'not_started' }
  if (rec.enabledAt) return { error: 'already_enabled' }
  const secret = await decryptSecret(env, rec.secret)
  const step = secret ? await verifyTotp(secret, code, nowMs) : null
  if (step === null) return { error: 'invalid_code' }
  const recoveryCodes = generateRecoveryCodes()
  await writeKvJson(env.USERS_KV, mfaKvKey(userId), {
    ...rec,
    enabledAt: nowMs,
    lastStep: step,
    recoveryCodeHashes: await Promise.all(recoveryCodes.map((c) => sha256Hex(normaliseRecoveryCode(c)))),
  } satisfies MfaRecord)
  return { recoveryCodes }
}

/**
 * Check a second factor: a TOTP code (replay-protected) or a single-use
 * recovery code. Persists the consumed step / code on success.
 */
export async function verifySecondFactor(
  env: Pick<Env, 'USERS_KV'> & KeyEnv,
  userId: string,
  input: { code?: string; recoveryCode?: string },
  nowMs = Date.now(),
): Promise<{ ok: true; method: 'totp' | 'recovery' } | { ok: false }> {
  const rec = await loadMfa(env, userId)
  if (!rec?.enabledAt) return { ok: false }
  if (input.code) {
    const secret = await decryptSecret(env, rec.secret)
    const step = secret ? await verifyTotp(secret, input.code, nowMs) : null
    if (step === null || step <= rec.lastStep) return { ok: false }
    await writeKvJson(env.USERS_KV, mfaKvKey(userId), { ...rec, lastStep: step } satisfies MfaRecord)
    return { ok: true, method: 'totp' }
  }
  if (input.recoveryCode) {
    const hash = await sha256Hex(normaliseRecoveryCode(input.recoveryCode))
    if (!rec.recoveryCodeHashes.includes(hash)) return { ok: false }
    await writeKvJson(env.USERS_KV, mfaKvKey(userId), {
      ...rec,
      recoveryCodeHashes: rec.recoveryCodeHashes.filter((h) => h !== hash),
    } satisfies MfaRecord)
    return { ok: true, method: 'recovery' }
  }
  return { ok: false }
}

export async function disableMfa(env: Pick<Env, 'USERS_KV'>, userId: string): Promise<void> {
  await env.USERS_KV.delete(mfaKvKey(userId))
}

export async function recoveryCodesRemaining(env: Pick<Env, 'USERS_KV'>, userId: string): Promise<number> {
  return (await loadMfa(env, userId))?.recoveryCodeHashes.length ?? 0
}

// ── Pending-login token ────────────────────────────────────────────────────

async function pendingSecrets(env: Pick<Env, 'JWT_SECRET' | 'JWT_SECRET_PREV'>): Promise<string[]> {
  const out: string[] = []
  for (const base of [env.JWT_SECRET, env.JWT_SECRET_PREV]) {
    if (base) out.push(await hmacSign(base, 'qesto/mfa-pending-token/v1'))
  }
  return out
}

/** Proof that the first factor passed; useless as a session (different key). */
export async function mintMfaPendingToken(
  env: Pick<Env, 'JWT_SECRET' | 'JWT_SECRET_PREV'>,
  user: { id: string; email: string },
): Promise<string> {
  const [key] = await pendingSecrets(env)
  if (!key) throw new Error('JWT_SECRET is not configured')
  return signJwt({ sub: user.id, email: user.email, jti: `mfa-pending:${ulid()}` }, key, MFA_PENDING_TTL_SECONDS)
}

export async function verifyMfaPendingToken(
  env: Pick<Env, 'JWT_SECRET' | 'JWT_SECRET_PREV'>,
  token: string,
): Promise<AuthClaims | null> {
  const claims = await verifyJwtWithSecrets(token, await pendingSecrets(env))
  if (!claims?.jti?.startsWith('mfa-pending:')) return null
  return claims
}

// ── Step-up ────────────────────────────────────────────────────────────────

export function hasRecentMfa(claims: Pick<AuthClaims, 'mfa_at'>, nowMs = Date.now()): boolean {
  return typeof claims.mfa_at === 'number' && nowMs / 1000 - claims.mfa_at <= MFA_STEP_UP_MAX_AGE_SECONDS
}
