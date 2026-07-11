import { LIVE_PROTOCOL_VERSION, LIVE_PROTOCOL_VERSION_V3, type ServerMessage } from '../realtime'

export function serverMessage(msg: ServerMessage): string {
  return JSON.stringify({ v: LIVE_PROTOCOL_VERSION, ...msg })
}

/**
 * Loose v1-envelope builder for the per-mode collaborator handlers
 * (townhall/ideate/retro/deliberate/energizer), whose payloads are broader
 * than the strict ServerMessage union.
 */
export function serverMsg(msg: Omit<ServerMessage, 'v'> | object): string {
  return JSON.stringify({ v: LIVE_PROTOCOL_VERSION, ...msg })
}

/** v3-envelope builder for the v3 surfaces (captions / reactions / XR). */
export function serverMsgV3(msg: object): string {
  return JSON.stringify({ v: LIVE_PROTOCOL_VERSION_V3, ...msg })
}

export function now(): number {
  return Date.now()
}

export function errorMessage(code: string, message: string): string {
  return serverMessage({ type: 'error', data: { code, message }, timestamp: now() })
}
