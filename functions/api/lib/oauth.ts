// OAuth 2.0 helpers for Google and Microsoft.
// No third-party deps — uses fetch + WebCrypto.
// State tokens are stored in ACTIONS_KV with a 10-minute TTL.

const STATE_TTL_SECONDS = 10 * 60

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
  const tokens = (await tokenRes.json()) as { access_token: string }

  const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  })
  if (!infoRes.ok) throw new Error(`Google userinfo failed: ${infoRes.status}`)
  const info = (await infoRes.json()) as { email: string; sub: string }
  if (!info.email || !info.sub) throw new Error('Google userinfo missing email or sub')
  return { email: info.email, sub: info.sub }
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

  // Decode payload from the id_token JWT (no signature verification needed here —
  // the code exchange itself authenticates the response).
  const payload = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(
        atob(tokens.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      ),
    ),
  ) as { email?: string; preferred_username?: string; oid: string }

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
