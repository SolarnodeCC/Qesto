/**
 * IdeateHandler — live idea board with debounced AI clustering (IDEATE-CLUSTER-01).
 */
import type { Env } from '../types'
import { serverMsg, errorMessage } from './session-room-messages'
import type { DurableContextLike } from './session-room-context'
import type { Attachment } from './session-room-types'
import { runAI } from './ai/ai-gateway'
import { sanitizeEmbedText } from './ai/prompt-sanitize'
import { DECISIONS_EMBED_MODEL, DECISIONS_EMBED_DIM } from './insights-vectorize'
import { validateData, AiBatchEmbeddingResponseSchema } from './protocol-schemas'
import { withTimeout } from './shared/async'
import { consumeSubmitToken, newSubmitBucket } from './board-submit-rate'
import { clusterIdeas, assignClusterIds } from './ideate-cluster'
import {
  IDEATE_KEYS,
  MAX_IDEATE_IDEAS,
  computeIdeateRanking,
  createIdeateIdea,
  mergeIdeateUpvoters,
  nextIdeateRev,
  type IdeateCluster,
  type IdeateIdea,
  type IdeateRankingEntry,
} from './session-room-ideate'

type CachedEmbedding = { body: string; vector: number[] }

function firstVector(result: unknown): number[] | undefined {
  const validated = validateData(result, AiBatchEmbeddingResponseSchema)
  if (!validated) return undefined
  const raw = result as { data?: unknown }
  const first = Array.isArray(raw.data) ? raw.data[0] : undefined
  if (!Array.isArray(first) || first.length !== DECISIONS_EMBED_DIM) return undefined
  return first.every((v) => typeof v === 'number') ? (first as number[]) : undefined
}

export class IdeateHandler {
  constructor(
    private readonly ctx: DurableContextLike,
    private readonly env: Env,
    private readonly scheduleAlarm: (targetMs: number) => Promise<void>,
  ) {}

  private async isEnabled(): Promise<boolean> {
    return (await this.ctx.storage.get<boolean>(IDEATE_KEYS.enabled)) === true
  }

  private async bumpRev(): Promise<number> {
    const rev = nextIdeateRev((await this.ctx.storage.get<number>(IDEATE_KEYS.rev)) ?? 0)
    await this.ctx.storage.put(IDEATE_KEYS.rev, rev)
    return rev
  }

  private async loadItem(id: string): Promise<IdeateIdea | null> {
    return (await this.ctx.storage.get<IdeateIdea>(IDEATE_KEYS.item(id))) ?? null
  }

  async seedBoard(dotVoteLimit: number, clusterDebounceMs: number): Promise<void> {
    await this.ctx.storage.put(IDEATE_KEYS.enabled, true)
    await this.ctx.storage.put(IDEATE_KEYS.index, [] as string[])
    await this.ctx.storage.put(IDEATE_KEYS.clusters, [] as IdeateCluster[])
    await this.ctx.storage.put(IDEATE_KEYS.rankingRevealed, false)
    await this.ctx.storage.put(IDEATE_KEYS.rev, 0)
    await this.ctx.storage.put(IDEATE_KEYS.dotVoteLimit, dotVoteLimit)
    await this.ctx.storage.put(IDEATE_KEYS.clusterDebounceMs, clusterDebounceMs)
  }

  private async loadRanking(ideas: IdeateIdea[]): Promise<IdeateRankingEntry[]> {
    const revealed = (await this.ctx.storage.get<boolean>(IDEATE_KEYS.rankingRevealed)) === true
    return revealed ? computeIdeateRanking(ideas) : []
  }

  async loadAllIdeas(): Promise<IdeateIdea[]> {
    const index = (await this.ctx.storage.get<string[]>(IDEATE_KEYS.index)) ?? []
    const ideas: IdeateIdea[] = []
    for (const id of index) {
      const item = await this.loadItem(id)
      if (item) ideas.push(item)
    }
    return ideas
  }

