// OAuth 2.0 helpers for Google and Microsoft.
// No third-party deps — uses fetch + WebCrypto.
// State tokens are stored in ACTIONS_KV with a 10-minute TTL.

const STATE_TTL_SECONDS = 10 * 60
const DEFAULT_JWKS_TTL_MS = 5 * 60 * 1000
const jwksCache = new Map<string, { keys: JsonWebKey[]; expiresAt: number }>()

export function buildGoogleAuthUrl(state: string, redirectUri: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<{ email: string; sub: string }> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${tokenRes.status}`)
  const tokens = (await tokenRes.json()) as { id_token?: string }
  if (!tokens.id_token) throw new Error('Google token response missing id_token')

  const payload = await verifyJwtWithJwks(tokens.id_token, {
    audience: clientId,
    issuer: (iss) => iss === 'https://accounts.google.com' || iss === 'accounts.google.com',
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  }) as { email?: string; sub?: string; email_verified?: boolean }

  if (!payload.email || !payload.sub) throw new Error('Google id_token missing email or sub')
  if (payload.email_verified === false) throw new Error('Google id_token email not verified')
  return { email: payload.email, sub: payload.sub }
}

export function buildMicrosoftAuthUrl(
  state: string,
  redirectUri: string,
  clientId: string,
  tenantId = 'common',
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`
}

export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  tenantId = 'common',
): Promise<{ email: string; sub: string }> {
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    },
  )
  if (!tokenRes.ok) throw new Error(`Microsoft token exchange failed: ${tokenRes.status}`)
  const tokens = (await tokenRes.json()) as { id_token: string }
  if (!tokens.id_token) throw new Error('Microsoft token response missing id_token')

  const payload = await verifyJwtWithJwks(tokens.id_token, {
    audience: clientId,
    issuer: (iss) => iss.startsWith('https://login.microsoftonline.com/') && iss.endsWith('/v2.0'),
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  }) as {
    aud?: string
    email?: string
    preferred_username?: string
    oid?: string
  }

  const email = payload.email ?? payload.preferred_username
  if (!email || !payload.oid) throw new Error('Microsoft id_token missing email or oid')
  return { email, sub: payload.oid }
}

export async function generateOAuthState(kv: KVNamespace): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  await kv.put(`oauth:state:${state}`, '1', { expirationTtl: STATE_TTL_SECONDS })
  return state
}

export async function consumeOAuthState(kv: KVNamespace, state: string): Promise<boolean> {
  const val = await kv.get(`oauth:state:${state}`)
  if (!val) return false
  await kv.delete(`oauth:state:${state}`)
  return true
}

type JwtHeader = {
  alg?: string
  kid?: string
}

async function verifyJwtWithJwks(
  token: string,
  opts: {
    audience: string
    issuer: ((iss: string) => boolean) | string
    jwksUri: string
  },
): Promise<Record<string, unknown>> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')
  const [headerB64, payloadB64, sigB64] = parts

  const header = decodePart<JwtHeader>(headerB64)
  if (header.alg !== 'RS256') throw new Error(`Unsupported JWT alg: ${header.alg ?? 'unknown'}`)
  if (!header.kid) throw new Error('JWT header missing kid')

  const payload = decodePart<Record<string, unknown>>(payloadB64)
  const aud = payload.aud
  const exp = payload.exp
  const iss = payload.iss

  const audienceValid = typeof aud === 'string'
    ? aud === opts.audience
    : Array.isArray(aud) && aud.includes(opts.audience)
  if (!audienceValid) throw new Error('JWT audience mismatch')

  if (typeof exp !== 'number' || exp * 1000 < Date.now()) throw new Error('JWT expired')
  if (typeof iss !== 'string') throw new Error('JWT issuer missing')
  if (typeof opts.issuer === 'string') {
    if (iss !== opts.issuer) throw new Error('JWT issuer mismatch')
  } else if (!opts.issuer(iss)) {
    throw new Error('JWT issuer mismatch')
  }

  const keys = await getJwks(opts.jwksUri)
  const jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid)
  if (!jwk) throw new Error('No matching JWK key')
  if (jwk.kty !== 'RSA') throw new Error(`Unsupported JWK kty: ${String(jwk.kty)}`)

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const sig = base64UrlToBytes(sigB64)
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    sig as unknown as BufferSource,
    data as unknown as BufferSource,
  )
  if (!valid) throw new Error('Invalid JWT signature')

  return payload
}

async function getJwks(uri: string): Promise<JsonWebKey[]> {
  const cached = jwksCache.get(uri)
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.keys

  const res = await fetch(uri, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`)
  const data = (await res.json()) as { keys?: JsonWebKey[] }
  if (!Array.isArray(data.keys) || data.keys.length === 0) throw new Error('JWKS response missing keys')

  const cacheControl = res.headers.get('cache-control') ?? ''
  const maxAgeSec = cacheControl.match(/max-age=(\d+)/)?.[1]
  const ttl = maxAgeSec ? Number(maxAgeSec) * 1000 : DEFAULT_JWKS_TTL_MS
  jwksCache.set(uri, { keys: data.keys, expiresAt: now + ttl })
  return data.keys
}

function decodePart<T>(part: string): T {
  return JSON.parse(bytesToString(base64UrlToBytes(part))) as T
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}
