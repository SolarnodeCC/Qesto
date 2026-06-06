/**
 * session-room-context.ts
 * Shared host surface + mutable state shape for SessionRoom collaborators.
 *
 * SessionRoom owns the Durable Object lifecycle (fetch / hibernation / alarm)
 * and exposes itself as a `SessionRoomContext` to the extracted handler modules
 * (rest / live / alarm) so they can read storage, broadcast, and mutate the
 * in-memory caches without each owning a copy of the orchestration.
 * Part of the TD-01 decomposition. See TECH_DEBT_AUDIT_2026-05.md TD-01.
 */

import type { Env } from '../types'
import type { RateLimiter } from './session-room-rate-limiter'
import type { EnergizerHandler } from './session-room-energizer-handler'
import type { TownhallHandler } from './session-room-townhall-handler'
import type { RetroHandler } from './session-room-retro-handler'
import type { IdeateHandler } from './session-room-ideate-handler'
import type { VoteFlushState } from './session-room-persistence'
import type { Votes } from './session-room-types'

/**
 * Mutable in-memory session state. Extends VoteFlushState so it can be passed
 * straight to the persistence helpers (flush / snapshot / hydrate).
 */
export interface SessionRoomState extends VoteFlushState {
  resultsDirty: boolean
  lastSnapshotAt: number
}

export function createSessionRoomState(): SessionRoomState {
  return {
    resultsDirty: false,
    voteBuffer: [],
    lastFlushAt: Date.now(),
    flushScheduled: false,
    lastSnapshotAt: Date.now(),
    _voters: null,
    _counts: null,
  }
}

/**
 * Surface the extracted handler modules consume. SessionRoom implements this
 * interface and passes `this` to the module-level functions.
 */
export interface SessionRoomContext {
  readonly ctx: DurableObjectState
  readonly env: Env
  readonly state: SessionRoomState
  readonly rateLimiter: RateLimiter
  readonly energizerHandler: EnergizerHandler
  readonly townhallHandler: TownhallHandler
  readonly retroHandler: RetroHandler
  readonly ideateHandler: IdeateHandler

  ensureVoters(): Promise<Votes>
  resetVoters(voters: Votes): void
  scheduleAlarm(targetMs: number): Promise<void>
  scheduleFlush(): void
  scheduleResultsBroadcast(): Promise<void>
  flushVotes(): Promise<void>
  snapshot(): Promise<void>
  hydrate(): Promise<void>
  jsonOk(data: unknown): Response
  jsonError(status: number, code: string, message: string): Response
}

/** Narrow storage surface the per-mode collaborators (energizer/townhall/…) accept. */
export interface DurableContextLike {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
  }
  getWebSockets(tag?: string): WebSocket[]
}

/**
 * Thin, fully-typed adapter from the runtime DurableObjectState to the narrow
 * surface the collaborators require — replaces the previous `ctx as any` casts.
 * The DO storage `delete` returns Promise<boolean>; collaborators only need
 * Promise<void>, so we discard the result explicitly here.
 */
export function toHandlerContext(ctx: DurableObjectState): DurableContextLike {
  return {
    storage: {
      get<T>(key: string): Promise<T | undefined> {
        return ctx.storage.get<T>(key)
      },
      put<T>(key: string, value: T): Promise<void> {
        return ctx.storage.put<T>(key, value)
      },
      async delete(key: string): Promise<void> {
        await ctx.storage.delete(key)
      },
    },
    getWebSockets(tag?: string): WebSocket[] {
      return ctx.getWebSockets(tag)
    },
  }
}
