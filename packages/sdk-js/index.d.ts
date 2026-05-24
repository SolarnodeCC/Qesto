export type QestoClientOptions = { apiKey: string; baseUrl?: string }

export declare class QestoClient {
  constructor(options: QestoClientOptions)
  listSessions(): Promise<{ sessions: unknown[] }>
  getSessionResults(sessionId: string): Promise<unknown>
}
