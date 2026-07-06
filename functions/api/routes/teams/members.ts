// Team membership routes: invite a member by email (magic-link token) and
// remove a member. Registered by mountTeamRoutes (index.ts).

import type { Hono } from 'hono'
import { generateMagicLinkToken, hashMagicLinkToken } from '../../lib/tokens'
import { sendEmail } from '../../lib/email'
import { writeKvJson } from '../../lib/kv'
import { teamInviteKey } from '../../lib/kv-keys'
import { TEAM_INVITE_TTL_SECONDS } from '../../lib/constants'
import { denyLimit, maxTeamMembersForPlan } from '../../lib/entitlements'
import { recordAuditEvent } from '../../lib/audit'
import { safeLogContext } from '../../lib/log'
import type { Env } from '../../types'
import {
  type Vars,
  loadTeam,
  saveTeam,
  removeUserTeam,
  requireTeamPermission,
  InviteMemberSchema,
} from './shared'

export function registerMemberRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>) {
  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/teams/:id/members — invite member by email
  // Issues a magic-link style invite token; member is added on acceptance.
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/:id/members', async (c) => {
    const user = c.get('user')
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const denied = await requireTeamPermission(c, team, 'team:manage_members', 'Manage members permission required')
    if (denied) return denied

    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = InviteMemberSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid invite payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    const email = parsed.data.email.toLowerCase().trim()
    // No-op if already a member.
    if (team.members.some((m) => m.email === email)) {
      return c.json(
        { ok: false, error: { code: 'already_member', message: 'Email is already a team member' }, trace_id: c.get('trace_id') },
        409,
      )
    }
    const plan = c.get('plan')
    const limit = maxTeamMembersForPlan(plan)
    if (team.members.length >= limit) {
      return c.json(
        {
          ok: false,
          error: denyLimit(plan, `Team member limit exceeded for your ${plan} plan`, limit, team.members.length),
          trace_id: c.get('trace_id'),
        },
        403,
      )
    }

    const raw = generateMagicLinkToken()
    const tokenHash = await hashMagicLinkToken(raw)
    await writeKvJson(
      c.env.TEAMS_KV,
      teamInviteKey(tokenHash),
      { teamId: team.id, email, role: parsed.data.role, createdAt: Date.now() },
      { expirationTtl: TEAM_INVITE_TTL_SECONDS },
    )

    const inviteUrl = `${c.env.PAGES_URL}/teams/accept?token=${raw}`
    try {
      await sendEmail(c.env.RESEND_API_KEY, {
        to: email,
        subject: `You've been invited to ${team.name} on Qesto`,
        text: `${user.email} invited you to join ${team.name} on Qesto.\n\nAccept the invite (valid 24 hours):\n${inviteUrl}`,
        html: `<p><strong>${user.email}</strong> invited you to join <strong>${team.name}</strong> on Qesto.</p><p>The invite is valid for 24 hours.</p><p><a href="${inviteUrl}">Accept invite</a></p>`,
      })
    } catch (err) {
      safeLogContext(err, { traceId: c.get('trace_id') ?? 'unknown', route: '[teams] invite/email', errorClass: err instanceof Error ? err.name : 'UnknownError' })
    }
    await recordAuditEvent(c, {
      action: 'team.role.assign',
      subject_type: 'team_invite',
      subject_id: team.id,
      after_snapshot: { role: parsed.data.role, invited: true },
    })
    // #524: explicit role lifecycle event for the assigned (invited) role.
    await recordAuditEvent(c, {
      action: 'role.assigned',
      subject_type: 'team_member',
      subject_id: email,
      after_snapshot: { teamId: team.id, email, role: parsed.data.role, via: 'invite' },
    })

    return c.json(
      { ok: true, data: { invited: true, email, role: parsed.data.role }, trace_id: c.get('trace_id') },
      202,
    )
  })

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /api/teams/:id/members/:userId — remove member (owner only)
  // ───────────────────────────────────────────────────────────────────────────
  app.delete('/:id/members/:userId', async (c) => {
    const targetId = c.req.param('userId')
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const denied = await requireTeamPermission(c, team, 'team:manage_members', 'Manage members permission required')
    if (denied) return denied
    if (targetId === team.ownerId) {
      return c.json(
        { ok: false, error: { code: 'invalid_target', message: 'Cannot remove the team owner' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const before = team.members.length
    const removedMember = team.members.find((m) => m.userId === targetId)
    team.members = team.members.filter((m) => m.userId !== targetId)
    if (team.members.length === before) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'User is not a member of this team' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    await saveTeam(c.env.TEAMS_KV, team)
    await removeUserTeam(c.env.TEAMS_KV, targetId, team.id)
    await recordAuditEvent(c, {
      action: 'team.role.unassign',
      subject_type: 'team_member',
      subject_id: targetId,
      before_snapshot: { teamId: team.id },
    })
    // #524: explicit role lifecycle event for the removed member's role.
    await recordAuditEvent(c, {
      action: 'role.removed',
      subject_type: 'team_member',
      subject_id: targetId,
      before_snapshot: { teamId: team.id, userId: targetId, role: removedMember?.role ?? null },
    })

    return c.json({ ok: true, data: { removed: true, userId: targetId }, trace_id: c.get('trace_id') })
  })
}
