// WEBHOOK-01 — Generic outbound webhook CRUD + delivery log.
//
// All routes require authentication and team owner/admin role.
//
// Routes (mounted under /api/teams/:id):
//   POST   /api/teams/:id/webhooks                          create webhook
//   GET    /api/teams/:id/webhooks                          list webhooks (secret masked)
//   PATCH  /api/teams/:id/webhooks/:webhookId               update url/events/enabled
//   DELETE /api/teams/:id/webhooks/:webhookId               delete webhook
//   GET    /api/teams/:id/webhooks/:webhookId/deliveries    delivery log (last 50)
//
// Storage: see lib/webhooks.ts. INTEGRATIONS_KV is required; routes return 503
// if the binding is missing.

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import { ulid } from '../lib/ulid'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { validateBody } from '../lib/request-validation'
import { ok, fail } from '../lib/http'
import type { Env } from '../types'
import type { Team } from './teams'
import { validateWebhookTargetUrl } from '../lib/webhook-url'
import {
  KNOWN_WEBHOOK_EVENTS,
  WEBHOOK_LIMIT_PER_TEAM,
  type WebhookConfig,
  type WebhookEvent,
  addToTeamIndex,
  countTeamWebhooks,
  deleteWebhookConfig,
  generateWebhookSecret,
  getWebhookConfig,
  listDeliveries,
  loadTeamWebhooks,
  redactWebhookSecret,
  removeFromTeamIndex,
  saveWebhookConfig,
  hmacSha256Hex,
} from '../lib/webhooks'
import {
  listWebhookDlq,
  retryWebhookDlqEntry,
  buildDlqDeliveryFn,
} from '../lib/webhook-dlq'

type Vars = AuthVariables & PlanVariables

// ─── Validation schemas ──────────────────────────────────────────────────────

const WebhookEventSchema = z.enum(KNOWN_WEBHOOK_EVENTS as readonly [WebhookEvent, ...WebhookEvent[]])

const CreateWebhookSchema = z.object({
  url: z
    .string()
    .url()
    .max(2048)
    .refine((u) => u.startsWith('https://'), { message: 'URL must use https://' }),
  events: z.array(WebhookEventSchema).min(1).max(KNOWN_WEBHOOK_EVENTS.length),
  enabled: z.boolean().optional().default(true),
})

