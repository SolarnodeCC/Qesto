/** Static OpenAPI 3.1 surface for Public API v3 (API-PLAT-OPENAPI-01). */
export const OPENAPI_V3_SPEC = {
  openapi: '3.1.0',
  info: { title: 'Qesto Public API', version: '3.0.0-draft' },
  servers: [{ url: '/api/v3' }],
  paths: {
    '/sessions': {
      get: { summary: 'List team sessions', security: [{ bearer: ['read'] }] },
      post: { summary: 'Create draft session', security: [{ bearer: ['write'] }] },
    },
    '/sessions/{id}/results': {
      get: { summary: 'Session results', security: [{ bearer: ['read'] }] },
    },
    '/openapi.json': { get: { summary: 'This document' } },
  },
  components: {
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', description: 'qesto_* API key' },
    },
  },
} as const
