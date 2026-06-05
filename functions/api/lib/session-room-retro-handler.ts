/**
 * RetroHandler — 3-column retro board (ADR-0048).
 */
import type { ServerMessage } from '../realtime'
import { LIVE_PROTOCOL_VERSION } from '../realtime'
import {
  RETRO_KEYS,
  RETRO_COLUMNS,
  canUpvoteColumn,
  createRetroItem,
  nextRetroRev,
  type RetroColumn,
  type RetroItem,
} from './session-room-retro'

type Attachment = { role: 'presenter' | 'voter'; voterId: string }

interface StorageContext {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put<T>(key: string, value: T): Promise<void>
  }
  getWebSockets(): WebSocket[]
}

function errorMessage(code: string, message: string): string {
  return JSON.stringify({ type: 'error', data: { code, message }, timestamp: Date.now() })
}

function serverMsg(msg: Omit<ServerMessage, 'v'> | object): string {
  return JSON.stringify({ v: LIVE_PROTOCOL_VERSION, ...msg })
}

export class RetroHandler {
  constructor(private readonly ctx: StorageContext) {}

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
    for (const text of carriedActions) {
      if (!text.trim()) continue
      const item = createRetroItem('actions', text, true)
      const index = (await this.ctx.storage.get<string[]>(RETRO_KEYS.index)) ?? []
      index.push(item.id)
      await this.ctx.storage.put(RETRO_KEYS.index, index)
      await this.ctx.storage.put(RETRO_KEYS.item(item.id), item)
    }
    if (carriedActions.length > 0) {
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

  async sendSnapshot(ws: WebSocket): Promise<void> {
    const items = await this.loadAllItems()
    const rev = (await this.ctx.storage.get<number>(RETRO_KEYS.rev)) ?? 0
    const dotVoteLimit = await this.loadDotVoteLimit()
    ws.send(
      serverMsg({
        type: 'retro_state',
        data: { items, rev, dotVoteLimit, columns: RETRO_COLUMNS },
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

  async handleSubmit(
    ws: WebSocket,
    att: Attachment,
    data: { column: RetroColumn; body: string },
  ): Promise<void> {
    if (att.role !== 'voter' && att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Cannot submit'))
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
    const item = createRetroItem(data.column, body)
    const index = (await this.ctx.storage.get<string[]>(RETRO_KEYS.index)) ?? []
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
}
