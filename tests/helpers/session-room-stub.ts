// In-memory SESSION_ROOM namespace for integration tests. Each stub owns a
// fresh SessionRoom backed by a MockDurableObjectState, keyed by the DO name
// (= session id). `idFromName` returns a handle, `get` returns a stub with
// `.fetch(url, init)` that dispatches to the underlying SessionRoom.

import { SessionRoom } from '../../functions/api/SessionRoom'
import type { Env } from '../../functions/api/types'
import { MockDurableObjectState } from './do-mock'

type StubHandle = { name: string }

type Namespace = {
  idFromName: (name: string) => StubHandle
  get: (id: StubHandle) => { fetch: (input: string | Request, init?: RequestInit) => Promise<Response> }
}

export function makeSessionRoomNamespace(env: Env): Namespace {
  const rooms = new Map<string, SessionRoom>()
  function roomFor(name: string): SessionRoom {
    let r = rooms.get(name)
    if (!r) {
      const state = new MockDurableObjectState()
      r = new SessionRoom(state as unknown as DurableObjectState, env)
      rooms.set(name, r)
    }
    return r
  }
  return {
    idFromName(name) {
      return { name }
    },
    get(id) {
      const room = roomFor(id.name)
      return {
        fetch(input, init) {
          const req = input instanceof Request ? input : new Request(input, init)
          return room.fetch(req)
        },
      }
    },
  }
}
