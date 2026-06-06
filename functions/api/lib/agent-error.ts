/**
 * Agent-friendly error surface for repair routing (HLT-017).
 */

export type AgentErrorCode =
  | 'validation'
  | 'not_found'
  | 'forbidden'
  | 'conflict'
  | 'rate_limited'
  | 'unsupported'
  | 'internal'

export class QestoAgentError extends Error {
  readonly purpose: string
  readonly reason: string
  readonly commonFixes: string[]
  readonly docs_url: string
  readonly repair_hint: string
  readonly code: AgentErrorCode

  constructor(opts: {
    code: AgentErrorCode
    message: string
    purpose: string
    reason: string
    commonFixes: string[]
    docs_url: string
    repair_hint: string
  }) {
    super(opts.message)
    this.name = 'QestoAgentError'
    this.code = opts.code
    this.purpose = opts.purpose
    this.reason = opts.reason
    this.commonFixes = opts.commonFixes
    this.docs_url = opts.docs_url
    this.repair_hint = opts.repair_hint
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      purpose: this.purpose,
      reason: this.reason,
      common_fixes: this.commonFixes,
      docs_url: this.docs_url,
      repair_hint: this.repair_hint,
    }
  }
}

export function unsupportedFeature(message: string, repair_hint: string): QestoAgentError {
  return new QestoAgentError({
    code: 'unsupported',
    message,
    purpose: 'Surface an explicit unsupported capability with repair routing',
    reason: 'The requested integration path is not enabled in this release',
    commonFixes: [
      'Check feature flags and plan gates for the team',
      'Use the documented REST alternative if available',
      'Attach raw CI logs when escalating to the owning lane',
    ],
    docs_url: 'docs/testing.md',
    repair_hint,
  })
}
