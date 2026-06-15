/**
 * session-room-reactions-handler.ts — REACTIONS-CHANNEL-01 (ADR-0055).
 *
 * Ephemeral high-throughput reaction sub-channel on the SessionRoom DO.
 * Aggregate-only broadcasts; separate from the vote token-bucket.
 */
import { LIVE_PROTOCOL_VERSION_V3 } from '../realtime'
import type { LiveQuestion } from '../realtime'
import type { Anonymity } from '../types'
import type { Attachment, Meta } from './session-room-types'
import {
  REACTION_FLOOD_MULTIPLIER,
  REACTION_RATE_WINDOW_MS,
  REACTION_VOTER_FLOOD_WINDOW_MS,
  reactionBudgetPerMinute,
  isValidReactionEmojiId,
} from './reactions-config'
import { writeEvent } from './observability'
import type { Env } from '../types'
import { K_META, K_QUESTION } from './session-room-storage-keys'

export type ReactionCounts = Record<string, number>

const K_REACTION_COUNTS = 'reactions:counts'
const K_REACTION_SESSION_TS = 'reactions:session_timestamps'
const K_REACTION_VOTER_TS = 'reactions:voter_timestamps'

interface StorageContext {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put<T>(key: string, value: T): Promise<void>
  }
  getWebSockets(tag?: string): WebSocket[]
}

function serverMsg(msg: object): string {
  return JSON.stringify({ v: LIVE_PROTOCOL_VERSION_V3, ...msg })
}

export class ReactionsHandler {
  constructor(
    private readonly ctx: StorageContext,
    private readonly env: Env,
  ) {}

  async getCounts(): Promise<ReactionCounts> {
    return (await this.ctx.storage.get<ReactionCounts>(K_REACTION_COUNTS)) ?? {}
  }

  /** Whether reactions are accepted for the current question / session mode. */
  reactionsEnabled(question: LiveQuestion | null, meta: Meta): boolean {
    if (question?.kind === 'reaction') return true
    if (meta.votePolicy === 'react') return true
    return false
  }

  async handleSubmit(ws: WebSocket, att: Attachment, data: { emojiId: string }): Promise<void> {
    const meta = await this.ctx.storage.get<Meta>(K_META)
    if (!meta) {
      ws.send(this.err('not_initialised', 'Session has not been initialised'))
      return
    }
    const question = (await this.ctx.storage.get<LiveQuestion>(K_QUESTION)) ?? null

    if (!this.reactionsEnabled(question, meta)) {
      ws.send(this.err('reactions_disabled', 'Reactions are not active for this session'))
      return
    }

    const emojiId = data.emojiId
    if (!emojiId || !isValidReactionEmojiId(emojiId)) {
      ws.send(this.err('validation', 'Invalid emoji'))
      return
    }

    if (question?.kind === 'reaction') {
      const allowed = question.options.some((o) => o.id === emojiId)
      if (!allowed) {
        ws.send(this.err('validation', 'Emoji not in reaction set'))
        return
      }
    }

    const plan = meta.plan
    const budget = reactionBudgetPerMinute(plan)
    const nowMs = Date.now()

    const sessionAllowed = await this.checkSessionBudget(budget, nowMs)
    if (!sessionAllowed) {
      ws.send(this.err('reaction_rate_limited', 'Session reaction rate exceeded; retry with backoff'))
      return
    }

    const voterAllowed = await this.checkVoterFlood(att.voterId, budget, nowMs)
    if (!voterAllowed) {
      ws.send(this.err('reaction_flood', 'Reaction flood detected; slow down'))
      return
    }

    const counts = await this.incrementCount(emojiId)
    this.broadcast(counts, nowMs)

    if (this.env.METRICS_AE) {
      writeEvent(this.env.METRICS_AE, {
        name: 'reaction.submitted',
        sessionId: meta.sessionId,
        detail: emojiId,
      })
    }
  }

  private async checkSessionBudget(budget: number, nowMs: number): Promise<boolean> {
    const timestamps = (await this.ctx.storage.get<number[]>(K_REACTION_SESSION_TS)) ?? []
    const cutoff = nowMs - REACTION_RATE_WINDOW_MS
    const recent = timestamps.filter((t) => t > cutoff)
    if (recent.length >= budget) return false
    recent.push(nowMs)
    await this.ctx.storage.put(K_REACTION_SESSION_TS, recent)
    return true
  }

  private async checkVoterFlood(voterId: string, sessionBudget: number, nowMs: number): Promise<boolean> {
    const all =
      (await this.ctx.storage.get<Record<string, number[]>>(K_REACTION_VOTER_TS)) ?? {}
    const cutoff = nowMs - REACTION_VOTER_FLOOD_WINDOW_MS
    const voterTs = (all[voterId] ?? []).filter((t) => t > cutoff)

    const connected = Math.max(1, this.ctx.getWebSockets().length)
    const fairShare = Math.max(1, Math.floor(sessionBudget / connected))
    const limit = fairShare * REACTION_FLOOD_MULTIPLIER

    if (voterTs.length >= limit) return false

    voterTs.push(nowMs)
    all[voterId] = voterTs
    await this.ctx.storage.put(K_REACTION_VOTER_TS, all)
    return true
  }

  private async incrementCount(emojiId: string): Promise<ReactionCounts> {
    const counts = await this.getCounts()
    counts[emojiId] = (counts[emojiId] ?? 0) + 1
    await this.ctx.storage.put(K_REACTION_COUNTS, counts)
    return counts
  }

  /** Coalesced broadcast — immediate for S91 foundation (≤100ms target). */
  broadcast(counts: ReactionCounts, submittedAt: number): void {
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const ts = Date.now()
    const payload = serverMsg({
      type: 'reaction_delta',
      data: { counts, total },
      timestamp: ts,
    })
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload)
      } catch {
        // stale socket — ignore
      }
    }
    if (this.env.METRICS_AE) {
      writeEvent(this.env.METRICS_AE, {
        name: 'reaction.broadcast_latency',
        durationMs: ts - submittedAt,
        count: total,
      })
    }
  }

  /**
   * Snapshot for session close / ZK aggregate export.
   * Counts are aggregate-only and identical across anonymity modes — no
   * per-voter data is ever stored, so ZK needs no special-casing here.
   */
  async snapshotForClose(_anonymity: Anonymity | undefined): Promise<ReactionCounts | null> {
    const counts = await this.getCounts()
    if (Object.keys(counts).length === 0) return null
    return { ...counts }
  }

  private err(code: string, message: string): string {
    return serverMsg({ type: 'error', data: { code, message }, timestamp: Date.now() })
  }
}

/** Plan tier exposes liveReactions for init.features gating upstream. */
export function planAllowsLiveReactions(plan: Meta['plan']): boolean {
  return plan === 'starter' || plan === 'team'
}
