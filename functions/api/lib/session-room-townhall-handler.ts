/**
 * session-room-townhall-handler.ts
 * TownhallHandler collaborator for SessionRoom.
 * Owns all WS-layer townhall methods (submit, upvote, moderate, snapshot,
 * broadcastItemChange, persistBoard).
 * Previously inlined in SessionRoom.ts — extracted as part of TD-01 refactor.
 * See TECH_DEBT_AUDIT_2026-05.md TD-01.
 */

import type { Env, TownhallModeration } from '../types'
import type { ServerMessage, TownhallItem, TownhallBoardItem, TownhallModerateAction } from '../realtime'
import {
  TOWNHALL_KEYS,
  newSubmitBucket,
  consumeSubmitToken,
  nextRev,
  createTownhallItem,
  isDuplicateBody,
  applyTownhallUpvote,
  applyTownhallModeration,
  isAudienceVisible,
  mergedUpvoteCount,
  toBoardItem,
  type TokenBucket,
} from './session-room-townhall'
import { LIVE_PROTOCOL_VERSION } from '../realtime'

type Meta = {
  sessionId: string
  teamId?: string
  plan?: string
  anonymity?: string
  townhallModeration?: TownhallModeration
}

type Attachment = {
  role: 'presenter' | 'voter'
  voterId: string
  ipHash?: string
  permissions?: string[]
}

interface StorageContext {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
  }
  getWebSockets(tag?: string): WebSocket[]
}

function errorMessage(code: string, message: string): string {
  return JSON.stringify({ type: 'error', data: { code, message }, timestamp: Date.now() })
}

function serverMsg(msg: Omit<ServerMessage, 'v'> | object): string {
  return JSON.stringify({ v: LIVE_PROTOCOL_VERSION, ...msg })
}

export class TownhallHandler {
  constructor(
    private readonly ctx: StorageContext,
    private readonly env: Env,
  ) {}

  private async getMeta(): Promise<Meta | null> {
    return (await this.ctx.storage.get<Meta>('meta')) ?? null
  }

  private async loadItem(id: string): Promise<TownhallItem | null> {
    return (await this.ctx.storage.get<TownhallItem>(TOWNHALL_KEYS.item(id))) ?? null
  }

  private async loadUpvoters(id: string): Promise<string[]> {
    return (await this.ctx.storage.get<string[]>(TOWNHALL_KEYS.upvoters(id))) ?? []
  }

  private async loadGroups(): Promise<Record<string, string[]>> {
    return (await this.ctx.storage.get<Record<string, string[]>>(TOWNHALL_KEYS.groups)) ?? {}
  }

  private async bumpRev(): Promise<number> {
    const rev = nextRev((await this.ctx.storage.get<number>(TOWNHALL_KEYS.rev)) ?? 0)
    await this.ctx.storage.put(TOWNHALL_KEYS.rev, rev)
    return rev
  }

  private async projectItem(
    item: TownhallItem,
    spotlightId: string | null,
    groups: Record<string, string[]>,
  ): Promise<TownhallBoardItem> {
    const childIds = groups[item.id] ?? []
    let mergedUpvotes = item.upvotes
    if (childIds.length > 0) {
      const sets: string[][] = [await this.loadUpvoters(item.id)]
      for (const cid of childIds) sets.push(await this.loadUpvoters(cid))
      mergedUpvotes = mergedUpvoteCount(sets)
    }
    return toBoardItem(item, { isSpotlit: spotlightId === item.id, groupedCount: childIds.length, mergedUpvotes })
  }

  canModerate(att: Attachment): boolean {
    if (att.role !== 'presenter') return false
    return att.permissions === undefined || att.permissions.includes('session:moderate')
  }

  async getModerationMode(): Promise<TownhallModeration | null> {
    const meta = await this.getMeta()
    return meta?.townhallModeration ?? null
  }

  // ── sendSnapshot ─────────────────────────────────────────────────────────

