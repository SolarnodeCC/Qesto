import type { LiveEnergizerState } from '../realtime'
import type { ValidClientMessage } from './protocol-schemas'
import type { Attachment } from './session-room-types'
import type { EnergizerHandler } from './session-room-energizer-handler'
import type { TownhallHandler } from './session-room-townhall-handler'
import type { RetroHandler } from './session-room-retro-handler'
import type { IdeateHandler } from './session-room-ideate-handler'
import type { DeliberateHandler } from './session-room-deliberate-handler'
import type { CaptionsHandler } from './session-room-captions-handler'
import type { ReactionsHandler } from './session-room-reactions-handler'

export type ClientWsHandler = (ws: WebSocket, att: Attachment, msg: ValidClientMessage) => Promise<void>

export type SessionRoomRouterDeps = {
  handleVote: (ws: WebSocket, att: Attachment, data: Extract<ValidClientMessage, { type: 'vote' }>['data']) => Promise<void>
  handlePresenterAdvance: (ws: WebSocket, att: Attachment) => Promise<void>
  handlePresenterBack: (ws: WebSocket, att: Attachment) => Promise<void>
  handleAddQuestion: (
    ws: WebSocket,
    att: Attachment,
    data: Extract<ValidClientMessage, { type: 'add_question' }>['data'],
  ) => Promise<void>
  sendInit: (ws: WebSocket, att: Attachment) => Promise<void>
  handlePresenterPauseResume: (ws: WebSocket, att: Attachment, paused: boolean) => Promise<void>
  handleApproveResponse: (
    ws: WebSocket,
    att: Attachment,
    data: Extract<ValidClientMessage, { type: 'approve_response' }>['data'],
  ) => Promise<void>
  handleRejectResponse: (
    ws: WebSocket,
    att: Attachment,
    data: Extract<ValidClientMessage, { type: 'reject_response' }>['data'],
  ) => Promise<void>
  energizerHandler: EnergizerHandler
  townhallHandler: TownhallHandler
  retroHandler: RetroHandler
  ideateHandler: IdeateHandler
  deliberateHandler: DeliberateHandler
  captionsHandler: CaptionsHandler
  reactionsHandler: ReactionsHandler
}

export function buildClientWsHandlers(deps: SessionRoomRouterDeps): Record<ValidClientMessage['type'], ClientWsHandler> {
  return {
    vote: async (ws, att, msg) => {
      if (msg.type !== 'vote') return
      await deps.handleVote(ws, att, msg.data)
    },
    advance: async (ws, att) => {
      await deps.handlePresenterAdvance(ws, att)
    },
    back: async (ws, att) => {
      await deps.handlePresenterBack(ws, att)
    },
    add_question: async (ws, att, msg) => {
      if (msg.type !== 'add_question') return
      await deps.handleAddQuestion(ws, att, msg.data)
    },
    request_state: async (ws, att) => {
      await deps.sendInit(ws, att)
    },
    pause: async (ws, att) => {
      await deps.handlePresenterPauseResume(ws, att, true)
    },
    resume: async (ws, att) => {
      await deps.handlePresenterPauseResume(ws, att, false)
    },
    energizer_activate: async (ws, att, msg) => {
      if (msg.type !== 'energizer_activate') return
      await deps.energizerHandler.handleActivate(ws, att, msg.data.energizer as LiveEnergizerState)
    },
    energizer_answer: async (ws, att, msg) => {
      if (msg.type !== 'energizer_answer') return
      await deps.energizerHandler.handleAnswer(ws, att, msg.data)
    },
    energizer_advance: async (ws, att, msg) => {
      if (msg.type !== 'energizer_advance') return
      await deps.energizerHandler.handleAdvance(ws, att, msg.data)
    },
    townhall_submit: async (ws, att, msg) => {
      if (msg.type !== 'townhall_submit') return
      await deps.townhallHandler.handleSubmit(ws, att, { body: msg.data.body, displayName: msg.data.displayName })
    },
    townhall_upvote: async (ws, att, msg) => {
      if (msg.type !== 'townhall_upvote') return
      await deps.townhallHandler.handleUpvote(ws, att, msg.data)
    },
    townhall_moderate: async (ws, att, msg) => {
      if (msg.type !== 'townhall_moderate') return
      await deps.townhallHandler.handleModerate(ws, att, {
        itemId: msg.data.itemId,
        action: msg.data.action,
        groupParentId: msg.data.groupParentId,
      })
    },
    retro_submit: async (ws, att, msg) => {
      if (msg.type !== 'retro_submit') return
      await deps.retroHandler.handleSubmit(ws, att, { column: msg.data.column, body: msg.data.body })
    },
    retro_upvote: async (ws, att, msg) => {
      if (msg.type !== 'retro_upvote') return
      await deps.retroHandler.handleUpvote(ws, att, { itemId: msg.data.itemId })
    },
    ideate_submit: async (ws, att, msg) => {
      if (msg.type !== 'ideate_submit') return
      await deps.ideateHandler.handleSubmit(ws, att, { body: msg.data.body })
    },
    ideate_upvote: async (ws, att, msg) => {
      if (msg.type !== 'ideate_upvote') return
      await deps.ideateHandler.handleUpvote(ws, att, { itemId: msg.data.itemId })
    },
    ideate_reveal: async (ws, att, msg) => {
      if (msg.type !== 'ideate_reveal') return
      await deps.ideateHandler.handleReveal(ws, att)
    },
    ideate_dismiss: async (ws, att, msg) => {
      if (msg.type !== 'ideate_dismiss') return
      await deps.ideateHandler.handleDismiss(ws, att, { itemId: msg.data.itemId })
    },
    ideate_merge: async (ws, att, msg) => {
      if (msg.type !== 'ideate_merge') return
      await deps.ideateHandler.handleMerge(ws, att, {
        targetId: msg.data.targetId,
        sourceId: msg.data.sourceId,
      })
    },
    deliberate_cast: async (ws, att, msg) => {
      if (msg.type !== 'deliberate_cast') return
      await deps.deliberateHandler.handleCast(ws, att, { choice: msg.data.choice })
    },
    captions_start: async (ws, att, msg) => {
      if (msg.type !== 'captions_start') return
      await deps.captionsHandler.handleStart(ws, att, { sourceLocale: msg.data.sourceLocale })
    },
    captions_stop: async (ws, att, msg) => {
      if (msg.type !== 'captions_stop') return
      await deps.captionsHandler.handleStop(ws, att)
    },
    captions_set_locale: async (ws, att, msg) => {
      if (msg.type !== 'captions_set_locale') return
      await deps.captionsHandler.handleSetLocale(ws, att, { locale: msg.data.locale })
    },
    reaction_submit: async (ws, att, msg) => {
      if (msg.type !== 'reaction_submit') return
      await deps.reactionsHandler.handleSubmit(ws, att, { emojiId: msg.data.emojiId })
    },
    approve_response: async (ws, att, msg) => {
      if (msg.type !== 'approve_response') return
      await deps.handleApproveResponse(ws, att, msg.data)
    },
    reject_response: async (ws, att, msg) => {
      if (msg.type !== 'reject_response') return
      await deps.handleRejectResponse(ws, att, msg.data)
    },
  }
}
