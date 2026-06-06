// Shared helpers for session lifecycle routes (start / close / transition).
import type { Env } from '../../../types'
import { readKvJson } from '../../../lib/kv'
import { ideateSeedKey, type IdeateSessionSeed } from '../../ideate-sessions'
import { retroSeedKey, type RetroSessionSeed } from '../../retro-sessions'
import { DEFAULT_IDEATE_TEMPLATE } from '../../../lib/workspace-types'
import type { Question, Session } from '../../../types'
import { questionToLive } from '../shared'
import type { LiveQuestion } from '../../../realtime'

export const BOARD_MODES_NO_QUESTIONS = new Set(['retro', 'townhall', 'ideate'])

export async function loadRetroInitExtras(
  env: Env,
  sessionId: string,
): Promise<{ retroDotVoteLimit?: number; retroCarriedActions?: string[] }> {
  const seed = await readKvJson<RetroSessionSeed>(env.SESSIONS_KV, retroSeedKey(sessionId))
  if (!seed) return {}
  return { retroDotVoteLimit: seed.dotVoteLimit, retroCarriedActions: seed.carriedActions }
}

export async function loadIdeateInitExtras(
  env: Env,
  sessionId: string,
): Promise<{ ideateDotVoteLimit?: number; ideateClusterDebounceMs?: number }> {
  const seed = await readKvJson<IdeateSessionSeed>(env.SESSIONS_KV, ideateSeedKey(sessionId))
  if (!seed) {
    return {
      ideateDotVoteLimit: DEFAULT_IDEATE_TEMPLATE.dotVoteLimit,
      ideateClusterDebounceMs: DEFAULT_IDEATE_TEMPLATE.clusterDebounceMs,
    }
  }
  return { ideateDotVoteLimit: seed.dotVoteLimit, ideateClusterDebounceMs: seed.clusterDebounceMs }
}

export async function doInitAlreadyInitialised(doRes: Response): Promise<boolean> {
  if (doRes.status !== 409) return false
  try {
    const doBody = (await doRes.json()) as { ok?: boolean; error?: { code?: string } }
    return doBody?.error?.code === 'already_initialised'
  } catch {
    return false
  }
}

export async function rollbackSessionStart(
  db: D1Database,
  id: string,
  ownerId: string,
  status: Session['status'],
  startedAt: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE sessions SET status = 'draft', started_at = NULL
       WHERE id = ?1 AND owner_id = ?2 AND status = ?3 AND started_at = ?4`,
    )
    .bind(id, ownerId, status, startedAt)
    .run()
}

export function buildSessionInitBody(
  session: Session,
  liveQ: LiveQuestion | null,
  questions: Question[],
  plan: string,
  extras?: {
    retroDotVoteLimit?: number
    retroCarriedActions?: string[]
    ideateDotVoteLimit?: number
    ideateClusterDebounceMs?: number
  },
) {
  return {
    sessionId: session.id,
    ownerId: session.owner_id,
    teamId: session.team_id ?? undefined,
    code: session.code,
    title: session.title,
    question: liveQ,
    questions: questions.map(questionToLive),
    votePolicy: session.vote_policy,
    sessionMode: session.session_mode,
    anonymity: session.anonymity ?? undefined,
    townhallModeration: session.townhall_moderation ?? undefined,
    retroDotVoteLimit: extras?.retroDotVoteLimit,
    retroCarriedActions: extras?.retroCarriedActions,
    ideateDotVoteLimit: extras?.ideateDotVoteLimit,
    ideateClusterDebounceMs: extras?.ideateClusterDebounceMs,
    plan,
  }
}
