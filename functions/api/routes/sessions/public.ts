import { Hono } from 'hono'
import { SESSION_COOKIE } from '../../middleware/auth'
import { verifyJwt } from '../../lib/jwt'
import { deriveVoterIdentity } from '../../lib/voter'
import { requireLiveForWebSocket } from '../../lib/session-lifecycle'
import {
  fetchSessionByCode,
  doStub,
  presenterPermissionsForSession,
  type SessionRow,
  type SessionVars,
} from './shared'
import type { Env } from '../../types'
import type { Permission } from '../../lib/authz'

export function mountPublicSessionRoutes(pub: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  pub.get('/by-code/:code', async (c) => {
    const code = c.req.param('code').toUpperCase()
    const traceId = c.get('trace_id')
    if (!/^[0-9A-Z]{6}$/.test(code)) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'join.bad_code', trace_id: traceId }))
      return c.json(
        { ok: false, error: { code: 'bad_code', message: 'Invalid join code' }, trace_id: traceId },
        400,
      )
    }
    const session = await fetchSessionByCode(c.env.DB, code)
    if (!session || session.status === 'archived' || session.status === 'closed') {
      // Log enumeration attempts for security monitoring
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'join.not_found', trace_id: traceId }))
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'No active session for that code' }, trace_id: traceId },
        404,
      )
    }
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'join.success', session_id: session.id, status: session.status, trace_id: traceId }))
    return c.json({
      ok: true,
      data: { id: session.id, title: session.title, code: session.code, status: session.status as 'draft' | 'live' },
      trace_id: traceId,
    })
  })

  pub.get('/:id/ws', async (c) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
      return c.json(
        { ok: false, error: { code: 'bad_request', message: 'Expected WebSocket upgrade' }, trace_id: c.get('trace_id') },
        400,
      )
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
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const wsGate = requireLiveForWebSocket(session)
    if (!wsGate.ok) {
      return c.json(
        { ok: false, error: { code: wsGate.error.code, message: wsGate.error.message }, trace_id: c.get('trace_id') },
        wsGate.error.status,
      )
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
      const claims = await verifyJwt(token, c.env.JWT_SECRET)
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

    const stub = await doStub(c.env, id)
    const upgraded = await stub.fetch('https://do.internal/ws', {
      headers: {
        upgrade: 'websocket',
        'x-qesto-role': role,
        'x-qesto-voter': voterId,
        'x-qesto-ip-hash': identity.ipHash,
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
