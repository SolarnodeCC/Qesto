/**
 * One-time LinkedIn OAuth connect page — served by Cloudflare Pages at
 * /linkedin-auth (more-specific function file takes precedence over the
 * [[path]].ts catch-all). Run once to connect the Qesto company page; re-run
 * only when the 365-day refresh token expires.
 *
 * GET /linkedin-auth                 → render "Connect LinkedIn" button
 * GET /linkedin-auth?code=…&state=…  → exchange code, store encrypted token + URNs
 * GET /linkedin-auth?error=…         → render LinkedIn error
 *
 * Bindings required on the Pages project (dashboard / pages config):
 *   LINKEDIN_KV, OAUTH_TOKEN_MEK, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET,
 *   LINKEDIN_REDIRECT_URI, (optional) LINKEDIN_ORG_URN.
 */

import type { Env } from './api/types'
import { createEncryptedTokenStore } from './api/lib/integrations/token-store'
import {
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  fetchOrgUrn,
  fetchPersonUrn,
  oauthStateKey,
  KV_ORG_URN,
  KV_PERSON_URN,
  LINKEDIN_TEAM_SCOPE,
  LINKEDIN_SERVICE,
} from './api/lib/linkedin'

function html(body: string, status = 200): Response {
  const doc = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Qesto · LinkedIn</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;line-height:1.5;color:#1a1a2e}
a.btn{display:inline-block;background:#0a66c2;color:#fff;padding:.7rem 1.2rem;border-radius:6px;text-decoration:none;font-weight:600}
code{background:#f0f0f5;padding:.1rem .3rem;border-radius:4px}.ok{color:#0a7d2c}.err{color:#c0152f}</style>
</head><body>${body}</body></html>`
  return new Response(doc, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (!env.LINKEDIN_KV || !env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET || !env.LINKEDIN_REDIRECT_URI) {
    return html(`<h1 class="err">Not configured</h1><p>Missing LinkedIn bindings/secrets on the Pages project: <code>LINKEDIN_KV</code>, <code>LINKEDIN_CLIENT_ID</code>, <code>LINKEDIN_CLIENT_SECRET</code>, <code>LINKEDIN_REDIRECT_URI</code>.</p>`, 500)
  }
  const kv = env.LINKEDIN_KV

  // LinkedIn redirected back with an error.
  if (oauthError) {
    const desc = url.searchParams.get('error_description') ?? oauthError
    return html(`<h1 class="err">LinkedIn authorization failed</h1><p><code>${escapeHtml(desc)}</code></p><p><a class="btn" href="/linkedin-auth">Try again</a></p>`, 400)
  }

  // Step 1: no code → start the flow.
  if (!code) {
    const nonce = randomNonce()
    await kv.put(oauthStateKey(nonce), '1', { expirationTtl: 600 })
    const authUrl = buildAuthorizeUrl(env.LINKEDIN_CLIENT_ID, env.LINKEDIN_REDIRECT_URI, nonce)
    return html(`<h1>Connect Qesto to LinkedIn</h1>
<p>This one-time step authorizes Qesto to publish posts to the company page. Run again only when the token expires (~365 days).</p>
<p><a class="btn" href="${escapeHtml(authUrl)}">Connect LinkedIn</a></p>`)
  }

  // Step 2: callback with code → validate state, exchange, store.
  if (!state || !(await kv.get(oauthStateKey(state)))) {
    return html(`<h1 class="err">Invalid or expired state</h1><p>Start again from <a href="/linkedin-auth">/linkedin-auth</a>.</p>`, 400)
  }
  await kv.delete(oauthStateKey(state))

  try {
    const token = await exchangeAuthorizationCode(
      {
        LINKEDIN_CLIENT_ID: env.LINKEDIN_CLIENT_ID,
        LINKEDIN_CLIENT_SECRET: env.LINKEDIN_CLIENT_SECRET,
        LINKEDIN_REDIRECT_URI: env.LINKEDIN_REDIRECT_URI,
      },
      code,
    )

    const store = createEncryptedTokenStore(kv, env)
    await store.storeToken(LINKEDIN_TEAM_SCOPE, LINKEDIN_SERVICE, token)

    const personUrn = await fetchPersonUrn(token.access_token)
    if (personUrn) await kv.put(KV_PERSON_URN, personUrn)

    let orgUrn = await fetchOrgUrn(token.access_token)
    if (!orgUrn && env.LINKEDIN_ORG_URN) orgUrn = env.LINKEDIN_ORG_URN
    if (orgUrn) await kv.put(KV_ORG_URN, orgUrn)

    return html(`<h1 class="ok">✓ Connected</h1>
<p>Qesto can now publish to LinkedIn. The scheduler posts Tue &amp; Thu at 09:00 UTC.</p>
<ul>
<li>Person URN: <code>${personUrn ? escapeHtml(personUrn) : '—'}</code></li>
<li>Org URN: <code>${orgUrn ? escapeHtml(orgUrn) : 'not set — write <code>linkedin:org_urn</code> in LINKEDIN_KV manually'}</code></li>
</ul>
<p>Access &amp; refresh tokens are stored encrypted. You can close this page.</p>`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return html(`<h1 class="err">Token exchange failed</h1><p><code>${escapeHtml(msg)}</code></p><p><a class="btn" href="/linkedin-auth">Try again</a></p>`, 502)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
