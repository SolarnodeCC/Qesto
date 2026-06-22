/**
 * LTI launch-context + nonce persistence (#587).
 *
 * - persistLaunchContext / lookupLaunchContextByResourceLink store the
 *   LMS-signed grade-passback target (outcome service URL + result sourcedid)
 *   captured at launch, so grade passback never trusts request-body values.
 * - kvNonceStore implements LtiNonceStore for OAuth replay protection.
 */
import type { LtiLaunchContext, LtiNonceStore } from './lti'
import { LTI_TIMESTAMP_SKEW_SECONDS } from './lti'
import { ulid } from './ulid'

export type StoredLaunchContext = {
  id: string
  consumerKey: string
  contextId: string | null
  resourceLinkId: string
  outcomeServiceUrl: string | null
  resultSourcedId: string | null
  lmsUserId: string | null
  roles: string[]
  qestoSessionId: string | null
}

/** Persist (upsert) a verified launch context for later trusted grade passback. */
export async function persistLaunchContext(
  db: D1Database,
  ctx: LtiLaunchContext,
  qestoSessionId: string | null = null,
): Promise<void> {
  const now = Date.now()
  await db
    .prepare(
      `INSERT INTO lti_launch_contexts
         (id, consumer_key, context_id, resource_link_id, lis_outcome_service_url,
          lis_result_sourcedid, lms_user_id, roles, qesto_session_id, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
       ON CONFLICT(consumer_key, resource_link_id, lis_result_sourcedid) DO UPDATE SET
         lis_outcome_service_url = excluded.lis_outcome_service_url,
         context_id = excluded.context_id,
         lms_user_id = excluded.lms_user_id,
         roles = excluded.roles,
         qesto_session_id = COALESCE(excluded.qesto_session_id, lti_launch_contexts.qesto_session_id),
         updated_at = excluded.updated_at`,
    )
    .bind(
      ulid(),
      ctx.consumerKey,
      ctx.contextId,
      ctx.resourceLinkId,
      ctx.outcomeServiceUrl,
      ctx.resultSourcedId,
      ctx.userId,
      JSON.stringify(ctx.roles),
      qestoSessionId,
      now,
    )
    .run()
}

type LaunchContextRow = {
  id: string
  consumer_key: string
  context_id: string | null
  resource_link_id: string
  lis_outcome_service_url: string | null
  lis_result_sourcedid: string | null
  lms_user_id: string | null
  roles: string | null
  qesto_session_id: string | null
}

function rowToContext(row: LaunchContextRow): StoredLaunchContext {
  let roles: string[] = []
  if (row.roles) {
    try {
      const parsed = JSON.parse(row.roles)
      if (Array.isArray(parsed)) roles = parsed.filter((r): r is string => typeof r === 'string')
    } catch {
      /* roles stays [] */
    }
  }
  return {
    id: row.id,
    consumerKey: row.consumer_key,
    contextId: row.context_id,
    resourceLinkId: row.resource_link_id,
    outcomeServiceUrl: row.lis_outcome_service_url,
    resultSourcedId: row.lis_result_sourcedid,
    lmsUserId: row.lms_user_id,
    roles,
    qestoSessionId: row.qesto_session_id,
  }
}

/** Look up the most-recent stored launch context for a resource link. */
export async function lookupLaunchContextByResourceLink(
  db: D1Database,
  consumerKey: string,
  resourceLinkId: string,
): Promise<StoredLaunchContext | null> {
  const row = await db
    .prepare(
      `SELECT id, consumer_key, context_id, resource_link_id, lis_outcome_service_url,
              lis_result_sourcedid, lms_user_id, roles, qesto_session_id
       FROM lti_launch_contexts
       WHERE consumer_key = ?1 AND resource_link_id = ?2
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .bind(consumerKey, resourceLinkId)
    .first<LaunchContextRow>()
  return row ? rowToContext(row) : null
}

/** KV-backed nonce store for OAuth replay protection (TTL = skew window + slack). */
export function kvNonceStore(kv: KVNamespace): LtiNonceStore {
  const ttlSeconds = LTI_TIMESTAMP_SKEW_SECONDS + 60
  return {
    async seen(consumerKey: string, nonce: string): Promise<boolean> {
      const key = `lti:nonce:${consumerKey}:${nonce}`
      const existing = await kv.get(key)
      if (existing) return true
      await kv.put(key, '1', { expirationTtl: ttlSeconds })
      return false
    },
  }
}
