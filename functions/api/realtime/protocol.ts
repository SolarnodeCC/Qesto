// Wire-format protocol versioning + capability flags for the SessionRoom WS.
// The SPEC_REALTIME.md taxonomy is the north star; versions/features get added
// alongside new client features, never ahead of them.
import { getFlag } from '../lib/flags'

export const LIVE_PROTOCOL_VERSION = 1
export const LIVE_PROTOCOL_VERSION_V2 = 2
export const LIVE_PROTOCOL_VERSION_V3 = 3
export type LiveProtocolVersion = 1 | 2 | 3

export const SUPPORTED_LIVE_PROTOCOL_VERSIONS: LiveProtocolVersion[] = [1, 2, 3]

export function defaultLiveProtocolVersion(env: {
  REALTIME_V2_DEFAULT?: string
  REALTIME_V2_ENABLED?: string
  REALTIME_V3_ENABLED?: string
}): LiveProtocolVersion {
  if (getFlag(env, 'REALTIME_V2_DEFAULT') && env.REALTIME_V2_ENABLED !== 'false') return 2
  return 1
}

export function isLiveProtocolSupported(
  version: number | undefined,
  env: { REALTIME_V2_ENABLED?: string; REALTIME_V2_DEFAULT?: string; REALTIME_V3_ENABLED?: string },
): boolean {
  const v = version ?? defaultLiveProtocolVersion(env)
  if (v === 1) return true
  if (v === 2) return getFlag(env, 'REALTIME_V2_ENABLED') || getFlag(env, 'REALTIME_V2_DEFAULT')
  if (v === 3) return getFlag(env, 'REALTIME_V3_ENABLED')
  return false
}

export function liveProtocolFeatures(version: LiveProtocolVersion): string[] {
  if (version === 2) return ['delta_results', 'participants_delta']
  if (version === 3) return ['delta_results', 'participants_delta', 'results_delta']
  return []
}

// TOWNHALL (ADR-0044). Townhall messages are an additive family on v1, gated by an
// env flag rather than a protocol version bump. The DO appends this string to the
// `init.features` array when the flag is on and the session is in townhall mode, so
// clients capability-detect the same way they do for `delta_results`.
export const TOWNHALL_FEATURE = 'townhall_board'
export const IDEATE_FEATURE = 'ideate_board'

export function townhallEnabled(env: { REALTIME_TOWNHALL_ENABLED?: string }): boolean {
  return getFlag(env, 'REALTIME_TOWNHALL_ENABLED')
}

export type VersionedClientEnvelope = {
  v?: LiveProtocolVersion
  type?: string
  data?: unknown
  timestamp?: number
}

// Close codes (SPEC_REALTIME.md §WebSocket Protocol).
export const CLOSE_NORMAL = 1000
export const CLOSE_POLICY_VIOLATION = 1008
export const CLOSE_SERVER_ERROR = 1011

// Subprotocol prefix for presenter auth: `qesto.bearer.<JWT>`.
export const PRESENTER_SUBPROTOCOL_PREFIX = 'qesto.bearer.'
