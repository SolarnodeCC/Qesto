/**
 * SDK-JAVASCRIPT-V1 — minimal Public API v1 client.
 */
export class QestoClient {
  private apiKey: string
  private baseUrl: string

  constructor(options: { apiKey: string; baseUrl?: string }) {
    if (!options?.apiKey) throw new Error('apiKey is required')
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ?? 'https://qesto.cc').replace(/\/$/, '')
  }

  async #request(path: string) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
    })
    const json = (await res.json()) as { ok?: boolean; data?: unknown; error?: { message?: string } }
    if (!res.ok || !json.ok) {
      throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
    }
    return json.data
  }

  listSessions() {
    return this.#request('/api/v1/sessions')
  }

  getSessionResults(sessionId: string) {
    return this.#request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/results`)
  }
}
