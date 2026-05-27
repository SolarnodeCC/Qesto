/**
 * FE-DEV2-OAS-01 — published OpenAPI for developer portal v2 (S73).
 */
import { Hono } from 'hono'
import openApiSpec from '../../../contracts/openapi-v3.json'
import type { Env } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountDeveloperPortalRoutes(parent: any) {
  const pub = new Hono<{ Bindings: Env }>()

  pub.get('/openapi.json', (c) =>
    c.json(openApiSpec, 200, {
      'cache-control': 'public, max-age=300',
      'content-type': 'application/json',
    }),
  )

  pub.get('/portal', (c) => {
    const trace_id = (c as { get: (k: string) => string }).get('trace_id') ?? 'unknown'
    return c.json({
      ok: true,
      data: {
        version: '2.0',
        openapiUrl: '/api/developer/openapi.json',
        tryItEnabled: true,
        scopes: ['read', 'write', 'admin'],
      },
      trace_id,
    })
  })

  parent.route('/api/developer', pub)
}
