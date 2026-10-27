/**
 * Requirement: issue #878 (DD-05) — the public API contract must describe the
 * routes that actually exist. The previous drift check only compared the
 * committed JSON with the constant it was generated from, so it passed on an
 * empty spec. This test enumerates every registered /api/v1, /api/v2 and
 * /api/v3 route and requires a spec operation for each — and no spec
 * operation for a route that does not exist.
 */
import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { OPENAPI_V3_SPEC } from '../../functions/api/lib/openapi-v3-spec'

const PUBLIC_PREFIX = /^\/api\/v[123]\//

function registeredOperations(): Set<string> {
  const ops = new Set<string>()
  for (const r of createApp().routes) {
    if (r.method === 'ALL' || !PUBLIC_PREFIX.test(r.path)) continue
    // Hono `:id` → OpenAPI `{id}`, relative to the `/api` server URL.
    ops.add(`${r.method.toLowerCase()} ${r.path.replace(/^\/api/, '').replace(/:([A-Za-z_]+)/g, '{$1}')}`)
  }
  return ops
}

function documentedOperations(): Set<string> {
  const ops = new Set<string>()
  for (const [path, item] of Object.entries(OPENAPI_V3_SPEC.paths)) {
    for (const method of Object.keys(item)) ops.add(`${method} ${path}`)
  }
  return ops
}

describe('public API contract coverage (DD-05)', () => {
  const registered = registeredOperations()
  const documented = documentedOperations()

  it('finds the public routes', () => {
    expect(registered.size).toBeGreaterThanOrEqual(10)
  })

  it('every registered public route is documented', () => {
    expect([...registered].filter((op) => !documented.has(op))).toEqual([])
  })

  it('every documented operation exists', () => {
    expect([...documented].filter((op) => !registered.has(op))).toEqual([])
  })

  it('every operation declares responses and an operationId', () => {
    for (const item of Object.values(OPENAPI_V3_SPEC.paths)) {
      for (const op of Object.values(item) as Array<{ operationId?: string; responses?: object }>) {
        expect(op.operationId).toBeTruthy()
        expect(Object.keys(op.responses ?? {})).not.toHaveLength(0)
      }
    }
  })
})