  async sendSnapshot(ws: WebSocket, att: Attachment, moderation: TownhallModeration): Promise<void> {
    const index = (await this.ctx.storage.get<string[]>(TOWNHALL_KEYS.index)) ?? []
    const spotlightId = (await this.ctx.storage.get<string | null>(TOWNHALL_KEYS.spotlight)) ?? null
    const groups = await this.loadGroups()
    const rev = (await this.ctx.storage.get<number>(TOWNHALL_KEYS.rev)) ?? 0
    const isPresenter = att.role === 'presenter'
    const items: TownhallBoardItem[] = []
    for (const id of index) {
      const item = await this.loadItem(id)
      if (!item) continue
      if (item.status === 'grouped') continue
      if (!isPresenter && !isAudienceVisible(item.status)) continue
      items.push(await this.projectItem(item, spotlightId, groups))
    }
    ws.send(serverMsg({ type: 'townhall_state', data: { moderation, items, spotlightId, rev }, timestamp: Date.now() }))
  }

  // ── broadcastItemChange ───────────────────────────────────────────────────

  async broadcastItemChange(params: {
    item: TownhallItem
    wasAudienceVisible: boolean
    isNew: boolean
    rev: number
    spotlightId: string | null
    groups: Record<string, string[]>
  }): Promise<void> {
    const { item, wasAudienceVisible, isNew, rev, spotlightId, groups } = params
    const ts = Date.now()

    if (item.status === 'grouped') {
      const rm = serverMsg({ type: 'townhall_question_removed', data: { itemId: item.id, rev }, timestamp: ts })
      for (const s of this.ctx.getWebSockets('role:presenter')) {
        try { s.send(rm) } catch { /* ignore */ }
      }
    } else {
      const projected = await this.projectItem(item, spotlightId, groups)
      const presenterFrame = serverMsg({
        type: isNew ? 'townhall_question_added' : 'townhall_question_updated',
        data: { item: projected, rev },
        timestamp: ts,
      })
      for (const s of this.ctx.getWebSockets('role:presenter')) {
        try { s.send(presenterFrame) } catch { /* ignore */ }
      }
    }

    const nowVisible = isAudienceVisible(item.status)
    let voterFrame: string | null = null
    if (nowVisible) {
      const projected = await this.projectItem(item, spotlightId, groups)
      voterFrame = serverMsg({
        type: wasAudienceVisible ? 'townhall_question_updated' : 'townhall_question_added',
        data: { item: projected, rev },
        timestamp: ts,
      })
    } else if (wasAudienceVisible) {
      voterFrame = serverMsg({ type: 'townhall_question_removed', data: { itemId: item.id, rev }, timestamp: ts })
    }
    if (voterFrame) {
      for (const s of this.ctx.getWebSockets('role:voter')) {
        try { s.send(voterFrame) } catch { /* ignore */ }
      }
    }
  }

  // ── handleSubmit ─────────────────────────────────────────────────────────

  async handleSubmit(ws: WebSocket, att: Attachment, data: { body: string; displayName?: string | undefined }): Promise<void> {
    const moderation = await this.getModerationMode()
    if (!moderation) {
      ws.send(errorMessage('unsupported_feature', 'Townhall Q&A is not enabled'))
      return
    }
    const bucketKey = TOWNHALL_KEYS.submitRate(att.voterId)
    const bucket = (await this.ctx.storage.get<TokenBucket>(bucketKey)) ?? newSubmitBucket(Date.now())
    const consumed = consumeSubmitToken(bucket, Date.now())
    await this.ctx.storage.put(bucketKey, consumed.bucket)
    if (!consumed.ok) {
      ws.send(errorMessage('rate_limited', 'You are submitting questions too quickly'))
      return
    }
    const index = (await this.ctx.storage.get<string[]>(TOWNHALL_KEYS.index)) ?? []
    const recentBodies: string[] = []
    for (const id of index.slice(-50)) {
      const it = await this.loadItem(id)
      if (it) recentBodies.push(it.body)
    }
    if (isDuplicateBody(recentBodies, data.body)) {
      ws.send(errorMessage('duplicate', 'That question has already been asked'))
      return
    }
    const meta = await this.getMeta()
    const allowName = meta?.anonymity !== 'zero_knowledge'
    const rev = await this.bumpRev()
    const id = crypto.randomUUID()
    const item = createTownhallItem({
      id,
      body: data.body,
      displayName: allowName ? (data.displayName ?? null) : null,
      authorHash: att.voterId,
      moderation,
      now: Date.now(),
      rev,
    })
    await this.ctx.storage.put(TOWNHALL_KEYS.item(id), item)
    await this.ctx.storage.put(TOWNHALL_KEYS.upvoters(id), [])
    await this.ctx.storage.put(TOWNHALL_KEYS.index, [...index, id])
    const spotlightId = (await this.ctx.storage.get<string | null>(TOWNHALL_KEYS.spotlight)) ?? null
    const groups = await this.loadGroups()
    await this.broadcastItemChange({ item, wasAudienceVisible: false, isNew: true, rev, spotlightId, groups })
  }

