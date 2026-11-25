/**
 * Requirement: OPS-QUEUE-BIND-01 — deploy verification must not fail a release
 * on Pages bindings (INSIGHTS_QUEUE) that wrangler pages deploy does not apply.
 * Fatal only when SMOKE_REQUIRE_BINDINGS=1, matching scripts/smoke-platform.mjs.
 */
import { describe, expect, it } from 'vitest'
import { bindingProbeDecision } from '../../scripts/verify-deploy.mjs'

describe('verify-deploy binding probe', () => {
  it('warns when a required binding is missing', () => {
    const decision = bindingProbeDecision(['INSIGHTS_QUEUE'], {})
    expect(decision.action).toBe('warn')
    expect(decision.missing).toEqual(['INSIGHTS_QUEUE'])
  })

  it('fails only when SMOKE_REQUIRE_BINDINGS=1', () => {
    const decision = bindingProbeDecision(['INSIGHTS_QUEUE'], { SMOKE_REQUIRE_BINDINGS: '1' })
    expect(decision.action).toBe('fail')
  })

  it('is ok when nothing required is missing', () => {
    expect(bindingProbeDecision([], {}).action).toBe('ok')
    expect(bindingProbeDecision(undefined, {}).action).toBe('ok')
  })
})
