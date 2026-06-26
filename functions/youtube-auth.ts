/**
 * One-time YouTube OAuth connect page — served by Cloudflare Pages at
 * /youtube-auth. Google OAuth2 with `access_type=offline` + `prompt=consent`
 * so a refresh token is issued on every connect (needed for the Publisher's
 * `videos.update` metadata push and the Mention Monitor's search).
 *
 * GET /youtube-auth                 → render "Connect YouTube" button
 * GET /youtube-auth?code=…&state=…  → exchange code, store encrypted token
 * GET /youtube-auth?error=…         → render Google error
 *
 * Bindings required on the Pages project (dashboard / pages config):
 *   INTEGRATIONS_KV, OAUTH_TOKEN_MEK, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET,
 *   YOUTUBE_REDIRECT_URI.
 */

import type { Env } from './api/types'
import { createEncryptedTokenStore } from './api/lib/integrations/token-store'
import { MARKETING_TEAM_SCOPE } from './api/lib/marketing/constants'
import { buildAuthorizeUrl, exchangeAuthorizationCode, oauthStateKey, YOUTUBE_SERVICE } from './api/lib/marketing/youtube'

function html(body: string, status = 200): Response {
  const doc = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Qesto · YouTube</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;line-height:1.5;color:#1a1a2e}
a.btn{display:inline-block;background:#ff0000;color:#fff;padding:.7rem 1.2rem;border-radius:6px;text-decoration:none;font-weight:600}
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

  if (!env.INTEGRATIONS_KV || !env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REDIRECT_URI) {
    return html(`<h1 class="err">Not configured</h1><p>Missing YouTube bindings/secrets on the Pages project: <code>INTEGRATIONS_KV</code>, <code>YOUTUBE_CLIENT_ID</code>, <code>YOUTUBE_CLIENT_SECRET</code>, <code>YOUTUBE_REDIRECT_URI</code>.</p>`, 500)
  }
  const kv = env.INTEGRATIONS_KV

  if (oauthError) {
    const desc = url.searchParams.get('error_description') ?? oauthError
    return html(`<h1 class="err">Google authorization failed</h1><p><code>${escapeHtml(desc)}</code></p><p><a class="btn" href="/youtube-auth">Try again</a></p>`, 400)
  }

  if (!code) {
    const nonce = randomNonce()
    await kv.put(oauthStateKey(nonce), '1', { expirationTtl: 600 })
    const authUrl = buildAuthorizeUrl(env.YOUTUBE_CLIENT_ID, env.YOUTUBE_REDIRECT_URI, nonce)
    return html(`<h1>Connect Qesto to YouTube</h1>
<p>This one-time step authorizes Qesto to push generated metadata onto already-uploaded videos and read mentions for the Mention Monitor.</p>
<p><a class="btn" href="${escapeHtml(authUrl)}">Connect YouTube</a></p>`)
  }

  if (!state || !(await kv.get(oauthStateKey(state)))) {
    return html(`<h1 class="err">Invalid or expired state</h1><p>Start again from <a href="/youtube-auth">/youtube-auth</a>.</p>`, 400)
  }
  await kv.delete(oauthStateKey(state))

  try {
    const token = await exchangeAuthorizationCode(
      {
        YOUTUBE_CLIENT_ID: env.YOUTUBE_CLIENT_ID,
        YOUTUBE_CLIENT_SECRET: env.YOUTUBE_CLIENT_SECRET,
        YOUTUBE_REDIRECT_URI: env.YOUTUBE_REDIRECT_URI,
      },
      code,
    )

    if (!token.refresh_token) {
      return html(`<h1 class="err">No refresh token returned</h1><p>Google only issues a refresh token on first consent (or with <code>prompt=consent</code>, which this flow already sets). Revoke Qesto's access at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">myaccount.google.com/permissions</a> and try again.</p><p><a class="btn" href="/youtube-auth">Try again</a></p>`, 502)
    }

    const store = createEncryptedTokenStore(kv, env)
    await store.storeToken(MARKETING_TEAM_SCOPE, YOUTUBE_SERVICE, token)

    return html(`<h1 class="ok">✓ Connected</h1>
<p>Qesto can now publish metadata to YouTube and read mentions. The Mention Monitor polls every 3 hours.</p>
<p>Access &amp; refresh tokens are stored encrypted. You can close this page.</p>`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return html(`<h1 class="err">Token exchange failed</h1><p><code>${escapeHtml(msg)}</code></p><p><a class="btn" href="/youtube-auth">Try again</a></p>`, 502)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
