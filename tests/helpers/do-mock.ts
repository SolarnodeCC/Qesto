// Minimal in-process harness for a SessionRoom Durable Object. Simulates the
// slice of the runtime used by SessionRoom.ts — storage + alarm + hibernated
// WebSocket registry. Not a general-purpose DO shim.

export class MockDurableObjectStorage {
  private readonly map = new Map<string, unknown>()
  private alarm: number | null = null

  // Runtime also accepts a string[] (batched get), matching the real DO storage
  // overload used via `ctx.storage.get<T>(keys)` in toHandlerContext.getMany —
  // kept off the declared type so existing single-key monkeypatches in tests
  // (see do-storage-retry.test.ts) stay assignable.
  async get<T>(key: string): Promise<T | undefined> {
    if (Array.isArray(key)) {
      const out = new Map<string, unknown>()
      for (const k of key as string[]) {
        if (this.map.has(k)) out.set(k, this.map.get(k))
      }
      return out as unknown as T | undefined
    }
    return this.map.get(key) as T | undefined
  }
  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value)
  }
  async delete(key: string): Promise<boolean> {
    return this.map.delete(key)
  }
  async list<T = unknown>(): Promise<Map<string, T>> {
    return new Map(this.map) as Map<string, T>
  }
  async getAlarm(): Promise<number | null> {
    return this.alarm
  }
  async setAlarm(time: number): Promise<void> {
    this.alarm = time
  }
}

export class MockWebSocket {
  readonly received: string[] = []
  private attachment: unknown = null
  closed = false
  closeCode: number | null = null
  closeReason: string | null = null
  readyState = 1 // OPEN

  send(msg: string): void {
    if (this.closed) throw new Error('send after close')
    this.received.push(msg)
  }

  close(code?: number, reason?: string): void {
    if (this.closed) return
    this.closed = true
    this.closeCode = code ?? 1005
    this.closeReason = reason ?? ''
    this.readyState = 3 // CLOSED
  }

  serializeAttachment(value: unknown): void {
    this.attachment = structuredClone(value)
  }

  deserializeAttachment(): unknown {
    return this.attachment ? structuredClone(this.attachment) : null
  }

  messages<T = unknown>(): T[] {
    return this.received.map((r) => JSON.parse(r) as T)
  }
}

export class MockDurableObjectState {
  readonly storage = new MockDurableObjectStorage()
  private readonly sockets = new Map<MockWebSocket, string[]>()

  acceptWebSocket(ws: MockWebSocket, tags: string[] = []): void {
    this.sockets.set(ws, tags)
  }

  getWebSockets(tag?: string): MockWebSocket[] {
    if (!tag) return [...this.sockets.keys()].filter((ws) => !ws.closed)
    return [...this.sockets.entries()]
      .filter(([ws, tags]) => !ws.closed && tags.includes(tag))
      .map(([ws]) => ws)
  }

  dropClosed(): void {
    for (const ws of [...this.sockets.keys()]) {
      if (ws.closed) this.sockets.delete(ws)
    }
  }
}
