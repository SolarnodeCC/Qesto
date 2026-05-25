/**
 * AI-COACHING-03 — facilitator coaching preferences (KV).
 */
import { readKvJson, writeKvJson } from './kv'

export type TeamVertical = 'general' | 'hr' | 'events' | 'consulting' | 'nonprofit'

export type CoachingProfile = {
  style: 'concise' | 'detailed'
  audienceSize: 'small' | 'medium' | 'large'
  topics: string[]
  /** AI-MULTI-TENANT-01 — team use-case for prompt personalization */
  teamVertical?: TeamVertical
  updatedAt: number
}

export function coachingProfileKey(userId: string): string {
  return `coaching:profile:${userId}`
}

export async function loadCoachingProfile(kv: KVNamespace, userId: string): Promise<CoachingProfile | null> {
  return readKvJson<CoachingProfile>(kv, coachingProfileKey(userId))
}

export async function saveCoachingProfile(kv: KVNamespace, userId: string, profile: CoachingProfile): Promise<void> {
  await writeKvJson(kv, coachingProfileKey(userId), profile)
}