  // ── handleUpvote ─────────────────────────────────────────────────────────

  async handleUpvote(ws: WebSocket, att: Attachment, data: { itemId: string }): Promise<void> {
    const moderation = await this.getModerationMode()
    if (!moderation) {
      ws.send(errorMessage('unsupported_feature', 'Townhall Q&A is not enabled'))
      return
    }
    const item = await this.loadItem(data.itemId)
    if (!item) {
      ws.send(errorMessage('not_found', 'Question not found'))
      return
    }
    const upvoters = await this.loadUpvoters(item.id)
    const result = applyTownhallUpvote(item, upvoters, att.voterId, item.rev)
    if (!result.ok) {
      ws.send(errorMessage('duplicate', 'You already upvoted this question'))
      return
    }
    const rev = await this.bumpRev()
    const updated = { ...result.item, rev }
    await this.ctx.storage.put(TOWNHALL_KEYS.item(item.id), updated)
    await this.ctx.storage.put(TOWNHALL_KEYS.upvoters(item.id), result.upvoters)
    const spotlightId = (await this.ctx.storage.get<string | null>(TOWNHALL_KEYS.spotlight)) ?? null
    const groups = await this.loadGroups()
    const displayItem = updated.groupParent ? await this.loadItem(updated.groupParent) : updated
    if (displayItem) {
      await this.broadcastItemChange({
        item: displayItem,
        wasAudienceVisible: isAudienceVisible(displayItem.status),
        isNew: false,
        rev,
        spotlightId,
        groups,
      })
    }
  }

  // ── handleModerate ────────────────────────────────────────────────────────

