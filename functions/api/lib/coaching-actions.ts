/**
 * AI-COACHING-02 — facilitator actions on coaching suggestions (KV).
 */
import { readKvJson, writeKvJson } from './kv'
import { COACHING_PROFILE_TTL_SECONDS } from './constants'

export type CoachingActionRecord = {
  sessionId: string
  action: 'accepted' | 'dismissed' | 'saved_template'
  headline: string
  at: number
}

function actionsKey(sessionId: string): string {
  return `coaching:actions:${sessionId}`
}

export async function recordCoachingAction(
  kv: KVNamespace,
  sessionId: string,
  record: CoachingActionRecord,
): Promise<void> {
  const existing = (await readKvJson<CoachingActionRecord[]>(kv, actionsKey(sessionId))) ?? []
  existing.push(record)
  await writeKvJson(kv, actionsKey(sessionId), existing.slice(-50), {
    expirationTtl: COACHING_PROFILE_TTL_SECONDS,
  })
}

export async function listCoachingActions(kv: KVNamespace, sessionId: string): Promise<CoachingActionRecord[]> {
  return (await readKvJson<CoachingActionRecord[]>(kv, actionsKey(sessionId))) ?? []
}
