// DD-04 (#877) — TOTP enrolment, second-factor login, and step-up.
// Logic lives in lib/mfa.ts; these handlers only wire it to HTTP.
import { z } from 'zod'
import type { Context } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { errorResponse } from '../../lib/error-handler'
import { signJwt } from '../../lib/jwt'
import { atomicRateLimitDual } from '../../lib/atomic-rate-limit'
import { recordAuthAuditEvent } from '../../lib/audit'
import { otpauthUri } from '../../lib/totp'
import {
  beginEnrolment,
  confirmEnrolment,
  disableMfa,
  isMfaEnabled,
  recoveryCodesRemaining,
  verifyMfaPendingToken,
  verifySecondFactor,
} from '../../lib/mfa'
import { JWT_TTL_SECONDS } from './constants'
import { setAuthSessionCookie } from './cookie'
import type { AuthApp, AuthVars } from './types'
import type { Env } from '../../types'

type C = Context<{ Bindings: Env; Variables: AuthVars }>

const CodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) })
const FactorSchema = z
  .object({ code: z.string().regex(/^\d{6}$/).optional(), recovery_code: z.string().min(8).max(32).optional() })
  .refine((v) => Boolean(v.code) !== Boolean(v.recovery_code), 'Provide exactly one of code or recovery_code')
const VerifySchema = z
  .object({
    mfa_token: z.string().min(20).max(2048),
    code: z.string().regex(/^\d{6}$/).optional(),
    recovery_code: z.string().min(8).max(32).optional(),
  })
  .refine((v) => Boolean(v.code) !== Boolean(v.recovery_code), 'Provide exactly one of code or recovery_code')

/** Per-user attempt budget: 10 second-factor tries per 15 minutes. */
async function attemptsAllowed(c: C, userId: string): Promise<boolean> {
  const gate = await atomicRateLimitDual(c.env, {
    key: `mfa:${userId}`,
    burst: 'auth_burst',
    sustained: { max: 10, windowSeconds: 900, prefix: 'auth-mfa' },
    profileLabel: 'auth_mfa',
  })
  return gate.allowed
}

async function issueMfaSession(c: C, user: { sub: string; email: string }): Promise<string> {
  const jwt = await signJwt(
    { sub: user.sub, email: user.email, jti: crypto.randomUUID(), mfa_at: Math.floor(Date.now() / 1000) },
    c.env.JWT_SECRET,
    JWT_TTL_SECONDS,
  )
  setAuthSessionCookie(c, jwt)
  return jwt
}

function audit(c: C, action: 'auth.mfa_enabled' | 'auth.mfa_disabled' | 'auth.mfa_verified' | 'auth.mfa_failed', userId: string, detail?: string) {
  void recordAuthAuditEvent(c.env.DB, {
    action,
    actor_id: userId,
    actor_ip: c.req.header('cf-connecting-ip') ?? null,
    trace_id: c.get('trace_id'),
    subject_id: userId,
    outcome: action === 'auth.mfa_failed' ? 'failure' : 'success',
    ...(detail ? { detail } : {}),
  })
}