  async handleModerate(
    ws: WebSocket,
    att: Attachment,
    data: { itemId: string; action: TownhallModerateAction; groupParentId?: string | undefined },
  ): Promise<void> {
    const moderation = await this.getModerationMode()
    if (!moderation) {
      ws.send(errorMessage('unsupported_feature', 'Townhall Q&A is not enabled'))
      return
    }
    if (!this.canModerate(att)) {
      ws.send(errorMessage('forbidden', 'You do not have permission to moderate this session'))
      return
    }
    const item = await this.loadItem(data.itemId)
    if (!item) {
      ws.send(errorMessage('not_found', 'Question not found'))
      return
    }
    const wasVisible = isAudienceVisible(item.status)
    const outcome = applyTownhallModeration(item, data.action, { rev: item.rev, groupParentId: data.groupParentId })
    if (!outcome.ok) {
      ws.send(errorMessage(outcome.code, outcome.message))
      return
    }
    const rev = await this.bumpRev()

    if (outcome.kind === 'spotlight') {
      await this.ctx.storage.put(TOWNHALL_KEYS.spotlight, outcome.spotlightId)
      if (outcome.spotlightId) {
        const history = (await this.ctx.storage.get<string[]>(TOWNHALL_KEYS.spotlitHistory)) ?? []
        if (!history.includes(outcome.spotlightId)) {
          await this.ctx.storage.put(TOWNHALL_KEYS.spotlitHistory, [...history, outcome.spotlightId])
        }
      }
      let spotlitItem: TownhallBoardItem | null = null
      if (outcome.spotlightId) {
        const rawItem = await this.loadItem(outcome.spotlightId)
        if (rawItem) {
          const groups = await this.loadGroups()
          spotlitItem = await this.projectItem(rawItem, outcome.spotlightId, groups)
        }
      }
      const frame = serverMsg({
        type: 'townhall_spotlight_changed',
        data: { spotlightId: outcome.spotlightId, rev, item: spotlitItem },
        timestamp: Date.now(),
      })
      for (const s of this.ctx.getWebSockets()) {
        try { s.send(frame) } catch { /* ignore */ }
      }
      return
    }

    const updated = { ...outcome.item, rev }
    await this.ctx.storage.put(TOWNHALL_KEYS.item(updated.id), updated)
    const groups = await this.loadGroups()
    let parentToRefresh: string | null = null

    if (data.action === 'group' && updated.groupParent) {
      const kids = groups[updated.groupParent] ?? []
      if (!kids.includes(updated.id)) groups[updated.groupParent] = [...kids, updated.id]
      await this.ctx.storage.put(TOWNHALL_KEYS.groups, groups)
      parentToRefresh = updated.groupParent
    } else if (data.action === 'ungroup') {
      for (const [pid, kids] of Object.entries(groups)) {
        if (kids.includes(item.id)) groups[pid] = kids.filter((k) => k !== item.id)
      }
      await this.ctx.storage.put(TOWNHALL_KEYS.groups, groups)
      parentToRefresh = item.groupParent
    }

    const spotlightId = (await this.ctx.storage.get<string | null>(TOWNHALL_KEYS.spotlight)) ?? null
    await this.broadcastItemChange({ item: updated, wasAudienceVisible: wasVisible, isNew: false, rev, spotlightId, groups })

    if (parentToRefresh) {
      const parent = await this.loadItem(parentToRefresh)
      if (parent) {
        await this.broadcastItemChange({
          item: parent,
          wasAudienceVisible: isAudienceVisible(parent.status),
          isNew: false,
          rev,
          spotlightId,
          groups,
        })
      }
    }
  }

  // ── persistBoard (called on session close) ────────────────────────────────

  async persistBoard(sessionId: string, closedAt: number): Promise<void> {
    const index = (await this.ctx.storage.get<string[]>(TOWNHALL_KEYS.index)) ?? []
    if (index.length === 0) return
    const groups = await this.loadGroups()
    const spotlitHistory = new Set((await this.ctx.storage.get<string[]>(TOWNHALL_KEYS.spotlitHistory)) ?? [])
    const statements: import('@cloudflare/workers-types').D1PreparedStatement[] = []
    for (const id of index) {
      const item = await this.loadItem(id)
      if (!item) continue
      let upvotes = item.upvotes
      const childIds = groups[item.id] ?? []
      if (childIds.length > 0) {
        const sets: string[][] = [await this.loadUpvoters(item.id)]
        for (const cid of childIds) sets.push(await this.loadUpvoters(cid))
        upvotes = mergedUpvoteCount(sets)
      }
      const resolvedAt = item.status === 'answered' || item.status === 'dismissed' ? closedAt : null
      statements.push(
        this.env.DB.prepare(
          `INSERT OR REPLACE INTO townhall_questions
             (id, session_id, body, display_name, author_hash, status, upvotes, group_parent, was_spotlit, created_at, resolved_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
        ).bind(
          item.id, sessionId, item.body, item.displayName, item.authorHash,
          item.status, upvotes, item.groupParent,
          spotlitHistory.has(item.id) ? 1 : 0,
          item.createdAt, resolvedAt,
        ),
      )
    }
    if (statements.length > 0) await this.env.DB.batch(statements)
  }
}
