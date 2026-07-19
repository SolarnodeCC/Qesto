// Marketing Review Dashboard — thin wrappers over `api<T>()` for the 5
// /api/marketing/* endpoint groups (content-items, mentions, calendar,
// video-assets, oauth-status). Mirrors useAdminOps/useAdminMetrics shape:
// one-shot fetch + manual refresh, mutation helpers re-fetch on success.

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

export type ContentItemPlatform = 'linkedin' | 'youtube'
export type ContentItemStatus = 'draft' | 'approved' | 'rejected' | 'published' | 'failed'

export interface ContentItem {
  id: string
  content_calendar_id: string
  platform: ContentItemPlatform
  status: ContentItemStatus
  body: string | null
  script: string | null
  metadata: string
  video_asset_id: string | null
  youtube_video_id: string | null
  generated_at: number
  reviewed_at: number | null
  published_at: number | null
  platform_post_id: string | null
  failure_reason: string | null
  created_at: number
  updated_at: number
}

export type MentionPlatform = 'linkedin' | 'reddit' | 'youtube'

export interface Mention {
  id: string
  platform: MentionPlatform
  source_id: string
  author: string | null
  body: string
  url: string | null
  reviewed: number
  fetched_at: number
  posted_at: number | null
  created_at: number
}

export type CalendarStatus = 'planned' | 'generated' | 'skipped'

export interface CalendarItem {
  id: string
  platform: ContentItemPlatform
  topic: string
  scheduled_for: number
  status: CalendarStatus
  video_asset_id: string | null
  notes: string | null
  created_at: number
  updated_at: number
}

export type VideoCategory = 'product-pipeline' | 'other-recordings'

export interface VideoAsset {
  id: string
  r2_key: string
  category: VideoCategory
  title: string
  tags: string
  duration_sec: number | null
  size_bytes: number | null
  created_at: number
  updated_at: number
}

export interface TokenStatusRow {
  platform: MentionPlatform
  connected: number
  expires_at: number | null
  last_refreshed_at: number | null
  last_refresh_error: string | null
  updated_at: number
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (entries.length === 0) return ''
  return `?${new URLSearchParams(entries as [string, string][]).toString()}`
}

// ─── Content Items ───────────────────────────────────────────────────────────

export function useContentItems(filter: { status?: string; platform?: string } = {}) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await api<{ items: ContentItem[] }>(`/api/marketing/content-items${qs(filter)}`)
    if (res.ok) {
      setItems(res.data.items)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [filter.status, filter.platform])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const patchItem = useCallback(
    async (id: string, fields: Partial<Pick<ContentItem, 'body' | 'script' | 'youtube_video_id'>>) => {
      const res = await api<{ id: string }>(`/api/marketing/content-items/${id}`, { method: 'PATCH', body: fields })
      if (res.ok) await refresh()
      return res
    },
    [refresh],
  )

  const approve = useCallback(
    async (id: string) => {
      const res = await api<{ id: string }>(`/api/marketing/content-items/${id}/approve`, { method: 'POST' })
      if (res.ok) await refresh()
      return res
    },
    [refresh],
  )

  const reject = useCallback(
    async (id: string) => {
      const res = await api<{ id: string }>(`/api/marketing/content-items/${id}/reject`, { method: 'POST' })
      if (res.ok) await refresh()
      return res
    },
    [refresh],
  )

  const publish = useCallback(
    async (id: string) => {
      const res = await api<{ id: string }>(`/api/marketing/content-items/${id}/publish`, { method: 'POST' })
      if (res.ok) await refresh()
      return res
    },
    [refresh],
  )

  return { items, loading, error, refresh, patchItem, approve, reject, publish }
}

// ─── Mentions ────────────────────────────────────────────────────────────────

