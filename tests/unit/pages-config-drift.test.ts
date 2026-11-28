/**
 * Requirement: SPEC_DEPLOYMENT — the Pages project serving /api must carry the bindings + vars declared in wrangler.toml (2026-11 go-live review).
 */
import { describe, expect, it } from 'vitest'
// @ts-expect-error — plain ESM script without type declarations
import { diffConfig, parseWranglerToml } from '../../scripts/check-pages-config-drift.mjs'

const TOML = `
name = "qesto-api"
[vars]
ENV = "production"
INTEGRATION_ENABLED = "true"
COMMIT_SHA = "dev"
[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "x"
[[queues.producers]]
binding = "INSIGHTS_QUEUE"
queue = "qesto-insights"
[[ratelimits]]
name = "RL_JOIN"
[env.dev.vars]
ENV = "dev"
`

describe('Pages config drift check', () => {
  it('parses only top-level vars and bindings', () => {
    const cfg = parseWranglerToml(TOML)
    expect(cfg.vars).toEqual({ ENV: 'production', INTEGRATION_ENABLED: 'true', COMMIT_SHA: 'dev' })
    expect(cfg.bindings.kv).toEqual(['SESSIONS_KV'])
    expect(cfg.bindings.queueProducers).toEqual(['INSIGHTS_QUEUE'])
  })

  it('reports the exact production incident: missing queue + truthy-but-wrong flag', () => {
    const problems = diffConfig(parseWranglerToml(TOML), {
      kv_namespaces: { SESSIONS_KV: {} },
      env_vars: { ENV: { type: 'plain_text', value: 'production' }, INTEGRATION_ENABLED: { type: 'plain_text', value: '1' } },
    })
    expect(problems).toContain('missing Queue producer binding: INSIGHTS_QUEUE')
    expect(problems.some((p: string) => p.startsWith('var mismatch: INTEGRATION_ENABLED'))).toBe(true)
    expect(problems.some((p: string) => p.includes('COMMIT_SHA'))).toBe(false)
  })

  it('passes when the live config matches', () => {
    const problems = diffConfig(parseWranglerToml(TOML), {
      kv_namespaces: { SESSIONS_KV: {} },
      queue_producers: { INSIGHTS_QUEUE: { name: 'qesto-insights' } },
      env_vars: { ENV: { type: 'plain_text', value: 'production' }, INTEGRATION_ENABLED: { type: 'plain_text', value: 'true' } },
    })
    expect(problems).toEqual([])
  })
})
