/**
 * Video Asset Library — D1 CRUD-lite (no upload endpoint, v1). Preview is
 * served via a Worker-signed HMAC token rather than native R2 presigned URLs
 * (this repo has no S3-credential/aws4fetch plumbing, only binding-based R2
 * access). `signPreviewUrl` mints a short-TTL same-origin URL; the sibling
 * `/stream` route validates the HMAC and streams `bucket.get(key)` — that
 * token IS the auth for that one route (added to SESSION_AUTH_EXEMPT).
 */

import { z } from 'zod'
import { hmacSign, timingSafeEqual } from '../shared/crypto'
import { decodeKvJson } from '../boundary-decode'

export interface VideoAssetRow {
  id: string
  r2_key: string
  category: 'product-pipeline' | 'other-recordings'
  title: string
  tags: string // JSON string[]
  duration_sec: number | null
  size_bytes: number | null
  created_at: number
  updated_at: number
}

export async function listVideoAssets(
  db: D1Database,
  filter: { category?: string; tag?: string } = {},
): Promise<VideoAssetRow[]> {
  if (filter.category) {
    const res = await db
      .prepare(`SELECT * FROM video_assets WHERE category = ?1 ORDER BY created_at DESC`)
      .bind(filter.category)
      .all<VideoAssetRow>()
    return res.results ?? []
  }
  const res = await db.prepare(`SELECT * FROM video_assets ORDER BY created_at DESC`).all<VideoAssetRow>()
  const rows = res.results ?? []
  if (!filter.tag) return rows
  return rows.filter(
    // Validate the D1 JSON tags column at the boundary (HLT-031, #686).
    (r) => decodeKvJson(r.tags, z.array(z.string()))?.includes(filter.tag!) ?? false,
  )
}

export async function getVideoAsset(db: D1Database, id: string): Promise<VideoAssetRow | null> {
  return db.prepare(`SELECT * FROM video_assets WHERE id = ?1`).bind(id).first<VideoAssetRow>()
}

export async function updateVideoAssetTags(
  db: D1Database,
  id: string,
  fields: { title?: string; tags?: string[] },
  nowMs: number = Date.now(),
): Promise<boolean> {
  const sets: string[] = []
  const binds: unknown[] = []
  let i = 1
  if (fields.title !== undefined) {
    sets.push(`title = ?${i++}`)
    binds.push(fields.title)
  }
  if (fields.tags !== undefined) {
    sets.push(`tags = ?${i++}`)
    binds.push(JSON.stringify(fields.tags))
  }
  if (sets.length === 0) return false
  sets.push(`updated_at = ?${i++}`)
  binds.push(nowMs)
  binds.push(id)
  const res = await db
    .prepare(`UPDATE video_assets SET ${sets.join(', ')} WHERE id = ?${i}`)
    .bind(...binds)
    .run()
  return (res.meta.changes ?? 0) > 0
}

interface PreviewTokenPayload {
  id: string
  exp: number
}

export async function signPreviewUrl(
  signingKey: string,
  apiBaseUrl: string,
  videoAssetId: string,
  ttlSec: number,
): Promise<string> {
  const payload: PreviewTokenPayload = { id: videoAssetId, exp: Date.now() + ttlSec * 1000 }
  const payloadStr = JSON.stringify(payload)
  const payloadB64 = btoa(payloadStr)
  const sig = await hmacSign(signingKey, payloadB64)
  const url = new URL(`/api/marketing/video-assets/${videoAssetId}/stream`, apiBaseUrl)
  url.searchParams.set('token', `${payloadB64}.${sig}`)
  return url.toString()
}

export async function verifyPreviewToken(
  signingKey: string,
  videoAssetId: string,
  token: string,
): Promise<boolean> {
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return false
  const expectedSig = await hmacSign(signingKey, payloadB64)
  if (!timingSafeEqual(sig, expectedSig)) return false
  let payload: PreviewTokenPayload
  try {
    payload = JSON.parse(atob(payloadB64)) as PreviewTokenPayload
  } catch {
    return false
  }
  if (payload.id !== videoAssetId) return false
  if (payload.exp < Date.now()) return false
  return true
}

export async function streamVideoAsset(bucket: R2Bucket, r2Key: string): Promise<Response> {
  const obj = await bucket.get(r2Key)
  if (!obj) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  return new Response(obj.body, { headers })
}
