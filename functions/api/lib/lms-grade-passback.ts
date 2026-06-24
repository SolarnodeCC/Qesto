/**
 * LEARN-GRADE-01 (ADR-0058) — LMS grade passback (LTI Basic Outcomes 1.1).
 *
 * After an assessment session closes, the scored result (0..1) is pushed back to
 * the LMS gradebook via a POX `replaceResultRequest` POSTed to the LMS-provided
 * `lis_outcome_service_url`, authenticated with OAuth 1.0a **body-hash** signing
 * (`oauth_body_hash = base64(sha1(body))`). Reuses the OAuth primitives from
 * `lti.ts` so consumer-key/secret handling is identical to the inbound launch.
 *
 * Every passback is audit-logged by the caller (route). The XML/body-hash/header
 * builders are pure and unit-tested; only the network POST is impure.
 */
import { oauthPercentEncode, signHmacSha1, buildSignatureBaseString } from './lti'
import { validateWebhookTargetUrl } from './webhook-url'

/** Score fraction (0..1) → fixed 4-decimal string the LMS Outcomes API expects. */
export function formatResultScore(fraction: number): string {
  const clamped = !Number.isFinite(fraction) ? 0 : fraction < 0 ? 0 : fraction > 1 ? 1 : fraction
  return clamped.toFixed(4)
}

/** XML-escape a value destined for a POX text node / attribute. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type GradePassbackRequest = {
  /** LMS outcome service endpoint from the original launch (`lis_outcome_service_url`). */
  outcomeServiceUrl: string
  /** Opaque per-student result token from the launch (`lis_result_sourcedid`). */
  resultSourcedId: string
  /** Normalised score fraction 0..1. */
  scoreFraction: number
  /** Stable message id (idempotency for the LMS). */
  messageId: string
}

/** Build the POX `replaceResultRequest` envelope. */
export function buildReplaceResultXml(req: GradePassbackRequest): string {
  const score = formatResultScore(req.scoreFraction)
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">` +
    `<imsx_POXHeader><imsx_POXRequestHeaderInfo>` +
    `<imsx_version>V1.0</imsx_version>` +
    `<imsx_messageIdentifier>${escapeXml(req.messageId)}</imsx_messageIdentifier>` +
    `</imsx_POXRequestHeaderInfo></imsx_POXHeader>` +
    `<imsx_POXBody><replaceResultRequest><resultRecord>` +
    `<sourcedGUID><sourcedId>${escapeXml(req.resultSourcedId)}</sourcedId></sourcedGUID>` +
    `<result><resultScore><language>en</language>` +
    `<textString>${score}</textString>` +
    `</resultScore></result>` +
    `</resultRecord></replaceResultRequest></imsx_POXBody>` +
    `</imsx_POXEnvelopeRequest>`
  )
}

/** `oauth_body_hash = base64(sha1(body))` — binds the signature to the POX body. */
export async function computeBodyHash(body: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(body))
  let binary = ''
  const bytes = new Uint8Array(digest)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export type OAuthHeaderParams = {
  oauth_consumer_key: string
  oauth_signature_method: 'HMAC-SHA1'
  oauth_timestamp: string
  oauth_nonce: string
  oauth_version: '1.0'
  oauth_body_hash: string
  oauth_signature: string
}

/** Serialise OAuth params into an `Authorization: OAuth ...` header value. */
export function buildAuthorizationHeader(params: OAuthHeaderParams): string {
  const parts = Object.entries(params)
    .map(([k, v]) => `${oauthPercentEncode(k)}="${oauthPercentEncode(v)}"`)
    .join(',')
  return `OAuth ${parts}`
}

/**
 * Build the signed Authorization header for a body-hash POST. `nowSeconds` and
 * `nonce` are injectable for deterministic tests.
 */
export async function buildSignedOutcomeRequest(args: {
  url: string
  body: string
  consumerKey: string
  consumerSecret: string
  nowSeconds?: number
  nonce?: string
}): Promise<{ header: string; bodyHash: string }> {
  const bodyHash = await computeBodyHash(args.body)
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: args.consumerKey,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(args.nowSeconds ?? Math.floor(Date.now() / 1000)),
    oauth_nonce: args.nonce ?? crypto.randomUUID(),
    oauth_version: '1.0',
    oauth_body_hash: bodyHash,
  }
  const base = buildSignatureBaseString('POST', args.url, oauthParams)
  const signature = await signHmacSha1(base, args.consumerSecret)
  const header = buildAuthorizationHeader({
    oauth_consumer_key: oauthParams.oauth_consumer_key,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: oauthParams.oauth_timestamp,
    oauth_nonce: oauthParams.oauth_nonce,
    oauth_version: '1.0',
    oauth_body_hash: bodyHash,
    oauth_signature: signature,
  })
  return { header, bodyHash }
}

export type GradePassbackResult =
  | { ok: true; status: number }
  | { ok: false; reason: string; status?: number }

/** A POX response is a success iff it carries an `imsx_codeMajor` of `success`. */
export function parseOutcomeResponse(xml: string): boolean {
  const match = xml.match(/<imsx_codeMajor>\s*([a-zA-Z]+)\s*<\/imsx_codeMajor>/)
  return match?.[1]?.toLowerCase() === 'success'
}

/**
 * Push one score to the LMS. Network failures and non-success POX codes return a
 * typed failure (caller audits + may retry); never throws.
 */
export async function pushGradeToLms(
  req: GradePassbackRequest,
  creds: { consumerKey: string; consumerSecret: string },
  fetchImpl: typeof fetch = fetch,
): Promise<GradePassbackResult> {
  // SSRF guard (#587): the outcome URL originates from an LMS launch. Even though
  // the route now uses the STORED (signed) URL, validate it here as
  // defence-in-depth — reject private/loopback targets and non-HTTPS schemes.
  const urlCheck = validateWebhookTargetUrl(req.outcomeServiceUrl)
  if (!urlCheck.ok) {
    return { ok: false, reason: `ssrf_blocked:${urlCheck.code}` }
  }

  const body = buildReplaceResultXml(req)
  let header: string
  try {
    ;({ header } = await buildSignedOutcomeRequest({
      url: req.outcomeServiceUrl,
      body,
      consumerKey: creds.consumerKey,
      consumerSecret: creds.consumerSecret,
    }))
  } catch {
    return { ok: false, reason: 'signing_failed' }
  }

  let res: Response
  try {
    res = await fetchImpl(req.outcomeServiceUrl, {
      method: 'POST',
      // #587: never follow redirects — a 30x could bounce the signed POST to an
      // internal/private endpoint (SSRF) the launch URL did not authorise.
      redirect: 'manual',
      headers: { 'Content-Type': 'application/xml', Authorization: header },
      body,
    })
  } catch {
    return { ok: false, reason: 'network_error' }
  }

  // A redirect response is treated as a failure (manual mode surfaces it).
  if (res.status >= 300 && res.status < 400) {
    return { ok: false, reason: 'unexpected_redirect', status: res.status }
  }

  if (!res.ok) return { ok: false, reason: 'lms_http_error', status: res.status }
  const text = await res.text().catch(() => '')
  if (!parseOutcomeResponse(text)) return { ok: false, reason: 'lms_rejected', status: res.status }
  return { ok: true, status: res.status }
}
