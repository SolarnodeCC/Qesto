// Marketing Review Dashboard — Video Asset Library (R2-backed registry,
// view/tag/link only — no upload endpoint in v1; assets are placed into R2
// out-of-band). Preview streaming uses a Worker-signed HMAC token instead of
// native R2 presigned URLs (this repo has no S3-credential plumbing) — the
// `/stream` route is exempt from session auth because the token IS the auth.

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { marketingOwnerMiddleware, type MarketingOwnerVariables } from '../../middleware/marketing-owner'
import { validateBody } from '../../lib/request-validation'
import { recordAuditEvent } from '../../lib/audit'
import {
  listVideoAssets,
  getVideoAsset,
  updateVideoAssetTags,
  signPreviewUrl,
  verifyPreviewToken,
  streamVideoAsset,
} from '../../lib/marketing/video-assets'
import type { Env } from '../../types'

type App = Hono<{ Bindings: Env; Variables: AuthVariables & MarketingOwnerVariables }>

const PREVIEW_TTL_SEC = 300

export function mountVideoAssetsRoutes(app: App) {
  app.get('/video-assets', authMiddleware, marketingOwnerMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const category = c.req.query('category')
    const tag = c.req.query('tag')
    const filter: { category?: string; tag?: string } = {}
    if (category) filter.category = category
    if (tag) filter.tag = tag
    const assets = await listVideoAssets(c.env.DB, filter)
    return c.json({ ok: true, data: { assets }, trace_id }, 200)
  })

  const PatchVideoAsset = z.object({
    title: z.string().min(1).max(200).optional(),
    tags: z.array(z.string().max(60)).max(20).optional(),
  })
  app.patch('/video-assets/:id', authMiddleware, marketingOwnerMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const id = c.req.param('id')
    const validated = await validateBody(c, PatchVideoAsset)
    if ('error' in validated) return validated.error
    const fields: { title?: string; tags?: string[] } = {}
    if (validated.data.title !== undefined) fields.title = validated.data.title
    if (validated.data.tags !== undefined) fields.tags = validated.data.tags
    const updated = await updateVideoAssetTags(c.env.DB, id, fields)
    if (!updated) {
      return c.json({ ok: false, error: { code: 'not_found_or_noop', message: 'Video asset not found or no fields to update' }, trace_id }, 404)
    }
    await recordAuditEvent(c, { action: 'marketing.video_asset_update', subject_type: 'video_asset', subject_id: id, trace_id })
    return c.json({ ok: true, data: { id }, trace_id }, 200)
  })

  app.get('/video-assets/:id/preview-url', authMiddleware, marketingOwnerMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const id = c.req.param('id')
    const signingKey = c.env.VIDEO_PREVIEW_SIGNING_KEY
    if (!signingKey) return c.json({ ok: false, error: { code: 'unavailable', message: 'VIDEO_PREVIEW_SIGNING_KEY not configured' }, trace_id }, 503)
    const asset = await getVideoAsset(c.env.DB, id)
    if (!asset) return c.json({ ok: false, error: { code: 'not_found', message: 'Video asset not found' }, trace_id }, 404)
    const apiBaseUrl = new URL(c.req.url).origin
    const url = await signPreviewUrl(signingKey, apiBaseUrl, id, PREVIEW_TTL_SEC)
    return c.json({ ok: true, data: { url, expires_in: PREVIEW_TTL_SEC }, trace_id }, 200)
  })

  // No authMiddleware/marketingOwnerMiddleware — the signed token IS the auth
  // for this one route (path added to SESSION_AUTH_EXEMPT).
  app.get('/video-assets/:id/stream', async (c) => {
    const trace_id = c.get('trace_id')
    const id = c.req.param('id')
    const signingKey = c.env.VIDEO_PREVIEW_SIGNING_KEY
    const token = c.req.query('token')
    if (!signingKey || !token) return c.json({ ok: false, error: { code: 'unauthorized', message: 'Missing or unconfigured preview token' }, trace_id }, 401)
    const valid = await verifyPreviewToken(signingKey, id, token)
    if (!valid) return c.json({ ok: false, error: { code: 'unauthorized', message: 'Invalid or expired preview token' }, trace_id }, 401)

    const bucket = c.env.R2_VIDEOS
    if (!bucket) return c.json({ ok: false, error: { code: 'unavailable', message: 'R2_VIDEOS not configured' }, trace_id }, 503)
    const asset = await getVideoAsset(c.env.DB, id)
    if (!asset) return c.json({ ok: false, error: { code: 'not_found', message: 'Video asset not found' }, trace_id }, 404)
    return streamVideoAsset(bucket, asset.r2_key)
  })
}
