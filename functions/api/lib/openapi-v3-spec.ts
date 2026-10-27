/**
 * Public API contract — single source of truth (DD-05, issue #878).
 *
 * Documents EVERY `/api/v1`, `/api/v2` and `/api/v3` route. Served at
 * `/api/v3/openapi.json` and `/api/developer/openapi.json` (via the committed
 * `contracts/openapi-v3.json`, kept identical by `npm run check:contracts`),
 * and the input to `npm run contracts:generate` (contracts/generated/api.d.ts).
 *
 * `tests/unit/openapi-coverage.test.ts` enumerates the routes registered in
 * createApp() and fails if any public route is missing here — or if this
 * document describes a route that does not exist. Update both together.
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const json = (schema: object) => ({ 'application/json': { schema } })
const ok = (description: string, data: object) => ({
  description,
  content: json({
    type: 'object',
    required: ['ok', 'data'],
    properties: { ok: { type: 'boolean', const: true }, data },
  }),
})
const errors = (...codes: Array<'400' | '401' | '403' | '404' | '409' | '429' | '503'>) =>
  Object.fromEntries(codes.map((c) => [c, { $ref: `#/components/responses/E${c}` }]))
const sessionIdParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
const pageParams = [
  {
    name: 'limit',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 100 },
  },
  {
    name: 'cursor',
    in: 'query',
    required: false,
    description: 'Opaque `nextCursor` from the previous page (keyset pagination).',
    schema: { type: 'string' },
  },
]
const sessionPage = {
  type: 'object',
  required: ['sessions', 'nextCursor'],
  properties: {
    sessions: { type: 'array', items: ref('Session') },
    nextCursor: { type: ['string', 'null'], description: 'Null on the last page.' },
  },
}
const results = (votesKey: 'vote_counts' | 'votes', sessionSchema: string) => ({
  type: 'object',
  required: ['session', 'questions', votesKey],
  properties: {
    session: ref(sessionSchema),
    questions: { type: 'array', items: ref('QuestionSummary') },
    [votesKey]: { type: 'array', items: ref('VoteCount') },
  },
})
const v1 = { tags: ['v1 (deprecated)'], deprecated: true, security: [{ bearer: [] }] }
const v2 = { tags: ['v2 (deprecated)'], deprecated: true, security: [{ bearer: [] }] }
const v3 = (scope?: 'read' | 'write') => ({ tags: ['v3'], security: [{ bearer: scope ? [scope] : [] }] })

export const OPENAPI_V3_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Qesto Public API',
    version: '3.0.0',
    description:
      'Bearer-authenticated with a team API key (`qesto_` + 32 hex). Rate limit: 120 requests/min per key ' +
      '(429 with Retry-After). v1 sunsets 2026-12-31 and v2 sunsets 2027-06-30 — both send ' +
      '`Deprecation`, `Sunset` and `Link: rel="successor-version"` headers; migrate to v3.',
  },
  servers: [{ url: 'https://qesto.cc/api' }],
  paths: {
    '/v1/sessions': {
      get: {
        ...v1,
        operationId: 'v1ListSessions',
        summary: 'List team sessions (newest first)',
        parameters: pageParams,
        responses: { '200': ok('A page of sessions', sessionPage), ...errors('400', '401', '429') },
      },
    },
    '/v1/sessions/{id}/results': {
      get: {
        ...v1,
        operationId: 'v1SessionResults',
        summary: 'Session results',
        parameters: [sessionIdParam],
        responses: { '200': ok('Results', results('vote_counts', 'Session')), ...errors('401', '404', '429') },
      },
    },
    '/v2/sessions': {
      post: {
        ...v2,
        operationId: 'v2CreateSession',
        summary: 'Create a draft session',
        requestBody: {
          required: false,
          content: json({ type: 'object', properties: { title: { type: 'string', maxLength: 200 } } }),
        },
        responses: {
          '201': ok('Created', {
            type: 'object',
            required: ['id', 'code', 'title', 'status', 'teamId', 'createdAt'],
            properties: {
              id: { type: 'string' },
              code: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string', const: 'draft' },
              teamId: { type: 'string' },
              createdAt: { type: 'integer', description: 'Epoch milliseconds' },
            },
          }),
          ...errors('401', '429'),
        },
      },
    },
    '/v2/sessions/{id}/results': {
      get: {
        ...v2,
        operationId: 'v2SessionResults',
        summary: 'Session results (v2 names the vote array `votes`)',
        parameters: [sessionIdParam],
        responses: { '200': ok('Results', results('votes', 'SessionBasic')), ...errors('401', '404', '429') },
      },
    },
    '/v2/sessions/{id}/realtime': {
      get: {
        ...v2,
        operationId: 'v2SessionRealtime',
        summary: 'WebSocket connection details for a live session',
        parameters: [sessionIdParam],
        responses: {
          '200': ok('Connection details', {
            type: 'object',
            required: ['protocolVersion', 'supportedVersions', 'websocketUrl', 'events'],
            properties: {
              protocolVersion: { type: 'integer', enum: [1, 2] },
              supportedVersions: { type: 'array', items: { type: 'integer' } },
              websocketUrl: { type: 'string', format: 'uri' },
              events: { type: 'array', items: { type: 'string' } },
              note: { type: 'string' },
            },
          }),
          ...errors('401', '404', '409', '429'),
        },
      },
    },
    '/v3/openapi.json': {
      get: {
        ...v3(),
        operationId: 'v3OpenApi',
        summary: 'This document',
        responses: { '200': { description: 'OpenAPI 3.1 document', content: json({ type: 'object' }) }, ...errors('401') },
      },
    },
    '/v3/sessions': {
      get: {
        ...v3('read'),
        operationId: 'v3ListSessions',
        summary: 'List team sessions (newest first)',
        parameters: pageParams,
        responses: {
          '200': ok('A page of sessions', {
            ...sessionPage,
            required: [...sessionPage.required, 'apiVersion'],
            properties: { ...sessionPage.properties, apiVersion: { type: 'integer', const: 3 } },
          }),
          ...errors('400', '401', '403', '429'),
        },
      },
      post: {
        ...v3('write'),
        operationId: 'v3CreateSession',
        summary: 'Create a draft session',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            description: 'Replays return the original response with `X-Idempotent-Replayed: true`.',
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['title'],
            properties: { title: { type: 'string', minLength: 1, maxLength: 200 } },
          }),
        },
        responses: {
          '201': ok('Created', { type: 'object', required: ['session'], properties: { session: ref('Session') } }),
          ...errors('400', '401', '403', '429'),
        },
      },
    },
    '/v3/sessions/{id}/results': {
      get: {
        ...v3('read'),
        operationId: 'v3SessionResults',
        summary: 'Session results',
        parameters: [sessionIdParam],
        responses: {
          '200': ok('Results', results('vote_counts', 'Session')),
          ...errors('401', '403', '404', '429'),
        },
      },
    },
    '/v3/usage': {
      get: {
        ...v3(),
        operationId: 'v3Usage',
        summary: 'API usage for the current metering window',
        responses: {
          '200': ok('Usage', {
            type: 'object',
            required: ['usage', 'quota'],
            properties: {
              usage: {
                type: 'object',
                required: ['teamId', 'windowStart', 'requestCount', 'lastRequestAt'],
                properties: {
                  teamId: { type: 'string' },
                  windowStart: { type: 'integer', description: 'Epoch seconds' },
                  requestCount: { type: 'integer' },
                  lastRequestAt: { type: 'integer', description: 'Epoch milliseconds' },
                },
              },
              quota: {
                type: 'object',
                required: ['requestsPerDay'],
                properties: { requestsPerDay: { type: 'integer' } },
              },
            },
          }),
          ...errors('401', '429', '503'),
        },
      },
    },
    '/v3/residency': {
      get: {
        ...v3(),
        operationId: 'v3Residency',
        summary: 'Data-residency configuration and proof for the team',
        responses: {
          '200': ok('Residency', {
            type: 'object',
            required: ['teamId', 'homeRegion', 'writeBinding', 'effectiveRegion', 'residencyLocked', 'proof'],
            properties: {
              teamId: { type: 'string' },
              homeRegion: { type: 'string' },
              regionLock: { type: ['string', 'null'] },
              writeBinding: { type: 'string' },
              effectiveRegion: { type: 'string' },
              residencyLocked: { type: 'boolean' },
              proof: {
                type: 'object',
                properties: {
                  checkedAt: { type: 'integer' },
                  source: { type: 'string' },
                  multiRegionWritesEnabled: { type: 'boolean' },
                },
              },
            },
          }),
          ...errors('401', '429'),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', description: 'Team API key: `qesto_` + 32 hex characters' },
    },
    schemas: {
      Session: {
        type: 'object',
        required: ['id', 'title', 'status', 'code', 'team_id', 'owner_id', 'created_at', 'closed_at'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'energizing', 'live', 'closed', 'archived'] },
          code: { type: ['string', 'null'] },
          team_id: { type: ['string', 'null'] },
          owner_id: { type: 'string' },
          created_at: { type: 'integer', description: 'Epoch milliseconds' },
          closed_at: { type: ['integer', 'null'] },
        },
      },
      SessionBasic: {
        type: 'object',
        required: ['id', 'team_id', 'title', 'status'],
        properties: {
          id: { type: 'string' },
          team_id: { type: ['string', 'null'] },
          title: { type: 'string' },
          status: { type: 'string' },
        },
      },
      QuestionSummary: {
        type: 'object',
        required: ['id', 'kind', 'prompt'],
        properties: { id: { type: 'string' }, kind: { type: 'string' }, prompt: { type: 'string' } },
      },
      VoteCount: {
        type: 'object',
        required: ['question_id', 'option_id', 'count'],
        properties: {
          question_id: { type: 'string' },
          option_id: { type: 'string' },
          count: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        required: ['ok', 'error'],
        properties: {
          ok: { type: 'boolean', const: false },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
          trace_id: { type: 'string' },
        },
      },
    },
    responses: {
      E400: { description: 'Invalid input', content: json(ref('Error')) },
      E401: { description: 'Missing, malformed or revoked API key', content: json(ref('Error')) },
      E403: { description: 'API key lacks the required scope', content: json(ref('Error')) },
      E404: { description: 'Session not found for this team', content: json(ref('Error')) },
      E409: { description: 'Session is not live', content: json(ref('Error')) },
      E429: {
        description: 'Rate limited — see Retry-After',
        headers: { 'Retry-After': { schema: { type: 'integer' } } },
        content: json(ref('Error')),
      },
      E503: { description: 'Dependency unavailable', content: json(ref('Error')) },
    },
  },
} as const
