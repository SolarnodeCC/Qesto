// DD-04 (#877) — step-up authentication for sensitive account actions.
//
// A user who has turned two-factor authentication on must have confirmed a
// second factor in the last 15 minutes (`mfa_at` claim, minted by the MFA
// login step or POST /api/auth/mfa/step-up) before destructive or
// privilege-changing actions: deleting a team, changing its SAML config,
// managing members and roles, and creating/rotating/revoking API keys.
//
// Users WITHOUT MFA are not gated — there is no second factor to ask for, and
// forcing enrolment is a product decision, not this middleware's. The SPA
// catches `mfa_step_up_required`, prompts for a code and retries the request
// (src/components/auth/MfaStepUpPrompt.tsx).
import type { Context } from 'hono'
import type { Env } from '../types'
import type { AuthVariables } from './auth'
import { errorResponse } from '../lib/error-handler'
import { hasRecentMfa, isMfaEnabled } from '../lib/mfa'
import { safeLogContext } from '../lib/log'

export const STEP_UP_REQUIRED_CODE = 'mfa_step_up_required'

// Generic over the route's variable map: any context whose variables include
// the auth claims (team routes add plan variables on top).
type C<V extends Pick<AuthVariables, 'user' | 'trace_id'>> = Context<{ Bindings: Env; Variables: V }>

export function stepUpEnforced(env: Pick<Env, 'MFA_STEP_UP_ENFORCED'>): boolean {
  return env.MFA_STEP_UP_ENFORCED !== 'false'
}

/**
 * Returns a 403 response when step-up is needed, otherwise null. Call it AFTER
 * the route's own authorization check, so a caller without permission gets a
 * plain 403/404 and is never prompted for a code.
 */
export async function requireStepUp<V extends Pick<AuthVariables, 'user' | 'trace_id'>>(
  c: C<V>,
): Promise<Response | null> {
  if (!stepUpEnforced(c.env)) return null
  const user = c.get('user' as never) as AuthVariables['user'] | undefined
  if (!user) return errorResponse(c, 401, 'unauthenticated', 'Authentication required')
  if (hasRecentMfa(user)) return null
  let enrolled: boolean
  try {
    enrolled = await isMfaEnabled(c.env, user.sub)
  } catch (err) {
    // Fail closed: a sensitive action must not proceed on an unknown MFA state.
    safeLogContext(err, {
      traceId: (c.get('trace_id' as never) as string | undefined) ?? 'unknown',
      route: c.req.path,
      errorClass: 'MfaStateLookupError',
      statusCode: 503,
    })
    return errorResponse(c, 503, 'unavailable', 'Could not confirm your security settings. Try again.')
  }
  if (!enrolled) return null
  return errorResponse(c, 403, STEP_UP_REQUIRED_CODE, 'Confirm with your authenticator code to continue')
}
