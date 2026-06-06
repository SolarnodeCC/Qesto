// Proof-aware decoders for audit events and audit context boundaries.

import { z } from 'zod'

// ── Audit Event Validators ───────────────────────────────────────────────────

export const AuditActionSchema = z.enum([
  'session.create',
  'session.start',
  'session.close',
  'session.archive',
  'session.update',
  'question.create',
  'question.update',
  'question.delete',
  'user.role_change',
  'team.create',
  'team.update',
  'team.delete',
  'team.role.create',
  'team.role.update',
  'team.role.delete',
  'team.role.assign',
  'team.role.unassign',
  'team.permission_denied',
  'auth.login',
  'auth.logout',
  'billing.plan_change',
  'insights.generate',
  'energizer.create',
  'energizer.advance',
  'energizer.activate',
  'energizer.complete',
  'energizer.activation_denied',
  'ws.energizer_activated',
  'ws.energizer_activation_denied',
  'ws.energizer_advance_denied',
  'ws.energizer_answered',
  'ws.energizer_advanced',
  'ws.energizer_completed',
  'session.close_with_badges',
  'townhall.config',
  'townhall.question.delete',
  'user.create',
  'user.update',
  'user.suspend',
  'user.restore',
])

export type ValidAuditAction = z.infer<typeof AuditActionSchema>

// ── Audit Context Validators (boundary-crossing proof-aware decoders) ────────

export const AuditContextSchema = z.object({
  action: AuditActionSchema,
  subject_type: z.string().min(1),
  subject_id: z.string().min(1),
  before_snapshot: z.record(z.string(), z.unknown()).optional(),
  after_snapshot: z.record(z.string(), z.unknown()).optional(),
  actor_id: z.string().optional().nullable(),
  actor_ip: z.string().optional().nullable(),
  trace_id: z.string().optional().nullable(),
  idempotency_key: z.string().optional().nullable(),
})

export type ValidAuditContext = z.infer<typeof AuditContextSchema>
