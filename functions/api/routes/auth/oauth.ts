import { signJwt } from '../../lib/jwt'
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  buildMicrosoftAuthUrl,
  exchangeMicrosoftCode,
  generateOAuthState,
  consumeOAuthState,
} from '../../lib/oauth'
import { JWT_TTL_SECONDS } from './constants'
import { setAuthSessionCookie } from './cookie'
import { authRedirectSsoFailed } from './errors'
import { upsertOAuthUser } from './helpers'
import type { AuthApp } from './types'

export function registerOAuthRoutes(app: AuthApp): void {
  app.get('/google', async (c) => {
    try {
      if (!c.env.GOOGLE_CLIENT_ID) {
        return c.redirect(`${c.env.PAGES_URL}/login?error=provider_not_configured`, 302)
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

      if (error || !code || !state) return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
      if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
        return c.redirect(`${c.env.PAGES_URL}/login?error=provider_not_configured`, 302)
      }
      if (!(await consumeOAuthState(c.env.ACTIONS_KV, state))) {
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
      } catch {
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

  app.get('/microsoft', async (c) => {
    try {
      if (!c.env.MICROSOFT_CLIENT_ID) {
        return c.redirect(`${c.env.PAGES_URL}/login?error=provider_not_configured`, 302)
      }
      const state = await generateOAuthState(c.env.ACTIONS_KV)
      const redirectUri = `${c.env.API_URL}/api/auth/microsoft/callback`
      const tenantId = c.env.MICROSOFT_TENANT_ID ?? 'common'
      return c.redirect(buildMicrosoftAuthUrl(state, redirectUri, c.env.MICROSOFT_CLIENT_ID, tenantId), 302)
    } catch (err) {
      return authRedirectSsoFailed(c, err, '[auth] microsoft start')
    }
  })

  app.get('/microsoft/callback', async (c) => {
    try {
      const code = c.req.query('code')
      const state = c.req.query('state')
      const error = c.req.query('error')

      if (error || !code || !state) return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
      if (!c.env.MICROSOFT_CLIENT_ID || !c.env.MICROSOFT_CLIENT_SECRET) {
        return c.redirect(`${c.env.PAGES_URL}/login?error=provider_not_configured`, 302)
      }
      if (!(await consumeOAuthState(c.env.ACTIONS_KV, state))) {
        return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
      }

      let providerUser: { email: string; sub: string }
      try {
        const tenantId = c.env.MICROSOFT_TENANT_ID ?? 'common'
        providerUser = await exchangeMicrosoftCode(
          code,
          `${c.env.API_URL}/api/auth/microsoft/callback`,
          c.env.MICROSOFT_CLIENT_ID,
          c.env.MICROSOFT_CLIENT_SECRET,
          tenantId,
        )
      } catch {
        return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
      }

      const userId = await upsertOAuthUser(c.env.DB, c.env.USERS_KV, 'microsoft', providerUser.sub, providerUser.email)
      const jwt = await signJwt({ sub: userId, email: providerUser.email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
      setAuthSessionCookie(c, jwt)
      return c.redirect(`${c.env.PAGES_URL}/`, 302)
    } catch (err) {
      return authRedirectSsoFailed(c, err, '[auth] microsoft/callback')
    }
  })
}
