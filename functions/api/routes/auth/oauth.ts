import { signJwt } from '../../lib/jwt'
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  generateOAuthState,
  consumeOAuthState,
} from '../../lib/oauth'
import { JWT_TTL_SECONDS } from './constants'
import { setAuthSessionCookie } from './cookie'
import { authRedirectSsoFailed } from './errors'
import { upsertOAuthUser } from './helpers'
import type { AuthApp } from './types'

function redirectProviderNotConfigured(
  c: {
    env: { PAGES_URL: string; API_URL: string }
    redirect: (location: string, status?: 301 | 302 | 303 | 307 | 308) => Response
  },
  provider: 'google',
  missing: string[],
): Response {
  console.error('[auth] oauth provider_not_configured', {
    provider,
    missing,
    pagesUrl: c.env.PAGES_URL,
    apiUrl: c.env.API_URL,
  })
  return c.redirect(`${c.env.PAGES_URL}/login?error=provider_not_configured`, 302)
}

export function registerOAuthRoutes(app: AuthApp): void {
  app.get('/google', async (c) => {
    try {
      if (!c.env.GOOGLE_CLIENT_ID) {
        return redirectProviderNotConfigured(c, 'google', ['GOOGLE_CLIENT_ID'])
      }
      const state = await generateOAuthState(c.env.ACTIONS_KV)
      const redirectUri = `${c.env.API_URL}/api/auth/google/callback`
      return c.redirect(buildGoogleAuthUrl(state, redirectUri, c.env.GOOGLE_CLIENT_ID), 302)
    } catch (err) {
      return authRedirectSsoFailed(c, err, '[auth] google start')
    }
  })

  app.get('/google/callback', async (c) => {
    try {
      const code = c.req.query('code')
      const state = c.req.query('state')
      const error = c.req.query('error')

      if (error || !code || !state) {
        console.error('[auth] google callback missing params or provider error', {
          hasError: Boolean(error),
          hasCode: Boolean(code),
          hasState: Boolean(state),
        })
        return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
      }
      if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
        const missing = [
          ...(c.env.GOOGLE_CLIENT_ID ? [] : ['GOOGLE_CLIENT_ID']),
          ...(c.env.GOOGLE_CLIENT_SECRET ? [] : ['GOOGLE_CLIENT_SECRET']),
        ]
        return redirectProviderNotConfigured(c, 'google', missing)
      }
      if (!(await consumeOAuthState(c.env.ACTIONS_KV, state))) {
        console.error('[auth] google callback oauth state invalid', { statePrefix: state.slice(0, 8) })
        return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
      }

      let providerUser: { email: string; sub: string }
      try {
        providerUser = await exchangeGoogleCode(
          code,
          `${c.env.API_URL}/api/auth/google/callback`,
          c.env.GOOGLE_CLIENT_ID,
          c.env.GOOGLE_CLIENT_SECRET,
        )
      } catch (err) {
        console.error('[auth] google callback token exchange failed', err)
        return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
      }

      const userId = await upsertOAuthUser(c.env.DB, c.env.USERS_KV, 'google', providerUser.sub, providerUser.email)
      const jwt = await signJwt({ sub: userId, email: providerUser.email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
      setAuthSessionCookie(c, jwt)
      return c.redirect(`${c.env.PAGES_URL}/`, 302)
    } catch (err) {
      return authRedirectSsoFailed(c, err, '[auth] google/callback')
    }
  })

}
