/**
 * IdeateHandler — live idea board with debounced AI clustering (IDEATE-CLUSTER-01).
 */
import type { Env } from '../types'
import type { ServerMessage } from '../realtime'
import { LIVE_PROTOCOL_VERSION } from '../realtime'
import { DECISIONS_EMBED_MODEL, DECISIONS_EMBED_DIM } from './insights-vectorize'
import { validateData, AiBatchEmbeddingResponseSchema } from './protocol-schemas'
import { withTimeout } from './shared/async'
import { clusterIdeas, assignClusterIds } from './ideate-cluster'
import {
  IDEATE_KEYS,
  createIdeateIdea,
  nextIdeateRev,
  type IdeateCluster,
  type IdeateIdea,
} from './session-room-ideate'

type Attachment = { role: 'presenter' | 'voter'; voterId: string }

interface StorageContext {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
  }
  getWebSockets(): WebSocket[]
}

function errorMessage(code: string, message: string): string {
  return JSON.stringify({ type: 'error', data: { code, message }, timestamp: Date.now() })
}

function serverMsg(msg: Omit<ServerMessage, 'v'> | object): string {
  return JSON.stringify({ v: LIVE_PROTOCOL_VERSION, ...msg })
}

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
    private readonly ctx: StorageContext,
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
    await this.ctx.storage.put(IDEATE_KEYS.rev, 0)
    await this.ctx.storage.put(IDEATE_KEYS.dotVoteLimit, dotVoteLimit)
    await this.ctx.storage.put(IDEATE_KEYS.clusterDebounceMs, clusterDebounceMs)
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

  async sendSnapshot(ws: WebSocket): Promise<void> {
    const ideas = await this.loadAllIdeas()
    const clusters = (await this.ctx.storage.get<IdeateCluster[]>(IDEATE_KEYS.clusters)) ?? []
    const rev = (await this.ctx.storage.get<number>(IDEATE_KEYS.rev)) ?? 0
    const dotVoteLimit = (await this.ctx.storage.get<number>(IDEATE_KEYS.dotVoteLimit)) ?? 5
    ws.send(
      serverMsg({
        type: 'ideate_state',
        data: { ideas, clusters, rev, dotVoteLimit },
        timestamp: Date.now(),
      }),
    )
  }

  private async broadcast(type: 'ideate_idea_added' | 'ideate_idea_updated' | 'ideate_clusters_updated', data: object): Promise<void> {
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
    const body = data.body.trim()
    if (body.length < 2 || body.length > 500) {
      ws.send(errorMessage('validation', 'Idea must be 2–500 characters'))
      return
    }
    const item = createIdeateIdea(body)
    const index = (await this.ctx.storage.get<string[]>(IDEATE_KEYS.index)) ?? []
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
    if (!this.env.AI) return vectors
    for (const idea of ideas) {
      if (idea.status !== 'active') continue
      try {
        const result = await withTimeout(
          this.env.AI.run(DECISIONS_EMBED_MODEL, { text: idea.body }),
          8_000,
          'Ideate embedding',
        )
        const vector = firstVector(result)
        if (vector) vectors.set(idea.id, vector)
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
