// Video Asset Library — R2-backed registry, view/tag/link only (no upload
// endpoint in v1; assets are placed into R2 out-of-band). Preview streams via
// a short-TTL Worker-signed URL.

import { useState } from 'react'
import { useVideoAssets, type VideoAsset } from '../../hooks/useMarketingApi'
import { Heading, Body, Card, Button, TextInput, EmptyState, SkeletonCard } from '../../ui/components'

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
    tags = JSON.parse(asset.tags) as string[]
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
          className="w-full rounded-md border border-pulse-300 dark:border-[#2A3858] py-6 text-sm font-medium text-teal-600 dark:text-teal-400 hover:bg-pulse-50 dark:hover:bg-[#0F1526]"
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
  const { assets, loading, error, updateAsset, getPreviewUrl } = useVideoAssets(
    categoryFilter ? { category: categoryFilter } : {},
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Video Library</Heading>
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
      </div>

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
