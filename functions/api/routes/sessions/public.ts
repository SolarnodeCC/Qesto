import { Hono } from 'hono'
import { SESSION_COOKIE } from '../../middleware/auth'
import { jwtVerificationSecrets, verifyJwtWithSecrets } from '../../lib/jwt'
import { deriveVoterIdentity } from '../../lib/voter'
import { requireLiveForWebSocket } from '../../lib/session-lifecycle'
import { errorResponse } from '../../lib/error-handler'
import {
  fetchSessionByCode,
  getSessionRoomStub,
  presenterPermissionsForSession,
  type SessionRow,
  type SessionVars,
} from './shared'
import { loadTeamBranding } from '../../lib/team-branding'
import { issueJoinCaptchaToken, verifyJoinCaptchaToken } from '../../lib/join-captcha'
import type { Env } from '../../types'
import type { Permission } from '../../lib/authz'
import { logEvent } from '../../lib/log'

export function mountPublicSessionRoutes(pub: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  pub.get('/by-code/:code', async (c) => {
    const code = c.req.param('code').toUpperCase()
    const traceId = c.get('trace_id')
    if (!/^[0-9A-Z]{6}$/.test(code)) {
      logEvent({ ts: new Date().toISOString(), level: 'warn', event: 'join.bad_code', trace_id: traceId })
      return errorResponse(c, 400, 'bad_code', 'Invalid join code')
    }
    const session = await fetchSessionByCode(c.env.DB, code)
    if (!session || session.status === 'archived' || session.status === 'closed') {
      // Log enumeration attempts for security monitoring
      logEvent({ ts: new Date().toISOString(), level: 'warn', event: 'join.not_found', trace_id: traceId })
      return errorResponse(c, 404, 'not_found', 'No active session for that code')
    }
    if (c.env.JOIN_CAPTCHA_ENABLED === 'true') {
      const token = c.req.header('x-qesto-join-token')
      if (!token || !(await verifyJoinCaptchaToken(c.env, token, code))) {
        const joinToken = await issueJoinCaptchaToken(c.env, code)
        return c.json(
          {
            ok: false,
            error: { code: 'captcha_required', message: 'Join token required' },
            data: { joinToken },
            trace_id: traceId,
          },
          428,
        )
      }
    }
    logEvent({ ts: new Date().toISOString(), level: 'info', event: 'join.success', session_id: session.id, status: session.status, trace_id: traceId })
    const branding = await loadTeamBranding(c.env.TEAMS_KV, session.team_id)
    return c.json({
      ok: true,
      data: {
        id: session.id,
        title: session.title,
        code: session.code,
        status: session.status as 'draft' | 'live',
        ...(branding ? { branding } : {}),
      },
      trace_id: traceId,
    })
  })

  pub.get('/:id/ws', async (c) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
      return errorResponse(c, 400, 'bad_request', 'Expected WebSocket upgrade')
    }
    const id = c.req.param('id')
    const session = await c.env.DB
      .prepare(
        `SELECT id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
                created_at, started_at, closed_at, archived_at, team_id
           FROM sessions
          WHERE id = ?1`,
      )
      .bind(id)
      .first<SessionRow>()
    if (!session) {
      return errorResponse(c, 404, 'not_found', 'Session not found')
    }
    const wsGate = requireLiveForWebSocket(session)
    if (!wsGate.ok) {
      return errorResponse(c, wsGate.error.status, wsGate.error.code, wsGate.error.message)
    }

    // Presenter detection: JWT in subprotocol OR qesto_session cookie.
    let role: 'presenter' | 'voter' = 'voter'
    const subprotoHeader = c.req.header('sec-websocket-protocol') ?? ''
    const bearerToken = subprotoHeader
      .split(',')
      .map((s) => s.trim())
      .find((s) => s.startsWith('qesto.bearer.'))
      ?.replace('qesto.bearer.', '')
    const cookieHeader = c.req.header('cookie') ?? ''
    const cookieToken = cookieHeader
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${SESSION_COOKIE}=`))
      ?.substring(SESSION_COOKIE.length + 1)
    const token = bearerToken ?? cookieToken
    let presenterUserId: string | null = null
    let presenterPermissions: Permission[] | undefined
    if (token) {
      const claims = await verifyJwtWithSecrets(token, jwtVerificationSecrets(c.env))
      if (claims) {
        const teamPermissions = await presenterPermissionsForSession(c.env, session, claims.sub)
        const canPresentTeamSession =
          session.team_id !== null &&
          (teamPermissions?.some((permission) =>
            permission === 'session:launch' ||
            permission === 'session:close' ||
            permission === 'energizer:activate'
          ) ?? false)
        if (claims.sub === session.owner_id || canPresentTeamSession) {
          role = 'presenter'
          presenterUserId = claims.sub
          presenterPermissions = teamPermissions
        }
      }
    }

    const identity = await deriveVoterIdentity(c.req.raw)
    const voterId = role === 'presenter' && presenterUserId ? `host_${presenterUserId}` : identity.voterId

    const colo = (c.req.raw as Request & { cf?: { colo?: string } }).cf?.colo ?? ''
    const room = await getSessionRoomStub(c.env, id)
    const upgraded = await room.fetch('https://do.internal/ws', {
      headers: {
        upgrade: 'websocket',
        'x-qesto-role': role,
        'x-qesto-voter': voterId,
        'x-qesto-ip-hash': identity.ipHash,
        ...(colo ? { 'x-qesto-colo': colo } : {}),
        ...(role === 'presenter' && presenterPermissions !== undefined
          ? { 'x-qesto-permissions': presenterPermissions.join(',') }
          : {}),
      },
    })
    // Respond with a fixed subprotocol identifier. Browsers require the 101
    // response to echo *one* of the offered subprotocols, but we must NEVER
    // reflect `qesto.bearer.<JWT>` back — that would leak the bearer token in
    // response headers (visible to proxies, browser devtools, logs).
    // Instead, advertise a stable protocol name that the client offers
    // alongside the bearer token: `qesto-v1`.
    if (upgraded.status === 101) {
      const offered = subprotoHeader
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const hasV1 = offered.includes('qesto-v1')
      const hasBearer = offered.some((p) => p.startsWith('qesto.bearer.'))
      if (hasV1 || hasBearer) {
        const headers = new Headers(upgraded.headers)
        headers.set('sec-websocket-protocol', 'qesto-v1')
        return new Response(upgraded.body, {
          status: 101,
          headers,
          webSocket: (upgraded as unknown as { webSocket?: WebSocket }).webSocket,
        } as ResponseInit)
      }
    }
    return upgraded
  })
}