  private async loadVoterVoteState(voterId: string, ideas: IdeateIdea[]): Promise<{ myUpvotes: string[]; dotsUsed: number }> {
    const myUpvotes: string[] = []
    for (const idea of ideas) {
      if (idea.status !== 'active') continue
      const upvoters = (await this.ctx.storage.get<string[]>(IDEATE_KEYS.upvoters(idea.id))) ?? []
      if (upvoters.includes(voterId)) myUpvotes.push(idea.id)
    }
    const dotsUsed = (await this.ctx.storage.get<number>(IDEATE_KEYS.voterDots(voterId))) ?? 0
    return { myUpvotes, dotsUsed }
  }

  async sendSnapshot(ws: WebSocket, att?: Attachment): Promise<void> {
    const ideas = await this.loadAllIdeas()
    const clusters = (await this.ctx.storage.get<IdeateCluster[]>(IDEATE_KEYS.clusters)) ?? []
    const rev = (await this.ctx.storage.get<number>(IDEATE_KEYS.rev)) ?? 0
    const dotVoteLimit = (await this.ctx.storage.get<number>(IDEATE_KEYS.dotVoteLimit)) ?? 5
    const rankingRevealed = (await this.ctx.storage.get<boolean>(IDEATE_KEYS.rankingRevealed)) === true
    const ranking = await this.loadRanking(ideas)
    const voterState = att?.role === 'voter' ? await this.loadVoterVoteState(att.voterId, ideas) : null
    ws.send(
      serverMsg({
        type: 'ideate_state',
        data: {
          ideas,
          clusters,
          rev,
          dotVoteLimit,
          rankingRevealed,
          ranking,
          ...(voterState ?? {}),
        },
        timestamp: Date.now(),
      }),
    )
  }

  private async maybeBroadcastRanking(ideas?: IdeateIdea[]): Promise<void> {
    const revealed = (await this.ctx.storage.get<boolean>(IDEATE_KEYS.rankingRevealed)) === true
    if (!revealed) return
    const all = ideas ?? (await this.loadAllIdeas())
    const ranking = computeIdeateRanking(all)
    const rev = await this.bumpRev()
    await this.broadcast('ideate_ranking_revealed', { ranking, rev })
  }

  private async consumeSubmitRate(voterId: string): Promise<boolean> {
    const now = Date.now()
    const bucketKey = IDEATE_KEYS.submitRate(voterId)
    const bucket = (await this.ctx.storage.get<{ tokens: number; lastAt: number }>(bucketKey)) ?? newSubmitBucket(now)
    const consumed = consumeSubmitToken(bucket, now)
    await this.ctx.storage.put(bucketKey, consumed.bucket)
    return consumed.ok
  }

  private async broadcast(
    type: 'ideate_idea_added' | 'ideate_idea_updated' | 'ideate_clusters_updated' | 'ideate_ranking_revealed',
    data: object,
  ): Promise<void> {
    const rev = (await this.ctx.storage.get<number>(IDEATE_KEYS.rev)) ?? 0
    const frame = serverMsg({ type, data: { ...data, rev }, timestamp: Date.now() })
    for (const s of this.ctx.getWebSockets()) {
      try {
        s.send(frame)
      } catch {
        /* ignore */
      }
    }
  }

  async handleSubmit(ws: WebSocket, att: Attachment, data: { body: string }): Promise<void> {
    if (!(await this.isEnabled())) {
      ws.send(errorMessage('unsupported_feature', 'Ideation board is not enabled'))
      return
    }
    if (att.role !== 'voter' && att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Cannot submit'))
      return
    }
    if (!(await this.consumeSubmitRate(att.voterId))) {
      ws.send(errorMessage('rate_limit', 'Too many submissions — please wait'))
      return
    }
    const body = data.body.trim()
    if (body.length < 2 || body.length > 500) {
      ws.send(errorMessage('validation', 'Idea must be 2–500 characters'))
      return
    }
    const index = (await this.ctx.storage.get<string[]>(IDEATE_KEYS.index)) ?? []
    if (index.length >= MAX_IDEATE_IDEAS) {
      ws.send(errorMessage('limit', `Board limit (${MAX_IDEATE_IDEAS}) reached`))
      return
    }
    const item = createIdeateIdea(body)
    index.push(item.id)
    await this.ctx.storage.put(IDEATE_KEYS.index, index)
    await this.ctx.storage.put(IDEATE_KEYS.item(item.id), item)
    const rev = await this.bumpRev()
    await this.broadcast('ideate_idea_added', { idea: item, rev })

    const debounceMs = (await this.ctx.storage.get<number>(IDEATE_KEYS.clusterDebounceMs)) ?? 3000
    const pendingAt = Date.now() + debounceMs
    await this.ctx.storage.put(IDEATE_KEYS.clusterPendingAt, pendingAt)
    await this.scheduleAlarm(pendingAt)
  }