export function useMentions(filter: { platform?: string; reviewed?: string } = {}) {
  const [mentions, setMentions] = useState<Mention[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await api<{ mentions: Mention[] }>(`/api/marketing/mentions${qs(filter)}`)
    if (res.ok) {
      setMentions(res.data.mentions)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [filter.platform, filter.reviewed])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const markReviewed = useCallback(
    async (id: string, reviewed: boolean) => {
      const res = await api<{ id: string }>(`/api/marketing/mentions/${id}`, { method: 'PATCH', body: { reviewed } })
      if (res.ok) await refresh()
      return res
    },
    [refresh],
  )

  return { mentions, loading, error, refresh, markReviewed }
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export function useCalendar(filter: { status?: string } = {}) {
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await api<{ items: CalendarItem[] }>(`/api/marketing/calendar${qs(filter)}`)
    if (res.ok) {
      setItems(res.data.items)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [filter.status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (fields: { platform: ContentItemPlatform; topic: string; scheduled_for: number; notes?: string }) => {
      const res = await api<{ id: string }>('/api/marketing/calendar', { method: 'POST', body: fields })
      if (res.ok) await refresh()
      return res
    },
    [refresh],
  )

  const updateItem = useCallback(
    async (id: string, fields: Partial<Pick<CalendarItem, 'topic' | 'scheduled_for' | 'notes' | 'video_asset_id'>>) => {
      const res = await api<{ id: string }>(`/api/marketing/calendar/${id}`, { method: 'PATCH', body: fields })
      if (res.ok) await refresh()
      return res
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      const res = await api<{ id: string }>(`/api/marketing/calendar/${id}`, { method: 'DELETE' })
      if (res.ok) await refresh()
      return res
    },
    [refresh],
  )

  return { items, loading, error, refresh, create, update: updateItem, remove }
}

// ─── Video Assets ────────────────────────────────────────────────────────────

export function useVideoAssets(filter: { category?: string; tag?: string } = {}) {
  const [assets, setAssets] = useState<VideoAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await api<{ assets: VideoAsset[] }>(`/api/marketing/video-assets${qs(filter)}`)
    if (res.ok) {
      setAssets(res.data.assets)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [filter.category, filter.tag])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updateAsset = useCallback(
    async (id: string, fields: { title?: string; tags?: string[] }) => {
      const res = await api<{ id: string }>(`/api/marketing/video-assets/${id}`, { method: 'PATCH', body: fields })
      if (res.ok) await refresh()
      return res
    },
    [refresh],
  )

  const getPreviewUrl = useCallback(async (id: string) => {
    return api<{ url: string; expires_in: number }>(`/api/marketing/video-assets/${id}/preview-url`)
  }, [])

  return { assets, loading, error, refresh, updateAsset, getPreviewUrl }
}

// ─── Video generation (manual, never cron-triggered) ─────────────────────────

export interface VideoGenModel {
  id: string
  label: string
}

export type VideoGenJobStatus = 'submitted' | 'queued' | 'running' | 'done' | 'failed'

export interface VideoGenJob {
  jobId: string
  model: string
  prompt: string
  title: string
  tags: string[]
  status: VideoGenJobStatus
  videoAssetId?: string
  error?: string
  createdAt: number
  updatedAt: number
}

export function useVideoGenModels() {
  const [models, setModels] = useState<VideoGenModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await api<{ models: VideoGenModel[] }>('/api/marketing/video-assets/generate/models')
    if (res.ok) {
      setModels(res.data.models)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { models, loading, error, refresh }
}

export async function submitVideoGeneration(fields: { model: string; prompt: string; title: string; tags: string[] }) {
  return api<{ jobId: string }>('/api/marketing/video-assets/generate', { method: 'POST', body: fields })
}

export async function pollVideoGeneration(jobId: string) {
  return api<VideoGenJob>(`/api/marketing/video-assets/generate/${jobId}`)
}

// ─── OAuth status ────────────────────────────────────────────────────────────

export function useOauthStatus() {
  const [platforms, setPlatforms] = useState<TokenStatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await api<{ platforms: TokenStatusRow[] }>('/api/marketing/oauth-status')
    if (res.ok) {
      setPlatforms(res.data.platforms)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { platforms, loading, error, refresh }
}
