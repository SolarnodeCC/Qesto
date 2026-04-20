import type { Env } from './types'

// SessionRoom — Durable Object hosting LIVE session state (ADR-0001).
// v1 Phase 0: empty stub so wrangler can register the class and run migrations.
// v1 Phase 3 fills this in with:
//   - WebSocket upgrade + subprotocol JWT auth
//   - current question / vote tallies / presenter cursor in this.state.storage
//   - broadcast loop for init / question / results / participants / timer
//   - reconnect with state replay
//   - close() persisting totals to D1 then releasing connections

export class SessionRoom implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    // Touch fields so tsc sees them as used until Phase 3 wires the DO fully.
    void this.state
    void this.env
  }

  async fetch(_req: Request): Promise<Response> {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'not_implemented', message: 'SessionRoom DO is a Phase 0 stub; LIVE wiring lands in Phase 3.' },
      }),
      { status: 501, headers: { 'content-type': 'application/json' } },
    )
  }
}
