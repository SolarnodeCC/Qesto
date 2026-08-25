// Proof-aware decoders for boundary crossings using Zod.
// All data from network, storage, or KV must be validated before casting.
//
// Split out of the 963-line protocol-schemas.ts (issue #687). That file is now a
// re-export barrel, so every existing import path keeps working unchanged.

import { z } from 'zod'
import { ClientMessageSchema, VersionedClientEnvelopeSchema, type ValidClientMessage } from './realtime'

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
  'deliberate.config',
  'deliberate.ballot.cast',
  'deliberate.verify.mismatch',
  'embed.widget.create',
  'embed.widget.token_mint',
  'embed.widget.revoke',
  'user.create',
  'user.update',
  'user.suspend',
  'user.restore',
  // Agent action transparency (AI-461, S87) — AI agent/copilot state mutations.
  'agent.action.suggestion_accepted',
  'agent.action.question_injected',
  'agent.action.state_changed',
  'agent.action.plan_step_reviewed',
  // LEARN (ADR-0058, S94) — LMS grade passback + sovereign audit export.
  'learn.grade.passback',
  'sovereign.audit.export',
  // CONNECT (ADR-0062, S96) — federation invite + join lifecycle.
  'connect.invite.minted',
  'connect.session.joined',
  'connect.invite.revoked',
  // STUDIO (ADR-0060, S96/S97) — authoring co-pilot + content library.
  'studio.questions.generated',
  'studio.library.saved',
  'studio.library.forked',
  'studio.library.deleted',
  // Role lifecycle on team membership (#524).
  'role.assigned',
  'role.changed',
  'role.removed',
  // Marketing Automation (single-owner internal tool).
  'marketing.content_item_edit',
  'marketing.content_item_approve',
  'marketing.content_item_reject',
  'marketing.content_item_publish',
  'marketing.mention_reviewed',
  'marketing.calendar_create',
  'marketing.calendar_update',
  'marketing.calendar_delete',
  'marketing.video_asset_update',
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

// ── Trace/Observability Validators ──────────────────────────────────────────

export const TraceContextSchema = z.object({
  trace_id: z.string().min(1),
  span_id: z.string().min(1).optional(),
  parent_span_id: z.string().min(1).optional(),
  sampled: z.boolean().optional(),
})

export type ValidTraceContext = z.infer<typeof TraceContextSchema>

// Safely parse client message with type guard
// Validates before returning to ensure type safety at boundary
export function parseClientMessage(text: string): ValidClientMessage | null {
  try {
    const envelope = VersionedClientEnvelopeSchema.parse(JSON.parse(text))
    if (typeof envelope.type === 'string') {
      return ClientMessageSchema.parse(envelope) as ValidClientMessage
    }
    return null
  } catch {
    return null
  }
}

// Validate already-parsed object with a schema
export function validateData<T>(data: unknown, schema: z.ZodSchema<T>): T | null {
  try {
    return schema.parse(data)
  } catch {
    return null
  }
}
