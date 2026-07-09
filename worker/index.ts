// Cloudflare Worker entrypoint for Qesto (API only).
// - Delegates HTTP requests to the shared Hono app (functions/api/app.ts).
// - Re-exports the SessionRoom Durable Object class so the platform can bind
//   the class declared in wrangler.toml (CLAUDE.md hard rule 5: DO only for LIVE).
// - Exports TemplateGenerationWorkflow for Cloudflare Workflows.
// The static frontend SPA is deployed separately to Cloudflare Pages.

import { createApp } from '../functions/api/app'
import type { Env } from '../functions/api/types'
import { safeLogContext } from '../functions/api/lib/log'
import { processPostSessionWork } from '../functions/api/lib/queues/consumer'
import type { PostSessionWorkMessage } from '../functions/api/lib/queues/producer'
import { KB_EMBED_MODEL, KB_EMBED_DIM } from '../functions/api/services/kbSearchService'
import { runAI } from '../functions/api/lib/ai/ai-gateway'
import { recomputeStaleWorkspaceTrends } from '../functions/api/lib/workspace-trends'
import { runKvBackup } from '../functions/api/lib/kv-backup'
import { runPulseRetentionPolicy } from '../functions/api/lib/pulse-aggregation'
import { runContentEngine } from '../functions/api/lib/marketing/content-engine'
import { runMentionMonitor } from '../functions/api/lib/marketing/mention-monitor'
import { refreshAllTokens } from '../functions/api/lib/marketing/token-status'

const KB_HEALTH_SENTINEL = 'qesto knowledge base retrieval health probe'

export { SessionRoom } from '../functions/api/SessionRoom'
export { TemplateGenerationWorkflow } from './TemplateGenerationWorkflow'

const app = createApp()

// KB vector retrieval health watchdog (daily 02:00 UTC cron in wrangler.toml).
//
// NOTE: this cron does NOT embed/sync. The real sync runs in CI on
// knowledge-base/ changes (.github/workflows/kb-sync-on-merge.yml → npm run
// kb:sync), because a Worker cannot run the tsx CLI or read git. Instead this
// watchdog verifies retrieval is actually HEALTHY end-to-end: D1 has chunks,
// the query embedding model matches the index dimensions, and the index
// returns matches. (This is exactly the failure mode that silently broke
// retrieval before — a 384-dim query model against a 1024-dim index.)
// Never throws — logs and returns so sibling jobs still run.
async function runKbHealthWatchdog(env: Env): Promise<void> {
  const traceId = `kb-health-${Date.now()}`
  try {
    // 1. How many chunks SHOULD be searchable? D1 is the source of truth that
    //    the embed pipeline writes; the Vectorize index mirrors it.
    const row = await env.DB
      .prepare('SELECT COUNT(*) AS n, MAX(embedded_at) AS last FROM kb_chunks')
      .first<{ n: number; last: number | null }>()
    const chunkCount = row?.n ?? 0
    const lastEmbeddedAt = row?.last ?? 0

    if (chunkCount === 0) {
      safeLogContext(new Error('KB has 0 embedded chunks in D1 — run npm run kb:sync'), {
        traceId,
        route: 'worker/kb-health',
        errorClass: 'KbEmpty',
      })
      return
    }

    // 2. Embed a sentinel with the SAME model the index was built with and
    //    confirm dimensions match. A mismatch means queries cannot retrieve.
    const aiRes = (await runAI(env, KB_EMBED_MODEL, { text: KB_HEALTH_SENTINEL })) as { data?: number[][] }
    const vector = aiRes?.data?.[0]
    if (!Array.isArray(vector) || vector.length !== KB_EMBED_DIM) {
      safeLogContext(
        new Error(`KB query embedding dim ${vector?.length ?? 'none'} != index dim ${KB_EMBED_DIM}`),
        { traceId, route: 'worker/kb-health', errorClass: 'KbEmbedDimMismatch' },
      )
      return
    }

    // 3. Functional probe: a populated index returns at least one match for any
    //    query. Zero matches while D1 has chunks = drift (index empty, stale,
    //    or never synced to production).
    const probe = await env.KB_VECTORIZE.query(vector, { topK: 1 })
    const matchCount = probe.matches?.length ?? 0
    if (matchCount === 0) {
      safeLogContext(
        new Error(`KB drift: D1 has ${chunkCount} chunks but KB_VECTORIZE returned 0 matches`),
        { traceId, route: 'worker/kb-health', errorClass: 'KbVectorDrift' },
      )
      return
    }

    // Healthy. Emit one observability line with a staleness hint.
    const ageDays = lastEmbeddedAt > 0 ? Math.floor((Date.now() - lastEmbeddedAt) / 86_400_000) : -1
    const topScore = probe.matches[0]?.score
    console.log(
      `[kb-health] OK — ${chunkCount} chunks, index responding ` +
        `(top score ${typeof topScore === 'number' ? topScore.toFixed(3) : 'n/a'}), ` +
        `last embed ${ageDays >= 0 ? `${ageDays}d ago` : 'unknown'}`,
    )
  } catch (err) {
    safeLogContext(err, {
      traceId,
      route: 'worker/kb-health',
      errorClass: err instanceof Error ? err.name : 'UnknownError',
    })
  }
}

