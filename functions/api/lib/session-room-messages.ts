import { LIVE_PROTOCOL_VERSION, type ServerMessage } from '../realtime'

export function serverMessage(msg: ServerMessage): string {
  return JSON.stringify({ v: LIVE_PROTOCOL_VERSION, ...msg })
}

export function now(): number {
  return Date.now()
}

export function errorMessage(code: string, message: string): string {
  return serverMessage({ type: 'error', data: { code, message }, timestamp: now() })
}
