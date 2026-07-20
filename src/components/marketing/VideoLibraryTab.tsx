// Video Asset Library — R2-backed registry, view/tag/link only (no upload
// endpoint in v1; assets are placed into R2 out-of-band). Preview streams via
// a short-TTL Worker-signed URL.

import { useRef, useState } from 'react'
import { z } from 'zod'
import {
  useVideoAssets,
  useVideoGenModels,
  submitVideoGeneration,
  pollVideoGeneration,
  type VideoAsset,
  type VideoGenJob,
} from '../../hooks/useMarketingApi'
import { Heading, Body, Card, Button, TextInput, EmptyState, SkeletonCard } from '../../ui/components'

const POLL_INTERVAL_MS = 4000

function GenerateVideoPanel({ onDone }: { onDone: () => void }) {
  const { models, loading: modelsLoading } = useVideoGenModels()
  const [model, setModel] = useState('')
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [prompt, setPrompt] = useState('')
  const [job, setJob] = useState<VideoGenJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  async function submit() {
    setError(null)
    setSubmitting(true)
    const res = await submitVideoGeneration({
      model,
      prompt,
      title,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    const jobId = res.data.jobId
    pollRef.current = setInterval(async () => {
      const poll = await pollVideoGeneration(jobId)
      if (!poll.ok) {
        setError(poll.error.message)
        stopPolling()
        return
      }
      setJob(poll.data)
      if (poll.data.status === 'done') {
        stopPolling()
        onDone()
      } else if (poll.data.status === 'failed') {
        stopPolling()
      }
    }, POLL_INTERVAL_MS)
  }

  const busy = submitting || (job !== null && job.status !== 'done' && job.status !== 'failed')

  return (
    <Card className="space-y-3">
      <Body size="s" className="font-medium text-signal-warning">
        Each generated clip may cost several dollars — Cloudflare does not publish per-video pricing for these
        models. Submit only when you intend to spend.
      </Body>
      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        disabled={busy || modelsLoading}
        className="w-full text-body-s border border-pulse-300 dark:border-[#2A3858] rounded-md px-3 py-1.5 bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8]"
        aria-label="Generation model"
      >
        <option value="">Choose a model</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <TextInput value={title} onChange={setTitle} hintText="Title" />
      <TextInput value={tagsInput} onChange={setTagsInput} hintText="Tags (comma-separated)" />
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the clip to generate"
        rows={3}
        disabled={busy}
        className="w-full text-body-s border border-pulse-300 dark:border-[#2A3858] rounded-md px-3 py-2 bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] placeholder:text-pulse-400"
      />
      <Button
        size="sm"
        variant="primary"
        disabled={busy || !model || !title || !prompt}
        onClick={submit}
      >
        Submit
      </Button>
      {job && (
        <Body size="s">
          Status: {job.status}
          {job.status === 'failed' && job.error ? ` — ${job.error}` : ''}
        </Body>
      )}
      {error && <Body size="s" className="text-signal-error">{error}</Body>}
    </Card>
  )
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
}

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function VideoAssetCard({
  asset,
  onUpdate,
  onGetPreviewUrl,
}: {
  asset: VideoAsset
  onUpdate: ReturnType<typeof useVideoAssets>['updateAsset']
  onGetPreviewUrl: ReturnType<typeof useVideoAssets>['getPreviewUrl']
}) {
  let tags: string[] = []
  try {
    // Validate the tags column at the boundary (HLT-031, #686) rather than casting.
    const parsed = z.array(z.string()).safeParse(JSON.parse(asset.tags))
    if (parsed.success) tags = parsed.data
  } catch {
    tags = []
  }

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(asset.title)
  const [tagsInput, setTagsInput] = useState(tags.join(', '))
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewErr, setPreviewErr] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    await onUpdate(asset.id, {
      title,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
    })
    setBusy(false)
    setEditing(false)
  }

  async function preview() {
    setPreviewErr(null)
    const res = await onGetPreviewUrl(asset.id)
    if (res.ok) {
      setPreviewUrl(res.data.url)
    } else {
      setPreviewErr(res.error.message)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
          {asset.category}
        </span>
        <span className="text-xs text-pulse-500 dark:text-[#8A96B0]">
          {formatDuration(asset.duration_sec)} · {formatBytes(asset.size_bytes)}
        </span>
      </div>

      {previewUrl ? (
        <video src={previewUrl} controls className="w-full rounded-md bg-black" />
      ) : (
        <button
          type="button"
          onClick={preview}
          className="w-full rounded-md border border-pulse-300 dark:border-[#2A3858] py-8 text-sm font-medium text-teal-600 dark:text-teal-400 hover:bg-pulse-50 dark:hover:bg-[#0F1526]"
        >
          Load preview
        </button>
      )}
      {previewErr && <Body size="s" className="text-signal-error">{previewErr}</Body>}

      {editing ? (
        <div className="space-y-2">
          <TextInput value={title} onChange={setTitle} hintText="Title" />
          <TextInput value={tagsInput} onChange={setTagsInput} hintText="Tags (comma-separated)" />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={busy} onClick={save}>Save</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <Body size="s" className="font-medium">{asset.title}</Body>
          <div className="flex gap-1.5 flex-wrap">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-pulse-100 dark:bg-[#1C2540] text-pulse-600 dark:text-[#8A96B0]">
                {tag}
              </span>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit title/tags</Button>
        </>
      )}
    </Card>
  )
}

export default function VideoLibraryTab() {
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [showGenerate, setShowGenerate] = useState(false)
  const { assets, loading, error, refresh, updateAsset, getPreviewUrl } = useVideoAssets(
    categoryFilter ? { category: categoryFilter } : {},
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Video Library</Heading>
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-body-s border border-pulse-300 dark:border-[#2A3858] rounded-md px-3 py-1.5 bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8]"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            <option value="product-pipeline">Product pipeline</option>
            <option value="other-recordings">Other recordings</option>
          </select>
          <Button size="sm" variant="secondary" onClick={() => setShowGenerate((v) => !v)}>
            {showGenerate ? 'Cancel' : 'Generate video'}
          </Button>
        </div>
      </div>

      {showGenerate && (
        <GenerateVideoPanel
          onDone={() => {
            setShowGenerate(false)
            void refresh()
          }}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} className="h-64" />
          ))}
        </div>
      ) : error ? (
        <Body className="text-signal-error">{error}</Body>
      ) : assets.length === 0 ? (
        <EmptyState title="No video assets" description="Place videos into the R2 bucket out-of-band, then register them via a follow-up migration." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <VideoAssetCard key={asset.id} asset={asset} onUpdate={updateAsset} onGetPreviewUrl={getPreviewUrl} />
          ))}
        </div>
      )}
    </div>
  )
}
