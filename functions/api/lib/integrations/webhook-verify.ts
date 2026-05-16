/**
 * Webhook signature verification helpers.
 * Each service (Slack, Notion, Airtable) uses different signature schemes.
 */

/**
 * Generic HMAC-SHA256 signature verification.
 *
 * @param payload Raw request body
 * @param signature Signature from request header
 * @param secret Webhook secret
 * @returns True if signature is valid
 */
export async function verifyHMAC(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): Promise<boolean> {
  const key = new TextEncoder().encode(secret)
  const data = new TextEncoder().encode(payload)

  const hmac = await crypto.subtle.sign(
    algorithm === 'sha256' ? 'HMAC' : 'HMAC',
    await crypto.subtle.importKey('raw', key, { hash: algorithm === 'sha256' ? 'SHA-256' : 'SHA-1', name: 'HMAC' }, false, ['sign']),
    data
  )

  const computed = Array.from(new Uint8Array(hmac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return computed === signature.toLowerCase()
}

/**
 * Verify Slack webhook signature.
 *
 * Slack uses: HMAC-SHA256("v0:{timestamp}:{body}", secret)
 * Request header: X-Slack-Request-Timestamp (v0) + X-Slack-Signature
 *
 * @param req Incoming request
 * @param secret Slack webhook secret (starts with whsec_)
 * @returns True if signature is valid
 */
export async function verifySlackRequest(
  req: Request,
  secret: string
): Promise<boolean> {
  const timestamp = req.headers.get('X-Slack-Request-Timestamp')
  const signature = req.headers.get('X-Slack-Signature')

  if (!timestamp || !signature) {
    return false
  }

  // Verify timestamp is within 5 minutes (prevent replay attacks)
  const requestTime = parseInt(timestamp, 10) * 1000
  const now = Date.now()
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return false
  }

  // Clone body because it can only be read once
  const body = await req.clone().text()
  const baseString = `v0:${timestamp}:${body}`

  return await verifyHMAC(baseString, signature, secret, 'sha256')
}

/**
 * Verify Notion webhook signature.
 *
 * Notion uses: HMAC-SHA256(body, secret)
 * Request header: X-Notion-Signature
 *
 * @param req Incoming request
 * @param secret Notion webhook secret
 * @returns True if signature is valid
 */
export async function verifyNotionSignature(
  req: Request,
  secret: string
): Promise<boolean> {
  const signature = req.headers.get('X-Notion-Signature')
  if (!signature) {
    return false
  }

  const body = await req.clone().text()
  return await verifyHMAC(body, signature, secret, 'sha256')
}

/**
 * Verify Airtable webhook signature.
 *
 * Airtable uses: HMAC-SHA256(body, secret)
 * Request header: X-Airtable-Signature (base64 encoded)
 *
 * @param req Incoming request
 * @param secret Airtable webhook secret
 * @returns True if signature is valid
 */
export async function verifyAirtableSignature(
  req: Request,
  secret: string
): Promise<boolean> {
  const signature = req.headers.get('X-Airtable-Signature')
  if (!signature) {
    return false
  }

  const body = await req.clone().text()
  const key = new TextEncoder().encode(secret)
  const data = new TextEncoder().encode(body)

  const hmac = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey('raw', key, { hash: 'SHA-256', name: 'HMAC' }, false, ['sign']),
    data
  )

  const computed = btoa(String.fromCharCode(...new Uint8Array(hmac)))
  return computed === signature
}

/**
 * Verify webhook and parse JSON body.
 * Supports multiple services with a service identifier.
 *
 * @param req Incoming request
 * @param secret Webhook secret for the service
 * @param service Service name ('slack' | 'notion' | 'airtable')
 * @returns Parsed JSON body if signature is valid
 */
export async function verifyWebhookAndParse<T = unknown>(
  req: Request,
  secret: string,
  service: 'slack' | 'notion' | 'airtable'
): Promise<T> {
  let isValid = false

  switch (service) {
    case 'slack':
      isValid = await verifySlackRequest(req, secret)
      break
    case 'notion':
      isValid = await verifyNotionSignature(req, secret)
      break
    case 'airtable':
      isValid = await verifyAirtableSignature(req, secret)
      break
  }

  if (!isValid) {
    throw new Error(`Invalid ${service} webhook signature`)
  }

  return req.json<T>()
}