  async handleReveal(ws: WebSocket, att: Attachment): Promise<void> {
    if (!(await this.isEnabled())) {
      ws.send(errorMessage('unsupported_feature', 'Ideation board is not enabled'))
      return
    }
    if (att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Only the facilitator can reveal rankings'))
      return
    }
    await this.ctx.storage.put(IDEATE_KEYS.rankingRevealed, true)
    const ideas = await this.loadAllIdeas()
    const ranking = computeIdeateRanking(ideas)
    const rev = await this.bumpRev()
    await this.broadcast('ideate_ranking_revealed', { ranking, rev })
  }

  private async removeIdeaFromClusters(ideaId: string): Promise<IdeateCluster[]> {
    const clusters = (await this.ctx.storage.get<IdeateCluster[]>(IDEATE_KEYS.clusters)) ?? []
    const updated = clusters
      .map((c) => ({ ...c, ideaIds: c.ideaIds.filter((id) => id !== ideaId) }))
      .filter((c) => c.ideaIds.length > 0)
    await this.ctx.storage.put(IDEATE_KEYS.clusters, updated)
    return updated
  }

  async handleDismiss(ws: WebSocket, att: Attachment, data: { itemId: string }): Promise<void> {
    if (!(await this.isEnabled())) {
      ws.send(errorMessage('unsupported_feature', 'Ideation board is not enabled'))
      return
    }
    if (att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Only the facilitator can dismiss ideas'))
      return
    }
    const item = await this.loadItem(data.itemId)
    if (!item || item.status !== 'active') {
      ws.send(errorMessage('not_found', 'Idea not found'))
      return
    }
    item.status = 'dismissed'
    item.clusterId = null
    await this.ctx.storage.put(IDEATE_KEYS.item(item.id), item)
    await this.removeIdeaFromClusters(item.id)
    const rev = await this.bumpRev()
    await this.broadcast('ideate_idea_updated', { idea: item, rev })
  }

  async handleMerge(ws: WebSocket, att: Attachment, data: { targetId: string; sourceId: string }): Promise<void> {
    if (!(await this.isEnabled())) {
      ws.send(errorMessage('unsupported_feature', 'Ideation board is not enabled'))
      return
    }
    if (att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Only the facilitator can merge ideas'))
      return
    }
    if (data.targetId === data.sourceId) {
      ws.send(errorMessage('validation', 'Cannot merge an idea into itself'))
      return
    }
    const target = await this.loadItem(data.targetId)
    const source = await this.loadItem(data.sourceId)
    if (!target || !source || target.status !== 'active' || source.status !== 'active') {
      ws.send(errorMessage('not_found', 'Idea not found'))
      return
    }
    const targetUpvoters = (await this.ctx.storage.get<string[]>(IDEATE_KEYS.upvoters(data.targetId))) ?? []
    const sourceUpvoters = (await this.ctx.storage.get<string[]>(IDEATE_KEYS.upvoters(data.sourceId))) ?? []
    const mergedUpvoters = mergeIdeateUpvoters([targetUpvoters, sourceUpvoters])
    target.upvotes = mergedUpvoters.length
    source.status = 'dismissed'
    source.clusterId = null
    for (const voterId of sourceUpvoters) {
      if (targetUpvoters.includes(voterId)) {
        const dots = (await this.ctx.storage.get<number>(IDEATE_KEYS.voterDots(voterId))) ?? 0
        if (dots > 0) await this.ctx.storage.put(IDEATE_KEYS.voterDots(voterId), dots - 1)
      }
    }
    await this.ctx.storage.put(IDEATE_KEYS.upvoters(data.targetId), mergedUpvoters)
    await this.ctx.storage.put(IDEATE_KEYS.item(data.targetId), target)
    await this.ctx.storage.put(IDEATE_KEYS.item(data.sourceId), source)
    await this.removeIdeaFromClusters(data.sourceId)
    const rev = await this.bumpRev()
    await this.broadcast('ideate_idea_updated', { idea: target, rev })
    await this.broadcast('ideate_idea_updated', { idea: source, rev })
    await this.maybeBroadcastRanking()
  }

