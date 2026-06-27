/**
 * One-time Reddit OAuth connect page — served by Cloudflare Pages at
 * /reddit-auth. Web-app OAuth2 (confidential client, real refresh tokens) so
 * the daily proactive-refresh cron can keep the connection alive indefinitely.
 *
 * GET /reddit-auth                 → render "Connect Reddit" button
 * GET /reddit-auth?code=…&state=…  → exchange code, store encrypted token
 * GET /reddit-auth?error=…         → render Reddit error
 *
 * Bindings required on the Pages project (dashboard / pages config):
 *   INTEGRATIONS_KV, OAUTH_TOKEN_MEK, REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET,
 *   REDDIT_REDIRECT_URI.
 */

import type { Env } from './api/types'
import { createEncryptedTokenStore } from './api/lib/integrations/token-store'
import { MARKETING_TEAM_SCOPE } from './api/lib/marketing/constants'
import { buildAuthorizeUrl, exchangeAuthorizationCode, oauthStateKey, REDDIT_SERVICE } from './api/lib/marketing/reddit'

function html(body: string, status = 200): Response {
  const doc = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Qesto · Reddit</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;line-height:1.5;color:#1a1a2e}
a.btn{display:inline-block;background:#ff4500;color:#fff;padding:.7rem 1.2rem;border-radius:6px;text-decoration:none;font-weight:600}
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

  if (!env.INTEGRATIONS_KV || !env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET || !env.REDDIT_REDIRECT_URI) {
    return html(`<h1 class="err">Not configured</h1><p>Missing Reddit bindings/secrets on the Pages project: <code>INTEGRATIONS_KV</code>, <code>REDDIT_CLIENT_ID</code>, <code>REDDIT_CLIENT_SECRET</code>, <code>REDDIT_REDIRECT_URI</code>.</p>`, 500)
  }
  const kv = env.INTEGRATIONS_KV

  if (oauthError) {
    const desc = url.searchParams.get('error_description') ?? oauthError
    return html(`<h1 class="err">Reddit authorization failed</h1><p><code>${escapeHtml(desc)}</code></p><p><a class="btn" href="/reddit-auth">Try again</a></p>`, 400)
  }

  if (!code) {
    const nonce = randomNonce()
    await kv.put(oauthStateKey(nonce), '1', { expirationTtl: 600 })
    const authUrl = buildAuthorizeUrl(env.REDDIT_CLIENT_ID, env.REDDIT_REDIRECT_URI, nonce)
    return html(`<h1>Connect Qesto to Reddit</h1>
<p>This one-time step authorizes Qesto to read mentions for the Mention Monitor. The Reddit app is registered as "web app" so the refresh token never expires (re-run only if revoked).</p>
<p><a class="btn" href="${escapeHtml(authUrl)}">Connect Reddit</a></p>`)
  }

  if (!state || !(await kv.get(oauthStateKey(state)))) {
    return html(`<h1 class="err">Invalid or expired state</h1><p>Start again from <a href="/reddit-auth">/reddit-auth</a>.</p>`, 400)
  }
  await kv.delete(oauthStateKey(state))

  try {
    const token = await exchangeAuthorizationCode(
      {
        REDDIT_CLIENT_ID: env.REDDIT_CLIENT_ID,
        REDDIT_CLIENT_SECRET: env.REDDIT_CLIENT_SECRET,
        REDDIT_REDIRECT_URI: env.REDDIT_REDIRECT_URI,
      },
      code,
    )

    const store = createEncryptedTokenStore(kv, env)
    await store.storeToken(MARKETING_TEAM_SCOPE, REDDIT_SERVICE, token)

    return html(`<h1 class="ok">✓ Connected</h1>
<p>Qesto can now read Reddit mentions. The Mention Monitor polls every 3 hours.</p>
<p>Access &amp; refresh tokens are stored encrypted. You can close this page.</p>`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return html(`<h1 class="err">Token exchange failed</h1><p><code>${escapeHtml(msg)}</code></p><p><a class="btn" href="/reddit-auth">Try again</a></p>`, 502)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
