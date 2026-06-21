/**
 * LEARN-LTI-01 (ADR-0058) — LTI v1.1 consumer launch verification.
 *
 * LMS platforms (Canvas / Blackboard / Moodle) POST a form-encoded
 * `basic-lti-launch-request` signed with OAuth 1.0a (HMAC-SHA1, no token secret).
 * We re-derive the signature from the launch params and constant-time compare it.
 * Pure helpers (base-string + course-context extraction) are unit-tested; the
 * crypto step uses Web Crypto (`HMAC` / `SHA-1`), available on Workers.
 */

export const LTI_MESSAGE_TYPE = 'basic-lti-launch-request'
export const LTI_VERSION = 'LTI-1p0'

/** Replay/skew window — launches older than this are rejected (OAuth timestamp). */
export const LTI_TIMESTAMP_SKEW_SECONDS = 5 * 60

export type LtiLaunchContext = {
  resourceLinkId: string
  contextId: string | null
  contextTitle: string | null
  consumerKey: string
  userId: string | null
  roles: string[]
  /** Best-effort display name from LMS (may be absent under privacy settings). */
  personName: string | null
  /**
   * LMS-provided grade-passback endpoint + opaque result token. These are the
   * ONLY trustworthy source for grade passback (#587): they are signed as part
   * of the launch. The grade-passback route must use the STORED values, never
   * attacker-supplied body values.
   */
  outcomeServiceUrl: string | null
  resultSourcedId: string | null
}

/**
 * Pluggable nonce store for OAuth replay protection (#587). `seen` must atomically
 * report whether the (consumerKey, nonce) pair was already used and, if not,
 * record it. Implementations back this with KV (TTL = skew window).
 */
export type LtiNonceStore = {
  seen(consumerKey: string, nonce: string): Promise<boolean>
}

export type LtiVerifyResult =
  | { valid: true; context: LtiLaunchContext }
  | { valid: false; reason: string }

/** RFC-3986 strict percent-encoding (OAuth requires `!*'()` escaped, unlike encodeURIComponent). */
export function oauthPercentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )
}

/**
 * OAuth 1.0a signature base string:
 *   METHOD & enc(url) & enc(sorted "k=v" params joined by "&")
 * The `oauth_signature` param is excluded; everything else (oauth_* + body) is
 * sorted by encoded key then encoded value.
 */
export function buildSignatureBaseString(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  const pairs = Object.entries(params)
    .filter(([k]) => k !== 'oauth_signature')
    .map(([k, v]) => [oauthPercentEncode(k), oauthPercentEncode(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return [method.toUpperCase(), oauthPercentEncode(url), oauthPercentEncode(pairs)].join('&')
}

/** HMAC-SHA1 base64 signature (OAuth signing key is `enc(secret)&` — no token secret for LTI 1.1). */
export async function signHmacSha1(baseString: string, consumerSecret: string): Promise<string> {
  const keyMaterial = `${oauthPercentEncode(consumerSecret)}&`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyMaterial),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(baseString))
  let binary = ''
  const bytes = new Uint8Array(sig)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** Constant-time string compare — avoids leaking signature bytes via timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function extractLaunchContext(params: Record<string, string>): LtiLaunchContext {
  const roles = (params['roles'] ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
  return {
    resourceLinkId: params['resource_link_id'] ?? '',
    contextId: params['context_id'] ?? null,
    contextTitle: params['context_title'] ?? null,
    consumerKey: params['oauth_consumer_key'] ?? '',
    userId: params['user_id'] ?? null,
    roles,
    personName: params['lis_person_name_full'] ?? null,
    outcomeServiceUrl: params['lis_outcome_service_url'] ?? null,
    resultSourcedId: params['lis_result_sourcedid'] ?? null,
  }
}

/** True when any LMS role conveys instructor/admin authority (grade passback). */
export function isInstructorRole(roles: string[]): boolean {
  return roles.some((r) => {
    const lower = r.toLowerCase()
    return (
      lower.includes('instructor') ||
      lower.includes('administrator') ||
      lower.includes('contentdeveloper') ||
      lower.includes('teachingassistant') ||
      lower.includes('mentor')
    )
  })
}

/**
 * Verify a launch. `nowSeconds` is injectable for deterministic tests. The caller
 * resolves `consumerSecret` from the stored consumer-key registration before calling.
 */
export async function verifyLtiLaunch(args: {
  method: string
  url: string
  params: Record<string, string>
  consumerSecret: string
  nowSeconds?: number
  /** Optional replay-protection store (#587). When provided, a reused nonce is rejected. */
  nonceStore?: LtiNonceStore
}): Promise<LtiVerifyResult> {
  const { method, url, params, consumerSecret, nonceStore } = args
  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000)

  if (params['lti_message_type'] !== LTI_MESSAGE_TYPE) {
    return { valid: false, reason: 'unsupported_message_type' }
  }
  if (params['lti_version'] !== LTI_VERSION) {
    return { valid: false, reason: 'unsupported_lti_version' }
  }
  if (!params['resource_link_id']) {
    return { valid: false, reason: 'missing_resource_link_id' }
  }
  if (params['oauth_signature_method'] !== 'HMAC-SHA1') {
    return { valid: false, reason: 'unsupported_signature_method' }
  }
  const provided = params['oauth_signature']
  if (!provided) return { valid: false, reason: 'missing_signature' }
  if (!params['oauth_consumer_key']) return { valid: false, reason: 'missing_consumer_key' }

  const ts = Number(params['oauth_timestamp'])
  if (!Number.isFinite(ts) || Math.abs(now - ts) > LTI_TIMESTAMP_SKEW_SECONDS) {
    return { valid: false, reason: 'timestamp_out_of_window' }
  }
  if (!params['oauth_nonce']) return { valid: false, reason: 'missing_nonce' }

  const baseString = buildSignatureBaseString(method, url, params)
  const expected = await signHmacSha1(baseString, consumerSecret)
  if (!timingSafeEqual(provided, expected)) {
    return { valid: false, reason: 'invalid_signature' }
  }

  // Replay protection (#587): a valid signature for a nonce we've already seen is
  // a replayed launch. Check AFTER signature verification so attackers cannot burn
  // a victim's nonce with forged requests. The store records the nonce atomically.
  if (nonceStore) {
    const alreadySeen = await nonceStore.seen(params['oauth_consumer_key'], params['oauth_nonce'])
    if (alreadySeen) {
      return { valid: false, reason: 'nonce_replayed' }
    }
  }

  return { valid: true, context: extractLaunchContext(params) }
}