export function registerMfaRoutes(app: AuthApp): void {
  app.get('/mfa/status', authMiddleware, async (c) => {
    const user = c.get('user')
    return c.json({
      ok: true,
      data: {
        enabled: await isMfaEnabled(c.env, user.sub),
        recoveryCodesRemaining: await recoveryCodesRemaining(c.env, user.sub),
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/mfa/setup', authMiddleware, async (c) => {
    const user = c.get('user')
    if (c.get('impersonator_id')) return errorResponse(c, 403, 'forbidden', 'Not available while impersonating')
    const result = await beginEnrolment(c.env, user.sub)
    if ('error' in result) return errorResponse(c, 409, 'mfa_already_enabled', 'Two-factor authentication is already on')
    return c.json({
      ok: true,
      data: { secret: result.secret, otpauthUri: otpauthUri(result.secret, user.email) },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/mfa/enable', authMiddleware, async (c) => {
    const user = c.get('user')
    if (c.get('impersonator_id')) return errorResponse(c, 403, 'forbidden', 'Not available while impersonating')
    const parsed = CodeSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return errorResponse(c, 400, 'validation', 'Enter the 6-digit code from your app')
    if (!(await attemptsAllowed(c, user.sub))) return errorResponse(c, 429, 'rate_limited', 'Too many attempts. Try again later.')
    const result = await confirmEnrolment(c.env, user.sub, parsed.data.code)
    if ('error' in result) {
      const status = result.error === 'invalid_code' ? 400 : 409
      return errorResponse(c, status, `mfa_${result.error}`, 'Could not enable two-factor authentication')
    }
    audit(c, 'auth.mfa_enabled', user.sub)
    const token = await issueMfaSession(c, user)
    return c.json({ ok: true, data: { recoveryCodes: result.recoveryCodes, token }, trace_id: c.get('trace_id') })
  })

  app.post('/mfa/disable', authMiddleware, async (c) => {
    const user = c.get('user')
    if (c.get('impersonator_id')) return errorResponse(c, 403, 'forbidden', 'Not available while impersonating')
    const parsed = FactorSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return errorResponse(c, 400, 'validation', 'A current code or recovery code is required')
    if (!(await attemptsAllowed(c, user.sub))) return errorResponse(c, 429, 'rate_limited', 'Too many attempts. Try again later.')
    const ok = await verifySecondFactor(c.env, user.sub, {
      ...(parsed.data.code ? { code: parsed.data.code } : {}),
      ...(parsed.data.recovery_code ? { recoveryCode: parsed.data.recovery_code } : {}),
    })
    if (!ok.ok) {
      audit(c, 'auth.mfa_failed', user.sub, 'disable')
      return errorResponse(c, 400, 'mfa_invalid_code', 'That code is not valid')
    }
    await disableMfa(c.env, user.sub)
    audit(c, 'auth.mfa_disabled', user.sub)
    return c.json({ ok: true, data: { enabled: false }, trace_id: c.get('trace_id') })
  })

  // Second step of every login when MFA is on (body: mfa_token + code|recovery_code).
  app.post('/mfa/verify', async (c) => {
    const parsed = VerifySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return errorResponse(c, 400, 'validation', 'A code or recovery code is required')
    const pending = await verifyMfaPendingToken(c.env, parsed.data.mfa_token)
    if (!pending) return errorResponse(c, 401, 'mfa_token_invalid', 'Sign-in expired. Start again.')
    if (!(await attemptsAllowed(c, pending.sub))) return errorResponse(c, 429, 'rate_limited', 'Too many attempts. Try again later.')
    const ok = await verifySecondFactor(c.env, pending.sub, {
      ...(parsed.data.code ? { code: parsed.data.code } : {}),
      ...(parsed.data.recovery_code ? { recoveryCode: parsed.data.recovery_code } : {}),
    })
    if (!ok.ok) {
      audit(c, 'auth.mfa_failed', pending.sub, 'login')
      return errorResponse(c, 401, 'mfa_invalid_code', 'That code is not valid')
    }
    audit(c, 'auth.mfa_verified', pending.sub, ok.method)
    const token = await issueMfaSession(c, pending)
    return c.json({ ok: true, data: { id: pending.sub, email: pending.email, token }, trace_id: c.get('trace_id') })
  })

  // Step-up: refresh `mfa_at` on the current session for sensitive actions.
  app.post('/mfa/step-up', authMiddleware, async (c) => {
    const user = c.get('user')
    if (c.get('impersonator_id')) return errorResponse(c, 403, 'forbidden', 'Not available while impersonating')
    const parsed = FactorSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return errorResponse(c, 400, 'validation', 'A code or recovery code is required')
    if (!(await attemptsAllowed(c, user.sub))) return errorResponse(c, 429, 'rate_limited', 'Too many attempts. Try again later.')
    const ok = await verifySecondFactor(c.env, user.sub, {
      ...(parsed.data.code ? { code: parsed.data.code } : {}),
      ...(parsed.data.recovery_code ? { recoveryCode: parsed.data.recovery_code } : {}),
    })
    if (!ok.ok) {
      audit(c, 'auth.mfa_failed', user.sub, 'step_up')
      return errorResponse(c, 400, 'mfa_invalid_code', 'That code is not valid')
    }
    audit(c, 'auth.mfa_verified', user.sub, `step_up:${ok.method}`)
    const token = await issueMfaSession(c, user)
    return c.json({ ok: true, data: { token }, trace_id: c.get('trace_id') })
  })
}
