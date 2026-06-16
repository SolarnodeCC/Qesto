import { ulid } from '../../lib/ulid'
import { signJwt } from '../../lib/jwt'
import {
  buildAuthnRequest,
  buildSpMetadata,
  consumeSamlState,
  generateSamlState,
  parseAssertion,
} from '../../lib/saml'
import { attachUserToTeam, loadTeam } from '../teams'
import { JWT_TTL_SECONDS } from './constants'
import { setAuthSessionCookie } from './cookie'
import { authRedirectSamlFailed } from './errors'
import type { Context } from 'hono'
import type { Env } from '../../types'
import type { AuthApp, AuthVars } from './types'
import { safeLogContext } from '../../lib/log'
import { recordAuthAuditEvent } from '../../lib/audit'
import { flagOff } from '../../lib/flags'

/**
 * SEC-SAML-01 (#529): hard kill-switch for the SAML SP.
 *
 * The SP parses assertions but does NOT yet verify the XML-DSig signature, so
 * an attacker who knows the entityID + a target team_id could forge an unsigned
 * SAMLResponse and authenticate as any user. Until signature verification ships
 * the routes MUST be disabled in production. The flag defaults OFF: SAML is only
 * served when `SAML_SSO_ENABLED === 'true'` is explicitly set for an env.
 */
function samlDisabled(c: Context<{ Bindings: Env; Variables: AuthVars }>): Response | null {
  if (flagOff(c.env, 'SAML_SSO_ENABLED')) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'saml_disabled', message: 'SAML SSO is not available' },
        trace_id: c.get('trace_id') ?? 'unknown',
      }),
      {
        status: 503,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'retry-after': '3600',
          'x-trace-id': c.get('trace_id') ?? 'unknown',
        },
      },
    )
  }
  return null
}

export function registerSamlRoutes(app: AuthApp): void {
  app.get('/saml/metadata', (c) => {
    const disabled = samlDisabled(c)
    if (disabled) return disabled
    try {
      const entityId = c.env.SAML_SP_ENTITY_ID ?? `${c.env.API_URL}`
      const acsUrl = c.env.SAML_ACS_URL ?? `${c.env.API_URL}/api/auth/saml/callback`
      const xml = buildSpMetadata(entityId, acsUrl)
      return new Response(xml, {
        status: 200,
        headers: {
          'content-type': 'application/samlmetadata+xml; charset=utf-8',
          'x-trace-id': c.get('trace_id'),
        },
      })
    } catch (err) {
      safeLogContext(err, { traceId: c.get('trace_id') ?? 'unknown', route: '[auth] saml/metadata', errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 503 })
      return new Response('Service unavailable', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }
  })

  app.get('/saml/init', async (c) => {
    const disabled = samlDisabled(c)
    if (disabled) return disabled
    try {
      const teamId = c.req.query('team_id')
      if (!teamId) {
        return c.redirect(`${c.env.PAGES_URL}/login?error=saml_team_required`, 302)
      }
      const team = await loadTeam(c.env.TEAMS_KV, teamId)
      if (!team || !team.samlConfig) {
        return c.redirect(`${c.env.PAGES_URL}/login?error=saml_not_configured`, 302)
      }

      const entityId = c.env.SAML_SP_ENTITY_ID ?? `${c.env.API_URL}`
      const acsUrl = c.env.SAML_ACS_URL ?? `${c.env.API_URL}/api/auth/saml/callback`
      const idpSsoUrl = team.samlConfig.idpSsoUrl

      const relayState = await generateSamlState(c.env.ACTIONS_KV, teamId, idpSsoUrl)
      const samlRequest = buildAuthnRequest(entityId, acsUrl, idpSsoUrl)

      const sep = idpSsoUrl.includes('?') ? '&' : '?'
      const redirect = `${idpSsoUrl}${sep}SAMLRequest=${samlRequest}&RelayState=${encodeURIComponent(relayState)}`
      return c.redirect(redirect, 302)
    } catch (err) {
      return authRedirectSamlFailed(c, err, '[auth] saml/init')
    }
  })

  app.post('/saml/callback', async (c) => {
    const disabled = samlDisabled(c)
    if (disabled) return disabled
    const form = await c.req.formData().catch(() => null)
    if (!form) return c.redirect(`${c.env.PAGES_URL}/login?error=saml_failed`, 302)

    const samlResponse = form.get('SAMLResponse')
    const relayState = form.get('RelayState')
    if (typeof samlResponse !== 'string' || typeof relayState !== 'string') {
      return c.redirect(`${c.env.PAGES_URL}/login?error=saml_failed`, 302)
    }

    try {
      const state = await consumeSamlState(c.env.ACTIONS_KV, relayState)
      if (!state) return c.redirect(`${c.env.PAGES_URL}/login?error=saml_replay`, 302)

      const expectedAudience = c.env.SAML_SP_ENTITY_ID ?? `${c.env.API_URL}`
      let assertion: { email: string; nameId: string }
      try {
        assertion = parseAssertion(samlResponse, expectedAudience)
      } catch (err) {
        console.error(`[auth:saml] assertion parse failed: ${(err as Error).message}`)
        void recordAuthAuditEvent(c.env.DB, {
          action: 'auth.sso_failed',
          actor_ip: c.req.header('cf-connecting-ip') ?? null,
          trace_id: c.get('trace_id'),
          subject_id: 'saml_assertion',
          outcome: 'failure',
          detail: 'assertion_parse_failed',
        })
        return c.redirect(`${c.env.PAGES_URL}/login?error=saml_invalid`, 302)
      }

      const email = assertion.email
      const now = Date.now()

      const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`)
        .bind(email)
        .first<{ id: string }>()
      let userId: string
      if (existing) {
        userId = existing.id
        await c.env.DB.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`).bind(now, userId).run()
      } else {
        userId = ulid()
        await c.env.DB
          .prepare(`INSERT INTO users (id, email, created_at, last_login_at, plan) VALUES (?1, ?2, ?3, ?3, 'team')`)
          .bind(userId, email, now)
          .run()
      }

      await attachUserToTeam(c.env.TEAMS_KV, c.env.DB, state.teamId, userId, email, 'member')

      const jwt = await signJwt({ sub: userId, email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
      setAuthSessionCookie(c, jwt)
      void recordAuthAuditEvent(c.env.DB, {
        action: 'auth.sso_completed',
        actor_id: userId,
        actor_ip: c.req.header('cf-connecting-ip') ?? null,
        trace_id: c.get('trace_id'),
        subject_id: userId,
        outcome: 'success',
        detail: 'saml',
      })
      return c.redirect(`${c.env.PAGES_URL}/`, 302)
    } catch (err) {
      return authRedirectSamlFailed(c, err, '[auth] saml/callback')
    }
  })
}