  async handleUpvote(ws: WebSocket, att: Attachment, data: { itemId: string }): Promise<void> {
    if (!(await this.isEnabled())) {
      ws.send(errorMessage('unsupported_feature', 'Ideation board is not enabled'))
      return
    }
    if (att.role !== 'voter') {
      ws.send(errorMessage('forbidden', 'Only participants can vote'))
      return
    }
    const item = await this.loadItem(data.itemId)
    if (!item || item.status !== 'active') {
      ws.send(errorMessage('not_found', 'Idea not found'))
      return
    }
    const upvoters = (await this.ctx.storage.get<string[]>(IDEATE_KEYS.upvoters(data.itemId))) ?? []
    if (upvoters.includes(att.voterId)) {
      ws.send(errorMessage('duplicate', 'Already voted on this idea'))
      return
    }
    const dotVoteLimit = (await this.ctx.storage.get<number>(IDEATE_KEYS.dotVoteLimit)) ?? 5
    const dotsUsed = (await this.ctx.storage.get<number>(IDEATE_KEYS.voterDots(att.voterId))) ?? 0
    if (dotsUsed >= dotVoteLimit) {
      ws.send(errorMessage('limit', `Dot vote limit (${dotVoteLimit}) reached`))
      return
    }
    upvoters.push(att.voterId)
    item.upvotes += 1
    await this.ctx.storage.put(IDEATE_KEYS.upvoters(data.itemId), upvoters)
    await this.ctx.storage.put(IDEATE_KEYS.item(data.itemId), item)
    await this.ctx.storage.put(IDEATE_KEYS.voterDots(att.voterId), dotsUsed + 1)
    const rev = await this.bumpRev()
    await this.broadcast('ideate_idea_updated', { idea: item, rev })
    await this.maybeBroadcastRanking()
  }

  async runPendingCluster(nowMs: number): Promise<boolean> {
    if (!(await this.isEnabled())) return false
    const pendingAt = await this.ctx.storage.get<number>(IDEATE_KEYS.clusterPendingAt)
    if (!pendingAt || nowMs < pendingAt) return false

    await this.ctx.storage.delete(IDEATE_KEYS.clusterPendingAt)
    await this.recomputeClusters()
    return true
  }

  private async embedIdeaBodies(ideas: IdeateIdea[]): Promise<Map<string, number[]>> {
    const vectors = new Map<string, number[]>()
    for (const idea of ideas) {
      if (idea.status !== 'active') continue
      const cached = await this.ctx.storage.get<CachedEmbedding>(IDEATE_KEYS.embedding(idea.id))
      if (cached?.body === idea.body && cached.vector.length === DECISIONS_EMBED_DIM) {
        vectors.set(idea.id, cached.vector)
        continue
      }
      if (!this.env.AI) continue
      const embedText = sanitizeEmbedText(idea.body)
      if (!embedText) continue
      try {
        const result = await withTimeout(
          runAI(this.env, DECISIONS_EMBED_MODEL, { text: embedText }),
          8_000,
          'Ideate embedding',
        )
        const vector = firstVector(result)
        if (vector) {
          vectors.set(idea.id, vector)
          await this.ctx.storage.put(IDEATE_KEYS.embedding(idea.id), { body: idea.body, vector })
        }
      } catch {
        /* fallback to token overlap in clusterIdeas */
      }
    }
    return vectors
  }

  async recomputeClusters(): Promise<void> {
    const ideas = await this.loadAllIdeas()
    const vectors = await this.embedIdeaBodies(ideas)
    const clusters = clusterIdeas(ideas, vectors)
    const updatedIdeas = assignClusterIds(ideas, clusters)

    for (const idea of updatedIdeas) {
      await this.ctx.storage.put(IDEATE_KEYS.item(idea.id), idea)
    }
    await this.ctx.storage.put(IDEATE_KEYS.clusters, clusters)
    const rev = await this.bumpRev()
    await this.broadcast('ideate_clusters_updated', { clusters, ideas: updatedIdeas, rev })
  }
}
