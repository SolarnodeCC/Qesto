/**
 * CONNECT-INVITE-01 (ADR-0062) — federation invite envelope.
 *
 * CONNECT lets N tenants share one live session. A tenant is never added
 * implicitly: the host mints a scoped, time-limited, HMAC-signed invite that the
 * invitee must present to join (S96). This module owns that envelope.
 *
 * The token is a compact HMAC-SHA-256 envelope (the ADR-0050 discipline — NOT a
 * JWT-with-secrets, NOT an API key): safe to hand to another tenant because it
 * grants only the scoped admission it names, to one session, until it expires.
 * Sign/verify reuse the single shared MAC primitive (lib/shared/crypto.ts) — no
 * route mints its own MAC inline.
 *
 *   token = base64url(claimsJson) + '.' + hmacSign(CONNECT_INVITE_SECRET, base64url(claimsJson))
 *
 * Sovereign exclusion (ADR-0058 / ADR-0059) is enforced here at mint:
 * `mintFederationInvite` calls `assertFederationAllowed(hostConfig)` BEFORE signing
 * and returns a typed violation — never a token — when the host is sovereign. The
 * join path (S96) re-checks the invitee with the same guard.
 */

import { z } from 'zod'
import { hmacSign, base64UrlEncode, base64UrlDecode, timingSafeEqual } from './shared/crypto'
import { assertFederationAllowed, type SovereignTenantConfig, type ExclusionViolation } from './sovereign-exclusion'

/** Default invite lifetime (seconds) — 7 days (ADR-0062 §1). */
export const INVITE_DEFAULT_TTL = 7 * 24 * 3600
/** Maximum invite lifetime the mint path may grant (seconds) — 30 days. */
export const INVITE_MAX_TTL = 30 * 24 * 3600

/** The most a holder may do in the federated session; never widened downstream. */
export type FederationInviteScope = 'participate' | 'co_host'

export interface FederationInviteClaims {
  /** Envelope version. A wrong version is rejected, never coerced. */
  v: 1
  /** Unique invite id — the audit + (future) revocation handle. */
  jti: string
  /** The federated session this invite admits to. */
  sid: string
  /** Inviting tenant (team id). */
  host: string
  /** Targeted tenant id, or null for an open (link-shareable) invite. */
  invitee: string | null
  /** Scope granted. */
  scope: FederationInviteScope
  /** Issued-at (epoch seconds). */
  iat: number
  /** Expiry (epoch seconds). */
  exp: number
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const VALID_SCOPES: ReadonlySet<string> = new Set<FederationInviteScope>(['participate', 'co_host'])

// Structural schema for the decoded invite payload (HLT-031, issue #686). `v` and
// `scope` are validated as primitives here — not literals — so version/scope
// mismatches keep their distinct `wrong_version` / `bad_scope` reasons below.
const FederationInviteClaimsSchema = z.object({
  v: z.number(),
  jti: z.string(),
  sid: z.string(),
  host: z.string(),
  invitee: z.string().nullable(),
  scope: z.string(),
  iat: z.number(),
  exp: z.number(),
})

/** Clamp a requested TTL into [1, INVITE_MAX_TTL], defaulting when unset/invalid. */
export function clampInviteTtl(ttl: number | undefined): number {
  if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl <= 0) return INVITE_DEFAULT_TTL
  return Math.min(Math.floor(ttl), INVITE_MAX_TTL)
}

export interface MintInviteInput {
  /** Federated session id. */
  sid: string
  /** Targeted tenant id, or null/undefined for an open invite. */
  invitee?: string | null
  /** Scope granted (default 'participate'). */
  scope?: FederationInviteScope
  /** Lifetime in seconds; clamped to [1, INVITE_MAX_TTL]. */
  ttl?: number
  /** Override invite id — test seam. */
  jti?: string
  /** Override issued-at (epoch seconds) — test seam. */
  now?: number
}

export type MintInviteResult =
  | { ok: true; token: string; claims: FederationInviteClaims }
  | ExclusionViolation

/**
 * Mint a signed federation invite for `hostConfig` to admit a (possibly targeted)
 * tenant into a federated session. Refuses — with a typed violation, not a token —
 * when the host is a sovereign tenant (sovereign exclusion is absolute, ADR-0059).
 */
export async function mintFederationInvite(
  secret: string,
  hostConfig: SovereignTenantConfig,
  input: MintInviteInput,
): Promise<MintInviteResult> {
  const allowed = assertFederationAllowed(hostConfig)
  if (!allowed.ok) return allowed

  const iat = input.now ?? Math.floor(Date.now() / 1000)
  const claims: FederationInviteClaims = {
    v: 1,
    jti: input.jti ?? crypto.randomUUID(),
    sid: input.sid,
    host: hostConfig.teamId,
    invitee: input.invitee ?? null,
    scope: input.scope ?? 'participate',
    iat,
    exp: iat + clampInviteTtl(input.ttl),
  }
  const payload = base64UrlEncode(textEncoder.encode(JSON.stringify(claims)))
  const mac = await hmacSign(secret, payload)
  return { ok: true, token: `${payload}.${mac}`, claims }
}

export type InviteVerifyFailure =
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'wrong_version'
  | 'bad_scope'

export type InviteVerifyResult =
  | { ok: true; claims: FederationInviteClaims }
  | { ok: false; reason: InviteVerifyFailure }

/**
 * Verify an invite's signature, version, scope, and expiry. Does NOT check tenant
 * targeting — call `inviteAdmitsTenant` separately so the caller controls the 403
 * shape and can apply the sovereign re-check on the *invitee*.
 */
export async function verifyFederationInvite(
  secret: string,
  token: string,
  opts: { now?: number } = {},
): Promise<InviteVerifyResult> {
  if (typeof token !== 'string' || token.length === 0) return { ok: false, reason: 'malformed' }
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: 'malformed' }
  const payload = token.slice(0, dot)
  const mac = token.slice(dot + 1)

  // Re-sign and timing-safe compare. A tampered payload or MAC fails here.
  const expectedMac = await hmacSign(secret, payload)
  if (!timingSafeEqual(mac, expectedMac)) return { ok: false, reason: 'bad_signature' }

  let raw: unknown
  try {
    raw = JSON.parse(textDecoder.decode(base64UrlDecode(payload)))
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  // Validate the decoded payload's shape at the boundary instead of casting it
  // (HLT-031, #686). This subsumes the previous manual sid/host/exp/iat/invitee
  // type checks.
  const parsed = FederationInviteClaimsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: 'malformed' }
  if (parsed.data.v !== 1) return { ok: false, reason: 'wrong_version' }
  if (!VALID_SCOPES.has(parsed.data.scope)) return { ok: false, reason: 'bad_scope' }

  const now = opts.now ?? Math.floor(Date.now() / 1000)
  if (now >= parsed.data.exp) return { ok: false, reason: 'expired' }

  // v is proven 1 and scope proven a valid FederationInviteScope above.
  const claims: FederationInviteClaims = {
    ...parsed.data,
    v: 1,
    scope: parsed.data.scope as FederationInviteScope,
  }
  return { ok: true, claims }
}

/**
 * True iff this invite admits `teamId`: an open invite (`invitee === null`) admits
 * any tenant; a targeted invite admits only the named tenant. The sovereign
 * re-check on the invitee is the caller's responsibility (S96 join path).
 */
export function inviteAdmitsTenant(claims: FederationInviteClaims, teamId: string): boolean {
  if (claims.invitee === null) return true
  return claims.invitee === teamId
}
