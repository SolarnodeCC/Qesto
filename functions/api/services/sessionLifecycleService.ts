/**
 * Session lifecycle service (ADR-0069).
 *
 * Env-level (binding-scoped) business logic for the session start flow that is
 * not raw persistence and not HTTP — currently the board-mode warm-up config
 * loaded from KV. Keeps routes/sessions/lifecycle.ts focused on orchestration.
 */
import type { Env } from '../types'
import { readKvJson } from '../lib/kv'
import { ideateSeedKey, type IdeateSessionSeed } from '../routes/ideate-sessions'
import { retroSeedKey, type RetroSessionSeed } from '../routes/retro-sessions'
import { DEFAULT_IDEATE_TEMPLATE } from '../lib/workspace-types'

export type RetroInitExtras = { retroDotVoteLimit?: number; retroCarriedActions?: string[] }
export type IdeateInitExtras = { ideateDotVoteLimit?: number; ideateClusterDebounceMs?: number }

/** Retro warm-up config (dot-vote limit + actions carried over from prior retros). */
export async function loadRetroInitExtras(env: Env, sessionId: string): Promise<RetroInitExtras> {
  const seed = await readKvJson<RetroSessionSeed>(env.SESSIONS_KV, retroSeedKey(sessionId))
  if (!seed) return {}
  return { retroDotVoteLimit: seed.dotVoteLimit, retroCarriedActions: seed.carriedActions }
}

/** Ideate warm-up config (dot-vote limit + cluster debounce), defaulting from the template. */
export async function loadIdeateInitExtras(env: Env, sessionId: string): Promise<IdeateInitExtras> {
  const seed = await readKvJson<IdeateSessionSeed>(env.SESSIONS_KV, ideateSeedKey(sessionId))
  if (!seed) {
    return {
      ideateDotVoteLimit: DEFAULT_IDEATE_TEMPLATE.dotVoteLimit,
      ideateClusterDebounceMs: DEFAULT_IDEATE_TEMPLATE.clusterDebounceMs,
    }
  }
  return { ideateDotVoteLimit: seed.dotVoteLimit, ideateClusterDebounceMs: seed.clusterDebounceMs }
}
