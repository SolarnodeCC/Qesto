/**
 * Manual AI video generation for the Video Asset Library's 'other-recordings'
 * category. HTTP-triggered only — NEVER call this from handleScheduled() or
 * register it in CRON_REGISTRY. Cloudflare does not publish per-video pricing
 * for these third-party text-to-video models (Veo/PixVerse/Hailuo/Vidu can
 * run several dollars per clip), and generation is async (30s-5min), so it
 * is gated behind an explicit owner click + a visible cost warning in the UI
 * rather than any automated pipeline.
 *
 * Job state lives in MARKETING_KV ("mktg:video-gen:<jobId>", 24h TTL) rather
 * than a Durable Object — this is a single-owner, manual-trigger, low-
 * frequency feature, so a stateless poll-and-advance read/write on each GET
 * is simpler than standing up DO+alarm machinery for it. None of these
 * third-party models appear in @cloudflare/workers-types' AiModelList, so
 * `ai.run()` falls through to the untyped fallback overload — every field
 * read off its response/the batch-status response is defensive.
 */

import { ulid } from '../ulid'
import { VIDEO_GEN_MODEL_IDS } from './constants'

const JOB_TTL_SEC = 24 * 60 * 60
const KV_PREFIX = 'mktg:video-gen:'

export type VideoGenJobStatus = 'submitted' | 'queued' | 'running' | 'done' | 'failed'

export interface VideoGenJob {
  jobId: string
  model: string
  prompt: string
  title: string
  tags: string[]
  requestId: string
  status: VideoGenJobStatus
  videoAssetId?: string
  error?: string
  createdAt: number
  updatedAt: number
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function jobKey(jobId: string): string {
  return `${KV_PREFIX}${jobId}`
}

export async function submitVideoGeneration(
  ai: Ai,
  kv: KVNamespace,
  params: { model: string; prompt: string; title: string; tags: string[] },
  nowMs: number = Date.now(),
): Promise<{ jobId: string } | { error: string }> {
  if (!VIDEO_GEN_MODEL_IDS.has(params.model)) {
    return { error: `Model "${params.model}" is not in the allowed video-generation model list` }
  }

  const result = (await ai.run(
    params.model,
    { prompt: params.prompt },
    { queueRequest: true } as Parameters<Ai['run']>[2],
  )) as Record<string, unknown>

  const requestId = (result.request_id ?? result.id) as string | undefined
  if (!requestId) {
    return { error: 'Async batch submission did not return a request id (unexpected response shape)' }
  }

  const jobId = ulid(nowMs)
  const job: VideoGenJob = {
    jobId,
    model: params.model,
    prompt: params.prompt,
    title: params.title,
    tags: params.tags,
    requestId,
    status: 'submitted',
    createdAt: nowMs,
    updatedAt: nowMs,
  }
  await kv.put(jobKey(jobId), JSON.stringify(job), { expirationTtl: JOB_TTL_SEC })
  return { jobId }
}

async function failJob(kv: KVNamespace, job: VideoGenJob, error: string, nowMs: number): Promise<VideoGenJob> {
  const failed: VideoGenJob = { ...job, status: 'failed', error, updatedAt: nowMs }
  await kv.put(jobKey(job.jobId), JSON.stringify(failed), { expirationTtl: JOB_TTL_SEC })
  return failed
}

export interface VideoGenStatusResult {
  job: VideoGenJob
  // True only on the single poll where the job transitions into 'done' —
  // lets the route fire one audit event instead of one per subsequent poll.
  justCompleted: boolean
}

export async function getVideoGenerationStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party models aren't in AiModelList; batch status shape is undocumented
  ai: any,
  kv: KVNamespace,
  db: D1Database,
  bucket: R2Bucket,
  jobId: string,
  nowMs: number = Date.now(),
): Promise<VideoGenStatusResult | null> {
  const raw = await kv.get(jobKey(jobId))
  if (!raw) return null
  const job = JSON.parse(raw) as VideoGenJob
  if (job.status === 'done' || job.status === 'failed') return { job, justCompleted: false }

  try {
    const statusResult = (await ai.run(job.model, { requests: [{ request_id: job.requestId }] }, {})) as Record<
      string,
      unknown
    >
    const responses = (statusResult.responses ?? statusResult.results ?? [statusResult]) as Record<
      string,
      unknown
    >[]
    const entry = responses[0] ?? {}
    const remoteStatus = (entry.status ?? entry.state) as string | undefined

    if (remoteStatus === 'complete' || remoteStatus === 'completed' || remoteStatus === 'success') {
      const videoUrl = (entry.url ?? entry.result_url ?? entry.output) as string | undefined
      let bytes: ArrayBuffer
      if (videoUrl) {
        const res = await fetch(videoUrl)
        if (!res.ok) throw new Error(`failed to fetch generated video bytes: HTTP ${res.status}`)
        bytes = await res.arrayBuffer()
      } else if (entry.response instanceof ArrayBuffer) {
        bytes = entry.response
      } else {
        throw new Error('complete batch response had no retrievable video output (unexpected response shape)')
      }

      const id = ulid(nowMs)
      const r2Key = `videos/other-recordings/${id}.mp4`
      await bucket.put(r2Key, bytes)
      await db
        .prepare(
          `INSERT INTO video_assets (id, r2_key, category, title, tags, duration_sec, size_bytes, created_at, updated_at)
           VALUES (?1, ?2, 'other-recordings', ?3, ?4, NULL, ?5, ?6, ?6)`,
        )
        .bind(id, r2Key, job.title, JSON.stringify(job.tags), bytes.byteLength, nowMs)
        .run()

      const done: VideoGenJob = { ...job, status: 'done', videoAssetId: id, updatedAt: nowMs }
      await kv.put(jobKey(job.jobId), JSON.stringify(done), { expirationTtl: JOB_TTL_SEC })
      return { job: done, justCompleted: true }
    }

    if (remoteStatus === 'failed' || remoteStatus === 'error') {
      const detail = (entry.error ?? entry.message ?? 'generation failed') as string
      return { job: await failJob(kv, job, String(detail), nowMs), justCompleted: false }
    }

    // Still queued/running — just touch updatedAt so the UI can show liveness.
    const advanced: VideoGenJob = {
      ...job,
      status: remoteStatus === 'running' ? 'running' : 'queued',
      updatedAt: nowMs,
    }
    await kv.put(jobKey(job.jobId), JSON.stringify(advanced), { expirationTtl: JOB_TTL_SEC })
    return { job: advanced, justCompleted: false }
  } catch (err) {
    // No alarm/retry exists for this job — it must self-terminate on the
    // next poll rather than being left stuck indefinitely.
    return { job: await failJob(kv, job, errMsg(err), nowMs), justCompleted: false }
  }
}
