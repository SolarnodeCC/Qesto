/**
 * Qesto LinkedIn auto-posting cron Worker (standalone).
 *
 * Cron (wrangler.toml): Tue & Thu 09:00 UTC. On each run:
 *   1. Load the encrypted org token; refresh proactively if near/past expiry.
 *   2. Pick the current topic (rotating) and language (default English).
 *   3. Generate the post via Workers AI (@cf/meta/llama-3.1-8b-instruct).
 *   4. Publish to the company page via /v2/ugcPosts.
 *   5. Log to D1 linkedin_posts (status 'posted' | 'error'); advance the topic
 *      index only on success. Non-2xx → log error, NO retry (next cron handles it).
 *
 * Zero new npm deps — reuses the in-repo EncryptedTokenStore + linkedin helpers.
 */

import { ulid } from '../../functions/api/lib/ulid'
import { runAI } from '../../functions/api/lib/ai/ai-gateway'
import { createEncryptedTokenStore } from '../../functions/api/lib/integrations/token-store'
import {
  buildPostPrompt,
  clampPost,
  publishUgcPost,
  refreshAccessToken,
  DEFAULT_LANGUAGE,
  DEFAULT_TOPICS,
  KV_LANGUAGE,
  KV_ORG_URN,
  KV_TOPICS,
  KV_TOPIC_INDEX,
  LINKEDIN_SERVICE,
  LINKEDIN_TEAM_SCOPE,
  REFRESH_WINDOW_MS,
} from '../../functions/api/lib/linkedin'

export interface SchedulerEnv {
  ENV?: string
  AI: Ai
  DB: D1Database
  LINKEDIN_KV: KVNamespace
  OAUTH_TOKEN_MEK?: string
  LINKEDIN_CLIENT_ID?: string
  LINKEDIN_CLIENT_SECRET?: string
}

const LOG_PREFIX = '[linkedin-cron]'

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function logPost(env: SchedulerEnv, content: string, status: 'posted' | 'error'): Promise<void> {
  try {
    await env.DB.prepare('INSERT INTO linkedin_posts (id, content, posted_at, status) VALUES (?1, ?2, ?3, ?4)')
      .bind(ulid(), content.slice(0, 4000), Date.now(), status)
      .run()
  } catch (err) {
    console.error(`${LOG_PREFIX} D1 log failed:`, errMsg(err))
  }
}

function parseTopics(raw: string | null): string[] {
  if (!raw) return DEFAULT_TOPICS
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const topics = parsed.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      if (topics.length > 0) return topics
    }
  } catch {
    /* fall through to default */
  }
  return DEFAULT_TOPICS
}

function parseIndex(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : 0
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export async function runScheduled(env: SchedulerEnv): Promise<void> {
  if (!env.LINKEDIN_KV || !env.DB || !env.AI) {
    console.error(`${LOG_PREFIX} missing bindings (LINKEDIN_KV/DB/AI)`)
    return
  }

  const store = createEncryptedTokenStore(env.LINKEDIN_KV, env)
  const stored = await store.getStoredToken(LINKEDIN_TEAM_SCOPE, LINKEDIN_SERVICE)
  if (!stored) {
    console.log(`${LOG_PREFIX} not connected — run the OAuth flow at /linkedin-auth`)
    return
  }

  // 1. Refresh proactively when within the safety window or already expired.
  let accessToken = stored.access_token
  const needsRefresh = stored.expires_at !== undefined && stored.expires_at - Date.now() < REFRESH_WINDOW_MS
  if (needsRefresh) {
    if (!stored.refresh_token || !env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
      await logPost(env, 'token refresh required but refresh_token or client credentials missing', 'error')
      return
    }
    try {
      const refreshed = await refreshAccessToken(
        { LINKEDIN_CLIENT_ID: env.LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET: env.LINKEDIN_CLIENT_SECRET },
        stored.refresh_token,
      )
      // LinkedIn may omit a new refresh_token — keep the existing one.
      if (!refreshed.refresh_token) refreshed.refresh_token = stored.refresh_token
      await store.storeToken(LINKEDIN_TEAM_SCOPE, LINKEDIN_SERVICE, refreshed)
      accessToken = refreshed.access_token
    } catch (err) {
      await logPost(env, `token refresh failed: ${errMsg(err)}`, 'error')
      return
    }
  }

  const orgUrn = await env.LINKEDIN_KV.get(KV_ORG_URN)
  if (!orgUrn) {
    await logPost(env, 'no linkedin:org_urn configured — set it via the OAuth page or KV', 'error')
    return
  }

  // 2. Topic rotation + language.
  const topics = parseTopics(await env.LINKEDIN_KV.get(KV_TOPICS))
  const index = parseIndex(await env.LINKEDIN_KV.get(KV_TOPIC_INDEX))
  const language = (await env.LINKEDIN_KV.get(KV_LANGUAGE)) || DEFAULT_LANGUAGE
  const topic = topics[index % topics.length] ?? topics[0]!

  // 3. Generate.
  let text: string
  try {
    const { system, user } = buildPostPrompt(topic, language)
    const result = (await runAI(env, '@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })) as { response?: string }
    text = clampPost(result.response ?? '')
    if (!text) throw new Error('empty AI response')
  } catch (err) {
    await logPost(env, `AI generation failed for "${topic}": ${errMsg(err)}`, 'error')
    return
  }

  // 4. Publish.
  const res = await publishUgcPost(accessToken, orgUrn, text)
  if (!res.ok) {
    await logPost(env, `LinkedIn ugcPosts HTTP ${res.status}: ${res.detail}`, 'error')
    return // no retry — next cron handles the next slot
  }

  // 5. Success: log + advance rotation.
  await logPost(env, text, 'posted')
  await env.LINKEDIN_KV.put(KV_TOPIC_INDEX, String((index + 1) % topics.length))
  console.log(`${LOG_PREFIX} posted topic "${topic}" (${text.length} chars)`)
}

export default {
  async scheduled(_controller: ScheduledController, env: SchedulerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduled(env))
  },

  // Read-only health endpoint (does NOT post). Use `wrangler dev --test-scheduled`
  // or the dev `/__scheduled` route to exercise the cron path manually.
  async fetch(_request: Request, env: SchedulerEnv): Promise<Response> {
    const store = createEncryptedTokenStore(env.LINKEDIN_KV, env)
    const stored = await store.getStoredToken(LINKEDIN_TEAM_SCOPE, LINKEDIN_SERVICE).catch(() => null)
    const orgUrn = await env.LINKEDIN_KV.get(KV_ORG_URN).catch(() => null)
    return Response.json({
      service: 'qesto-linkedin-scheduler',
      connected: stored !== null,
      org_urn: orgUrn,
      token_expires_at: stored?.expires_at ?? null,
    })
  },
} satisfies ExportedHandler<SchedulerEnv>
