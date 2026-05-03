import type { Context } from 'hono'
import { sanitizeError } from '../../lib/error-handler'
import type { Env } from '../../types'
import type { AuthVars } from './types'

type AuthCtx = Context<{ Bindings: Env; Variables: AuthVars }>

/** JSON 500 with production-safe message (never leaks stack/details in prod). */
export function authJsonInternalError(c: AuthCtx, err: unknown, logLabel: string): Response {
  console.error(`${logLabel}:`, err)
  const { message } = sanitizeError(err, c.env.ENV, 500)
  return c.json(
    { ok: false, error: { code: 'internal', message }, trace_id: c.get('trace_id') },
    500,
  )
}

export function authRedirectLoginServerError(c: AuthCtx, err: unknown, logLabel: string): Response {
  console.error(`${logLabel}:`, err)
  return c.redirect(`${c.env.PAGES_URL}/login?error=server`, 302)
}

export function authRedirectSsoFailed(c: AuthCtx, err: unknown, logLabel: string): Response {
  console.error(`${logLabel}:`, err)
  return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
}

export function authRedirectSamlFailed(c: AuthCtx, err: unknown, logLabel: string): Response {
  console.error(`${logLabel}:`, err)
  return c.redirect(`${c.env.PAGES_URL}/login?error=saml_failed`, 302)
}
