import { describe, expect, it, vi } from 'vitest'
import { recordAuditEvent } from '../../functions/api/lib/audit'
import { AuditContextSchema } from '../../functions/api/lib/protocol-schemas'

// #524 — role lifecycle audit events: role.assigned / role.changed / role.removed.

function mockCtx() {
  const bound: unknown[][] = []
  const run = vi.fn().mockResolvedValue(undefined)
  const bind = vi.fn((...args: unknown[]) => {
    bound.push(args)
    return { run }
  })
  const prepare = vi.fn(() => ({ bind }))
  const store: Record<string, unknown> = {
    user: { sub: 'user_admin', email: 'admin@acme.test' },
    trace_id: 'trace_1',
  }
  const c = {
    get: (k: string) => store[k],
    req: { header: (_h: string) => 'cf-ip' },
    env: { DB: { prepare } as unknown as D1Database },
  }
  return { c, prepare, bind, run, bound }
}

describe('role.* audit actions (#524)', () => {
  it('accepts role.assigned / role.changed / role.removed in the audit schema', () => {
    for (const action of ['role.assigned', 'role.changed', 'role.removed'] as const) {
      const parsed = AuditContextSchema.safeParse({
        action,
        subject_type: 'team_member',
        subject_id: 'user_x',
        after_snapshot: { role: 'member' },
      })
      expect(parsed.success).toBe(true)
    }
  })

  it('writes a role.assigned event with the assigned role', async () => {
    const { c, run, bound } = mockCtx()
    await recordAuditEvent(c as never, {
      action: 'role.assigned',
      subject_type: 'team_member',
      subject_id: 'invitee@acme.test',
      after_snapshot: { teamId: 'team_1', role: 'admin', via: 'invite' },
    })
    expect(run).toHaveBeenCalledOnce()
    const args = bound[0]
    // action is bind position 5 (?5), after_snapshot is ?9.
    expect(args[4]).toBe('role.assigned')
    expect(String(args[8])).toContain('"role":"admin"')
  })

  it('writes a role.changed event with before/after snapshots', async () => {
    const { c, run, bound } = mockCtx()
    await recordAuditEvent(c as never, {
      action: 'role.changed',
      subject_type: 'custom_role',
      subject_id: 'role_1',
      before_snapshot: { name: 'Editor', permissions: ['session:create'] },
      after_snapshot: { name: 'Editor', permissions: ['session:create', 'session:close'] },
    })
    expect(run).toHaveBeenCalledOnce()
    const args = bound[0]
    expect(args[4]).toBe('role.changed')
    expect(String(args[7])).toContain('Editor') // before_snapshot ?8 (index 7)
    expect(String(args[8])).toContain('session:close') // after_snapshot ?9 (index 8)
  })

  it('writes a role.removed event with the prior role', async () => {
    const { c, run, bound } = mockCtx()
    await recordAuditEvent(c as never, {
      action: 'role.removed',
      subject_type: 'team_member',
      subject_id: 'user_y',
      before_snapshot: { teamId: 'team_1', role: 'viewer' },
    })
    expect(run).toHaveBeenCalledOnce()
    const args = bound[0]
    expect(args[4]).toBe('role.removed')
    expect(String(args[7])).toContain('"role":"viewer"')
  })
})
