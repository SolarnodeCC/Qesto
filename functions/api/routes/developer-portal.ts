/**
 * FE-DEV2-OAS-01 — published OpenAPI for developer portal v2 (S73).
 */
import { Hono } from 'hono'
import openApiSpec from '../../../contracts/openapi-v3.json'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

export function mountDeveloperPortalRoutes(parent: ParentApp) {
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
        scopes: [
          'read', 'write', 'admin',
          'read:sessions', 'read:results', 'read:insights', 'read:team',
          'write:sessions', 'write:votes', 'write:webhooks', 'write:exports',
        ],
      },
      trace_id,
    })
  })

  // GET /api/developer/docs -- Redoc UI for the OpenAPI spec.
  // ENTERPRISE-POLISH s12a: publicly hosted, auto-updated on deploy.
  pub.get('/docs', (c) => {
    const specUrl = '/api/developer/openapi.json'
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Qesto API Reference</title>
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet" />
  <style>body { margin: 0; padding: 0; }</style>
</head>
<body>
  <redoc spec-url='${specUrl}' expand-responses='200,201' required-props-first='true'></redoc>
  <script src="https://cdn.jsdelivr.net/npm/redoc@2.1.3/bundles/redoc.standalone.js"></script>
</body>
</html>`
    return c.html(html, 200, {
      'cache-control': 'public, max-age=300',
    })
  })

  parent.route('/api/developer', pub)
}
