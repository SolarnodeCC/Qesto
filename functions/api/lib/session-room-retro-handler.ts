/**
 * RetroHandler — 3-column retro board (ADR-0048).
 */
import { serverMsg, errorMessage } from './session-room-messages'
import type { DurableContextLike } from './session-room-context'
import type { Attachment } from './session-room-types'
import { consumeSubmitToken, newSubmitBucket } from './board-submit-rate'
import {
  MAX_RETRO_ITEMS,
  RETRO_KEYS,
  RETRO_COLUMNS,
  canUpvoteColumn,
  createRetroItem,
  nextRetroRev,
  type RetroColumn,
  type RetroItem,
} from './session-room-retro'

export class RetroHandler {
  constructor(private readonly ctx: DurableContextLike) {}

  private async bumpRev(): Promise<number> {
    const rev = nextRetroRev((await this.ctx.storage.get<number>(RETRO_KEYS.rev)) ?? 0)
    await this.ctx.storage.put(RETRO_KEYS.rev, rev)
    return rev
  }

  private async loadItem(id: string): Promise<RetroItem | null> {
    return (await this.ctx.storage.get<RetroItem>(RETRO_KEYS.item(id))) ?? null
  }

  private async loadDotVoteLimit(): Promise<number> {
    return (await this.ctx.storage.get<number>(RETRO_KEYS.dotVoteLimit)) ?? 3
  }

