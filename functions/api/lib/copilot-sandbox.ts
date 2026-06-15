/**
 * SEC-COPILOT-SANDBOX-01 (ADR-0056, Pentest #6 agent surface) — runtime sandbox
 * for L2 copilot tool execution.
 *
 * Three hard invariants the L2 copilot must never break:
 *   1. No session writes        — tools are read-only (aggregate analysis only).
 *   2. No cross-session reads    — the tool's context must belong to the session
 *                                  the plan was built for.
 *   3. No PII in tool output     — outputs are aggregate; voter ids / emails / names
 *                                  must never appear (defence-in-depth over the
 *                                  aggregate-only tool inputs).
 *
 * Pure checks so the boundary is identical wherever a plan step is built/approved
 * and is unit-testable without a DO.
 */
import { COPILOT_L2_ALLOWED_TOOLS } from './agent-safety'
import type { CopilotLiveContext } from './copilot-live-context'

/** Tools that would mutate or read across sessions — never permitted under L2. */
export const SANDBOX_FORBIDDEN_TOOLS = new Set([
  'add_question',
  'close_session',
  'archive_session',
  'delete_session',
  'export_results',
  'export_pii',
  'read_other_session',
  'mutate_votes',
  'send_email',
])

/** Heuristic PII signature for serialized tool output (voter ids / emails / name fields). */
const PII_PATTERN = /voter[-_]|@|"email"|"displayName"|"voterId"/i

export type SandboxVerdict = { ok: true } | { ok: false; reason: string }

/** A tool is sandbox-safe only if it is on the L2 read-only whitelist and not forbidden. */
export function isSandboxedTool(tool: string): boolean {
  if (SANDBOX_FORBIDDEN_TOOLS.has(tool)) return false
  return (COPILOT_L2_ALLOWED_TOOLS as readonly string[]).includes(tool)
}

/** Invariant 2 — the tool's context must be the session the plan was built for. */
export function assertSameSessionContext(
  expectedSessionId: string,
  context: Pick<CopilotLiveContext, 'sessionId'>,
): SandboxVerdict {
  if (context.sessionId !== expectedSessionId) {
    return { ok: false, reason: 'cross_session_read_blocked' }
  }
  return { ok: true }
}

/** Invariant 3 — reject any serialized output carrying a PII signature. */
export function assertNoPiiInOutput(output: unknown): SandboxVerdict {
  let serialized: string
  try {
    serialized = JSON.stringify(output ?? null)
  } catch {
    return { ok: false, reason: 'output_not_serializable' }
  }
  if (PII_PATTERN.test(serialized)) return { ok: false, reason: 'pii_in_tool_output' }
  return { ok: true }
}

/**
 * Full sandbox gate for a single tool execution. Combines whitelist + same-session
 * + PII checks. Returns the first failure or `{ ok: true }`.
 */
export function enforceCopilotSandbox(args: {
  tool: string
  sessionId: string
  context: Pick<CopilotLiveContext, 'sessionId'>
  output?: unknown
}): SandboxVerdict {
  if (!isSandboxedTool(args.tool)) return { ok: false, reason: 'tool_not_sandboxed' }
  const sameSession = assertSameSessionContext(args.sessionId, args.context)
  if (!sameSession.ok) return sameSession
  if (args.output !== undefined) {
    const pii = assertNoPiiInOutput(args.output)
    if (!pii.ok) return pii
  }
  return { ok: true }
}
