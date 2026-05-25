/**
 * AI-COACHING-02 — facilitator actions on coaching suggestions (KV).
 */
import { readKvJson, writeKvJson } from './kv'

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
    expirationTtl: 90 * 24 * 60 * 60,
  })
}

export async function listCoachingActions(kv: KVNamespace, sessionId: string): Promise<CoachingActionRecord[]> {
  return (await readKvJson<CoachingActionRecord[]>(kv, actionsKey(sessionId))) ?? []
}