  async seedBoard(dotVoteLimit: number, carriedActions: string[] = []): Promise<void> {
    await this.ctx.storage.put(RETRO_KEYS.index, [] as string[])
    await this.ctx.storage.put(RETRO_KEYS.rev, 0)
    await this.ctx.storage.put(RETRO_KEYS.dotVoteLimit, dotVoteLimit)
    const seenTexts = new Set<string>()
    let seeded = 0
    for (const text of carriedActions) {
      const trimmed = text.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seenTexts.has(key)) continue
      seenTexts.add(key)
      const item = createRetroItem('actions', trimmed, true)
      const index = (await this.ctx.storage.get<string[]>(RETRO_KEYS.index)) ?? []
      index.push(item.id)
      await this.ctx.storage.put(RETRO_KEYS.index, index)
      await this.ctx.storage.put(RETRO_KEYS.item(item.id), item)
      seeded++
    }
    if (seeded > 0) {
      await this.bumpRev()
    }
  }

  async loadAllItems(): Promise<RetroItem[]> {
    const index = (await this.ctx.storage.get<string[]>(RETRO_KEYS.index)) ?? []
    const items: RetroItem[] = []
    for (const id of index) {
      const item = await this.loadItem(id)
      if (item) items.push(item)
    }
    return items
  }

  private async loadVoterVoteState(voterId: string, items: RetroItem[]): Promise<{ myUpvotes: string[]; dotsUsed: number }> {
    const myUpvotes: string[] = []
    for (const item of items) {
      if (item.column !== 'actions') continue
      const upvoters = (await this.ctx.storage.get<string[]>(RETRO_KEYS.upvoters(item.id))) ?? []
      if (upvoters.includes(voterId)) myUpvotes.push(item.id)
    }
    const dotsUsed = (await this.ctx.storage.get<number>(RETRO_KEYS.voterDots(voterId))) ?? 0
    return { myUpvotes, dotsUsed }
  }

  async sendSnapshot(ws: WebSocket, att?: Attachment): Promise<void> {
    const items = await this.loadAllItems()
    const rev = (await this.ctx.storage.get<number>(RETRO_KEYS.rev)) ?? 0
    const dotVoteLimit = await this.loadDotVoteLimit()
    const voterState = att?.role === 'voter' ? await this.loadVoterVoteState(att.voterId, items) : null
    ws.send(
      serverMsg({
        type: 'retro_state',
        data: {
          items,
          rev,
          dotVoteLimit,
          columns: RETRO_COLUMNS,
          ...(voterState ?? {}),
        },
        timestamp: Date.now(),
      }),
    )
  }

  private async broadcastDelta(type: 'retro_item_added' | 'retro_item_updated', item: RetroItem, rev: number): Promise<void> {
    const frame = serverMsg({ type, data: { item, rev }, timestamp: Date.now() })
    for (const s of this.ctx.getWebSockets()) {
      try {
        s.send(frame)
      } catch {
        /* ignore */
      }
    }
  }

  private async consumeSubmitRate(voterId: string): Promise<boolean> {
    const now = Date.now()
    const bucketKey = RETRO_KEYS.submitRate(voterId)
    const bucket = (await this.ctx.storage.get<{ tokens: number; lastAt: number }>(bucketKey)) ?? newSubmitBucket(now)
    const consumed = consumeSubmitToken(bucket, now)
    await this.ctx.storage.put(bucketKey, consumed.bucket)
    return consumed.ok
  }

  async handleSubmit(
    ws: WebSocket,
    att: Attachment,
    data: { column: RetroColumn; body: string },
  ): Promise<void> {
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
      ws.send(errorMessage('validation', 'Response must be 2–500 characters'))
      return
    }
    if (!RETRO_COLUMNS.includes(data.column)) {
      ws.send(errorMessage('validation', 'Invalid column'))
      return
    }
    const index = (await this.ctx.storage.get<string[]>(RETRO_KEYS.index)) ?? []
    if (index.length >= MAX_RETRO_ITEMS) {
      ws.send(errorMessage('limit', `Board limit (${MAX_RETRO_ITEMS}) reached`))
      return
    }
    const item = createRetroItem(data.column, body)
    index.push(item.id)
    await this.ctx.storage.put(RETRO_KEYS.index, index)
    await this.ctx.storage.put(RETRO_KEYS.item(item.id), item)
    const rev = await this.bumpRev()
    await this.broadcastDelta('retro_item_added', item, rev)
  }

  async handleUpvote(ws: WebSocket, att: Attachment, data: { itemId: string }): Promise<void> {
    if (att.role !== 'voter') {
      ws.send(errorMessage('forbidden', 'Only participants can vote'))
      return
    }
    const item = await this.loadItem(data.itemId)
    if (!item) {
      ws.send(errorMessage('not_found', 'Item not found'))
      return
    }
    if (!canUpvoteColumn(item.column)) {
      ws.send(errorMessage('validation', 'Only action items accept votes'))
      return
    }
    const upvoters = (await this.ctx.storage.get<string[]>(RETRO_KEYS.upvoters(data.itemId))) ?? []
    if (upvoters.includes(att.voterId)) {
      ws.send(errorMessage('duplicate', 'Already voted on this item'))
      return
    }
    const dotVoteLimit = await this.loadDotVoteLimit()
    const dotsUsed = (await this.ctx.storage.get<number>(RETRO_KEYS.voterDots(att.voterId))) ?? 0
    if (dotsUsed >= dotVoteLimit) {
      ws.send(errorMessage('limit', `Dot vote limit (${dotVoteLimit}) reached`))
      return
    }
    upvoters.push(att.voterId)
    item.upvotes += 1
    await this.ctx.storage.put(RETRO_KEYS.upvoters(data.itemId), upvoters)
    await this.ctx.storage.put(RETRO_KEYS.item(data.itemId), item)
    await this.ctx.storage.put(RETRO_KEYS.voterDots(att.voterId), dotsUsed + 1)
    const rev = await this.bumpRev()
    await this.broadcastDelta('retro_item_updated', item, rev)
  }

  async collectActionItemsForWorkspace(): Promise<string[]> {
    const items = await this.loadAllItems()
    return items.filter((i) => i.column === 'actions').map((i) => i.body)
  }

  async collectStatsForTrend(): Promise<{
    wentWell: number
    didntGoWell: number
    actions: number
    totalCards: number
  }> {
    const items = await this.loadAllItems()
    const wentWell = items.filter((i) => i.column === 'went_well').length
    const didntGoWell = items.filter((i) => i.column === 'didnt_go_well').length
    const actions = items.filter((i) => i.column === 'actions').length
    return { wentWell, didntGoWell, actions, totalCards: items.length }
  }
}