async function handleScheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
  // Daily 02:00 UTC batch — KB health watchdog, workspace-trend rollup, pulse
  // retention. Gated on the exact cron expression so the other schedules
  // (every-3h mention monitor, etc.) don't re-run these daily jobs.
  if (event.cron === '0 2 * * *') {
    await runKbHealthWatchdog(env)

    // Tier-2 workspace-trend rollup (ADR-0048 §4). Recompute workspace_trend for
    // entitled teams' retro/ideate workspaces that gained a newly closed instance
    // since their last trend, and invalidate the KV read cache. Non-fatal: a
    // failure here must not break the KB watchdog above (mirrors its handling).
    const trendTraceId = `ws-trends-${Date.now()}`
    try {
      const kv = env.ACTIONS_KV ?? env.TEAMS_KV
      const { scanned, recomputed } = await recomputeStaleWorkspaceTrends(env.DB, kv, env.TEAMS_KV)
      console.log(`[ws-trends] OK — scanned ${scanned} stale workspace(s), recomputed ${recomputed}`)
    } catch (err) {
      safeLogContext(err, {
        traceId: trendTraceId,
        route: 'worker/ws-trends',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
      })
    }

    // PULSE-RETENTION-01 — daily GDPR retention (90d redact / 7y delete).
    const pulseTraceId = `pulse-retention-${Date.now()}`
    try {
      const result = await runPulseRetentionPolicy(env.DB)
      console.log(
        `[pulse-retention] OK — redacted ${result.redactedSessions} session row(s), ` +
          `deleted ${result.deletedSessions} session + ${result.deletedDailyRows} daily row(s)`,
      )
    } catch (err) {
      safeLogContext(err, {
        traceId: pulseTraceId,
        route: 'worker/pulse-retention',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
      })
    }
  }

  // OPS-DR-GAP-01 — weekly KV export (AUDIT_KV + ACTIONS_KV → R2). Cron: Sunday 03:00 UTC.
  // Cloudflare day-of-week: 1 = Sunday (see wrangler.toml [triggers]).
  if (event.cron === '0 3 * * 1') {
    const backupTraceId = `kv-backup-${Date.now()}`
    try {
      const results = await runKvBackup(env)
      const summary = results.map((r) => `${r.namespace}:${r.keysExported}→${r.r2Key}`).join(', ')
      console.log(`[kv-backup] OK — ${results.length} batch(es)${summary ? ` — ${summary}` : ' (empty namespaces)'}`)
    } catch (err) {
      safeLogContext(err, {
        traceId: backupTraceId,
        route: 'worker/kv-backup',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
      })
    }
  }

  // Marketing Content Engine — Tue/Thu/Sat 06:00 UTC (3x/week, see ops-cron.ts 'content-engine').
  // Cloudflare day-of-week: 3=Tue, 5=Thu, 7=Sat (1=Sunday; see wrangler.toml [triggers]).
  if (event.cron === '0 6 * * 3,5,7') {
    const traceId = `content-engine-${Date.now()}`
    try {
      const result = await runContentEngine(env.DB, env.AI, env.MARKETING_KV)
      console.log(`[content-engine] OK — ${JSON.stringify(result)}`)
    } catch (err) {
      safeLogContext(err, {
        traceId,
        route: 'worker/content-engine',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
      })
    }
  }

  // Marketing Mention Monitor — every 3h (see ops-cron.ts 'mention-monitor').
  if (event.cron === '0 */3 * * *') {
    const traceId = `mention-monitor-${Date.now()}`
    try {
      await runMentionMonitor(env, env.DB, env.MARKETING_KV)
      console.log('[mention-monitor] OK')
    } catch (err) {
      safeLogContext(err, {
        traceId,
        route: 'worker/mention-monitor',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
      })
    }
  }

  // Marketing OAuth proactive token refresh — daily 04:00 UTC (see ops-cron.ts 'oauth-token-refresh').
  if (event.cron === '0 4 * * *') {
    const traceId = `oauth-token-refresh-${Date.now()}`
    try {
      await refreshAllTokens(env, env.DB, env.INTEGRATIONS_KV)
      console.log('[oauth-token-refresh] OK')
    } catch (err) {
      safeLogContext(err, {
        traceId,
        route: 'worker/oauth-token-refresh',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
      })
    }
  }
}

async function handleQueue(
  batch: MessageBatch<PostSessionWorkMessage>,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  // Phase 2.1: Async post-session work consumer
  // Processes enqueued tasks: insights, Slack/Teams notifications, webhooks, marketing
  // Retries up to max_retries (defined in wrangler.toml); final failures go to DLQ
  const messages = batch.messages || []

  for (const message of messages) {
    try {
      await processPostSessionWork(env, message.body)
      message.ack()
    } catch (err) {
      // Nack to trigger retry (or DLQ after max retries)
      message.nack()
      const sessionId = message.body?.sessionId || 'unknown'
      const taskType = message.body?.taskType || 'unknown'
      safeLogContext(err, {
        traceId: 'queue',
        route: 'worker/queue-consumer',
        sessionId,
        taskType,
        errorClass: err instanceof Error ? err.name : 'UnknownError',
      })
    }
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx)
  },
  scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    return handleScheduled(event, env, ctx)
  },
  queue(batch: MessageBatch<PostSessionWorkMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
    return handleQueue(batch, env, ctx)
  },
} satisfies ExportedHandler<Env>
