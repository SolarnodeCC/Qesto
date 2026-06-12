/**
 * AI-461 (S87) — Agent action transparency: structured audit of AI-driven
 * session mutations.
 *
 * When the copilot (or any agent runner) executes an action that mutates session
 * state, we record a structured, sanitised entry in the audit log so there is a
 * tamper-evident, queryable "audit-of-agent" surface. This closes S86 AI
 * follow-up #3 ("AUDIT-log accepted AI actions that mutate the session").
 *
 * The entry wraps `recordAuditEvent` (lib/audit.ts) with the agent shape:
 *   - action          : `agent.action.*`
 *   - subject_type    : 'session' (or caller-provided)
 *   - after_snapshot  : { source: 'ai', provenance: '[AI-Generated]', agentId,
 *                         toolName, toolArgs (sanitised), outcome }
 *
 * SANITISATION RULE (no PII / no raw participant content): every string field in
 * the tool arguments is dropped if it looks like free-form participant content —
 * longer than `FREEFORM_MAX_LEN` chars OR containing a newline. Nested objects
 * are sanitised recursively; arrays are sanitised element-wise. Numbers, booleans
 * and short single-line strings (tool/option ids, kinds, short titles) survive.
 */
import type { AuditAction } from './audit'
import { recordAuditEvent } from './audit'

/** A string longer than this is treated as free-form participant content and dropped. */
export const FREEFORM_MAX_LEN = 80

/** Provenance marker stamped on every agent-action audit entry. */
export const AI_PROVENANCE_MARKER = '[AI-Generated]'

/** Sentinel substituted for a stripped free-form string field. */
export const REDACTED_FREEFORM = '[redacted:freeform]'

export type AgentAuditAction = Extract<AuditAction, `agent.action.${string}`>

export type AgentActionOutcome = 'success' | 'error'

export interface AgentAuditParams {
  /** `agent.action.*` — the mutation class. */
  action: AgentAuditAction
  /** The mutated session id (subject of the audit entry). */
  sessionId: string
  /** Stable id of the agent/runner that executed the action (e.g. 'facilitation-copilot'). */
  agentId: string
  /** Name of the tool the agent invoked (e.g. 'accept_suggestion', 'add_question'). */
  toolName: string
  /** Raw tool arguments — sanitised here before any persistence. */
  toolArgs?: Record<string, unknown>
  /** Whether the underlying mutation succeeded. */
  outcome: AgentActionOutcome
  /** Optional subject type override (defaults to 'session'). */
  subjectType?: string
}

/**
 * Recursively strip free-form participant content from a tool-args value.
 * - string : kept only if single-line and ≤ FREEFORM_MAX_LEN, else REDACTED.
 * - array  : sanitised element-wise.
 * - object : sanitised key-wise (keys preserved; values sanitised).
 * - other  : numbers/booleans/null pass through untouched.
 */
export function sanitizeAgentToolValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > FREEFORM_MAX_LEN || value.includes('\n') ? REDACTED_FREEFORM : value
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeAgentToolValue)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeAgentToolValue(v)
    }
    return out
  }
  return value
}

/** Sanitise a full tool-args record (top-level convenience wrapper). */
export function sanitizeAgentToolArgs(
  args: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!args) return {}
  return sanitizeAgentToolValue(args) as Record<string, unknown>
}

/**
 * Build the `after_snapshot` for an agent-action audit entry. Pure + testable:
 * the sanitisation and provenance shape are asserted directly in the eval tests
 * without touching the audit DB.
 */
export function buildAgentActionSnapshot(params: AgentAuditParams): Record<string, unknown> {
  return {
    source: 'ai',
    provenance: AI_PROVENANCE_MARKER,
    agentId: params.agentId,
    toolName: params.toolName,
    toolArgs: sanitizeAgentToolArgs(params.toolArgs),
    outcome: params.outcome,
  }
}

/**
 * Record a structured audit entry for an AI agent action that mutated session
 * state. Wraps `recordAuditEvent`; fail-safe (never throws — audit failures must
 * not block the agent path).
 */
export async function auditAgentAction(
  c: { get(key: string): unknown; req: { header(h: string): string | undefined }; env: { DB: D1Database } },
  params: AgentAuditParams,
): Promise<void> {
  await recordAuditEvent(c, {
    action: params.action as AuditAction,
    subject_type: params.subjectType ?? 'session',
    subject_id: params.sessionId,
    after_snapshot: buildAgentActionSnapshot(params),
  })
}
