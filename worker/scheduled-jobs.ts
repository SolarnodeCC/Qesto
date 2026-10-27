// Scheduled job registry for the qesto-api Worker (DD-32, issue #904).
// Kept out of worker/index.ts so it can be unit-tested without importing the
// Workflow entrypoint (`cloudflare:workers`).

import type { Env } from '../functions/api/types'
import { safeLogContext } from '../functions/api/lib/log'
import { alertCritical } from '../functions/api/lib/alerts'
import type { ScheduledJob } from '../functions/api/lib/scheduled-dispatch'
import { KB_EMBED_MODEL, KB_EMBED_DIM } from '../functions/api/services/kbSearchService'
import { runAI } from '../functions/api/lib/ai/ai-gateway'
import { recomputeStaleWorkspaceTrends } from '../functions/api/lib/workspace-trends'
import { runKvBackup } from '../functions/api/lib/kv-backup'
import { runPulseRetentionPolicy } from '../functions/api/lib/pulse-aggregation'
import { runContentEngine } from '../functions/api/lib/marketing/content-engine'
import { refreshAllTokens } from '../functions/api/lib/marketing/token-status'

const KB_HEALTH_SENTINEL = 'qesto knowledge base retrieval health probe'

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
export async function runKbHealthWatchdog(env: Env): Promise<void> {
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
    await alertCritical(env, 'worker/kb-health', err instanceof Error ? err.name : 'KbHealthFailed', {
      traceId,
      errorClass: err instanceof Error ? err.name : 'KbHealthFailed',
    })
  }
}

// DD-32: every scheduled job is a row; see lib/scheduled-dispatch.ts. Cron
// expressions must match wrangler.toml [triggers].crons exactly (Cloudflare
// day-of-week is 1=Sunday … 7=Saturday) — tests/unit/scheduled-dispatch.test.ts
// pins the two together and the 5-trigger ceiling.
export const SCHEDULED_JOBS: readonly ScheduledJob[] = [
  // Daily 02:00 UTC batch.
  {
    key: 'kb-watchdog',
    cron: '0 2 * * *',
    run: async (env) => {
      await runKbHealthWatchdog(env)
    },
  },
  {
    // Tier-2 workspace-trend rollup (ADR-0048 §4).
    key: 'ws-trends',
    cron: '0 2 * * *',
    run: async (env) => {
      const kv = env.ACTIONS_KV ?? env.TEAMS_KV
      const { scanned, recomputed } = await recomputeStaleWorkspaceTrends(env.DB, kv, env.TEAMS_KV, env)
      return `scanned ${scanned} stale workspace(s), recomputed ${recomputed}`
    },
  },
  {
    // PULSE-RETENTION-01 — daily GDPR retention (90d redact / 7y delete).
    key: 'pulse-retention',
    cron: '0 2 * * *',
    run: async (env) => {
      const r = await runPulseRetentionPolicy(env.DB)
      return `redacted ${r.redactedSessions} session row(s), deleted ${r.deletedSessions} session + ${r.deletedDailyRows} daily row(s)`
    },
  },
  {
    // OPS-DR-GAP-01 — weekly KV export (AUDIT_KV + ACTIONS_KV → R2), Sunday 03:00 UTC.
    key: 'kv-backup',
    cron: '0 3 * * 1',
    run: async (env) => {
      const results = await runKvBackup(env)
      const summary = results.map((r) => `${r.namespace}:${r.keysExported}→${r.r2Key}`).join(', ')
      return `${results.length} batch(es)${summary ? ` — ${summary}` : ' (empty namespaces)'}`
    },
  },
  {
    // Marketing Content Engine — Tue/Thu/Sat 06:00 UTC (ops-cron.ts 'content-engine').
    key: 'content-engine',
    cron: '0 6 * * 3,5,7',
    run: async (env) => JSON.stringify(await runContentEngine(env.DB, env.AI, env.MARKETING_KV, Date.now(), env)),
  },
  {
    // Marketing OAuth proactive token refresh — daily 04:00 UTC.
    key: 'oauth-token-refresh',
    cron: '0 4 * * *',
    run: async (env) => {
      await refreshAllTokens(env, env.DB, env.INTEGRATIONS_KV)
    },
  },
  // Mention Monitor (Reddit/YouTube) intentionally absent — not connected (#941).
]