const PatchWebhookSchema = z
  .object({
    url: z
      .string()
      .url()
      .max(2048)
      .refine((u) => u.startsWith('https://'), { message: 'URL must use https://' })
      .optional(),
    events: z.array(WebhookEventSchema).min(1).max(KNOWN_WEBHOOK_EVENTS.length).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => v.url !== undefined || v.events !== undefined || v.enabled !== undefined, {
    message: 'At least one field must be provided',
  })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function integrationsKvOrFail(c: { env: Env }): KVNamespace | null {
  return c.env.INTEGRATIONS_KV ?? null
}

async function loadTeam(kv: KVNamespace, id: string): Promise<Team | null> {
  return readKvJson<Team>(kv, teamDocumentKey(id))
}

/** Returns true if the user is the team owner or has admin role on the team. */
function isOwnerOrAdmin(team: Team, userId: string): boolean {
  if (team.ownerId === userId) return true
  return team.members.some(
    (m) => m.userId === userId && (m.role === 'owner' || m.role === 'admin'),
  )
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export function mountWebhookRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  app.use('*', authMiddleware)

  // POST /api/teams/:id/webhooks — create webhook
  app.post('/:id/webhooks', async (c) => {
    const kv = integrationsKvOrFail(c)
    if (!kv) return fail(c, 'integrations_disabled', 'Integrations KV not configured', 503)

    const user = c.get('user')
    const teamId = c.req.param('id')
    const team = await loadTeam(c.env.TEAMS_KV, teamId)
    if (!team) return fail(c, 'not_found', 'Team not found', 404)
    if (!isOwnerOrAdmin(team, user.sub)) {
      return fail(c, 'forbidden', 'Team owner or admin required', 403)
    }

    const validated = await validateBody(c, CreateWebhookSchema)
    if ('error' in validated) return validated.error
    const { data: body } = validated

    const urlCheck = validateWebhookTargetUrl(body.url)
    if (!urlCheck.ok) {
      return fail(c, urlCheck.code, urlCheck.message, urlCheck.code === 'ssrf_blocked' ? 403 : 400)
    }

    const current = await countTeamWebhooks(kv, teamId)
    if (current >= WEBHOOK_LIMIT_PER_TEAM) {
      return fail(
        c,
        'limit_reached',
        `Maximum ${WEBHOOK_LIMIT_PER_TEAM} webhooks per team`,
        409,
      )
    }

    const now = Date.now()
    const config: WebhookConfig = {
      id: ulid(),
      teamId,
      url: body.url,
      secret: generateWebhookSecret(),
      events: body.events,
      enabled: body.enabled ?? true,
      createdAt: now,
      updatedAt: now,
      createdBy: user.sub,
    }

    await saveWebhookConfig(kv, config)
    await addToTeamIndex(kv, teamId, config.id)

    // Secret returned once on create — never in subsequent reads.
    return ok(c, { webhook: config }, 201)
  })

  // GET /api/teams/:id/webhooks — list webhooks (secret masked)
  app.get('/:id/webhooks', async (c) => {
    const kv = integrationsKvOrFail(c)
    if (!kv) return fail(c, 'integrations_disabled', 'Integrations KV not configured', 503)

    const user = c.get('user')
    const teamId = c.req.param('id')
    const team = await loadTeam(c.env.TEAMS_KV, teamId)
    if (!team) return fail(c, 'not_found', 'Team not found', 404)
    if (!isOwnerOrAdmin(team, user.sub)) {
      return fail(c, 'forbidden', 'Team owner or admin required', 403)
    }

    const configs = await loadTeamWebhooks(kv, teamId)
    return ok(c, { webhooks: configs.map(redactWebhookSecret) })
  })

  // PATCH /api/teams/:id/webhooks/:webhookId — update (url/events/enabled)
  app.patch('/:id/webhooks/:webhookId', async (c) => {
    const kv = integrationsKvOrFail(c)
    if (!kv) return fail(c, 'integrations_disabled', 'Integrations KV not configured', 503)

    const user = c.get('user')
    const teamId = c.req.param('id')
    const webhookId = c.req.param('webhookId')
    const team = await loadTeam(c.env.TEAMS_KV, teamId)
    if (!team) return fail(c, 'not_found', 'Team not found', 404)
    if (!isOwnerOrAdmin(team, user.sub)) {
      return fail(c, 'forbidden', 'Team owner or admin required', 403)
    }

    const existing = await getWebhookConfig(kv, teamId, webhookId)
    if (!existing) return fail(c, 'not_found', 'Webhook not found', 404)

    const validated = await validateBody(c, PatchWebhookSchema)
    if ('error' in validated) return validated.error
    const { data: patch } = validated

    if (patch.url !== undefined) {
      const urlCheck = validateWebhookTargetUrl(patch.url)
      if (!urlCheck.ok) {
        return fail(c, urlCheck.code, urlCheck.message, urlCheck.code === 'ssrf_blocked' ? 403 : 400)
      }
    }

    const next: WebhookConfig = {
      ...existing,
      ...(patch.url !== undefined ? { url: patch.url } : {}),
      ...(patch.events !== undefined ? { events: patch.events } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      updatedAt: Date.now(),
    }

    await saveWebhookConfig(kv, next)
    return ok(c, { webhook: redactWebhookSecret(next) })
  })

  // DELETE /api/teams/:id/webhooks/:webhookId — delete
  app.delete('/:id/webhooks/:webhookId', async (c) => {
    const kv = integrationsKvOrFail(c)
    if (!kv) return fail(c, 'integrations_disabled', 'Integrations KV not configured', 503)

    const user = c.get('user')
    const teamId = c.req.param('id')
    const webhookId = c.req.param('webhookId')
    const team = await loadTeam(c.env.TEAMS_KV, teamId)
    if (!team) return fail(c, 'not_found', 'Team not found', 404)
    if (!isOwnerOrAdmin(team, user.sub)) {
      return fail(c, 'forbidden', 'Team owner or admin required', 403)
    }

    const existing = await getWebhookConfig(kv, teamId, webhookId)
    if (!existing) return fail(c, 'not_found', 'Webhook not found', 404)

    await deleteWebhookConfig(kv, teamId, webhookId)
    await removeFromTeamIndex(kv, teamId, webhookId)
    return ok(c, { deleted: true })
  })

  // GET /api/teams/:id/webhooks/:webhookId/deliveries — admin/owner delivery log
  app.get('/:id/webhooks/:webhookId/deliveries', async (c) => {
    const kv = integrationsKvOrFail(c)
    if (!kv) return fail(c, 'integrations_disabled', 'Integrations KV not configured', 503)

    const user = c.get('user')
    const teamId = c.req.param('id')
    const webhookId = c.req.param('webhookId')
    const team = await loadTeam(c.env.TEAMS_KV, teamId)
    if (!team) return fail(c, 'not_found', 'Team not found', 404)
    if (!isOwnerOrAdmin(team, user.sub)) {
      return fail(c, 'forbidden', 'Team owner or admin required', 403)
    }

    const existing = await getWebhookConfig(kv, teamId, webhookId)
    if (!existing) return fail(c, 'not_found', 'Webhook not found', 404)

    const deliveries = await listDeliveries(kv, webhookId)
    return ok(c, { deliveries })
  })

  // GET /api/teams/:id/webhooks/:webhookId/dlq -- list dead-letter entries
  // ENTERPRISE-POLISH s7b: team owners can inspect failed deliveries
  app.get('/:id/webhooks/:webhookId/dlq', async (c) => {
    const kv = integrationsKvOrFail(c)
    if (!kv) return fail(c, 'integrations_disabled', 'Integrations KV not configured', 503)
    const user = c.get('user')
    const teamId = c.req.param('id')
    const team = await loadTeam(c.env.TEAMS_KV, teamId)
    if (!team) return fail(c, 'not_found', 'Team not found', 404)
    if (!isOwnerOrAdmin(team, user.sub)) return fail(c, 'forbidden', 'Team owner or admin required', 403)
    const entries = await listWebhookDlq(kv, teamId)
    return ok(c, { entries })
  })

  // POST /api/teams/:id/webhooks/:webhookId/dlq/:entryId/retry
  // ENTERPRISE-POLISH s7b: team owners can manually retry a failed delivery
  app.post('/:id/webhooks/:webhookId/dlq/:entryId/retry', async (c) => {
    const kv = integrationsKvOrFail(c)
    if (!kv) return fail(c, 'integrations_disabled', 'Integrations KV not configured', 503)
    const user = c.get('user')
    const teamId = c.req.param('id')
    const webhookId = c.req.param('webhookId')
    const entryId = c.req.param('entryId')
    const team = await loadTeam(c.env.TEAMS_KV, teamId)
    if (!team) return fail(c, 'not_found', 'Team not found', 404)
    if (!isOwnerOrAdmin(team, user.sub)) return fail(c, 'forbidden', 'Team owner or admin required', 403)
    const config = await getWebhookConfig(kv, teamId, webhookId)
    if (!config) return fail(c, 'not_found', 'Webhook not found', 404)
    const deliver = await buildDlqDeliveryFn(
      { url: config.url, secret: config.secret },
      hmacSha256Hex,
    )
    const result = await retryWebhookDlqEntry(kv, teamId, entryId, deliver)
    if (!result.ok) {
      return fail(c, result.reason, result.error ?? result.reason, result.reason === 'entry_not_found' ? 404 : 502)
    }
    return ok(c, { retried: true, delivered: result.delivered })
  })

  parent.route('/api/teams', app)
}
