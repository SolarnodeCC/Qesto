/**
 * ZOOM-COMPLETE-01 — Zoom OAuth + session-close chat notification (Sprint 40).
 */
import type {
  IntegrationProvider,
  ProviderConfig,
  SessionResults,
  TokenResponse,
  WebhookEvent,
} from '../types'

const ZOOM_AUTH_URL = 'https://zoom.us/oauth/authorize'
const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token'
const ZOOM_API_BASE = 'https://api.zoom.us/v2'

interface ZoomOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

interface ZoomTokenJson {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  reason?: string
}

export interface ZoomIntegrationConfig extends ProviderConfig {
  service: 'zoom'
  /** Zoom user id for chat API (optional until first connect metadata). */
  zoomUserId?: string
  accountId?: string
}

export class ZoomProvider implements IntegrationProvider {
  constructor(private readonly config: ZoomOAuthConfig) {}

  getAuthUrl(state: string, _nonce: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
    })
    return `${ZOOM_AUTH_URL}?${params.toString()}`
  }

  private basicAuthHeader(): string {
    const raw = `${this.config.clientId}:${this.config.clientSecret}`
    return `Basic ${btoa(raw)}`
  }

  async exchangeCode(code: string, _codeVerifier: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
    })
    const res = await fetch(ZOOM_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.basicAuthHeader(),
      },
      body,
    })
    const json = (await res.json()) as ZoomTokenJson
    if (!res.ok || !json.access_token) {
      throw new Error(`Zoom OAuth failed: ${json.error ?? json.reason ?? res.statusText}`)
    }
    return {
      access_token: json.access_token,
      ...(json.refresh_token ? { refresh_token: json.refresh_token } : {}),
      ...(json.expires_in ? { expires_in: json.expires_in } : {}),
      token_type: json.token_type ?? 'bearer',
      ...(json.scope ? { scope: json.scope } : {}),
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    const res = await fetch(ZOOM_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.basicAuthHeader(),
      },
      body,
    })
    const json = (await res.json()) as ZoomTokenJson
    if (!res.ok || !json.access_token) {
      throw new Error(`Zoom token refresh failed: ${json.error ?? json.reason ?? res.statusText}`)
    }
    return {
      access_token: json.access_token,
      ...(json.refresh_token ? { refresh_token: json.refresh_token } : {}),
      ...(json.expires_in ? { expires_in: json.expires_in } : {}),
      token_type: json.token_type ?? 'bearer',
    }
  }

  async send(results: SessionResults, config: ProviderConfig): Promise<void> {
    const zoomConfig = config as ZoomIntegrationConfig & { accessToken?: string }
    const token = zoomConfig.accessToken
    if (!token) {
      throw new Error('zoom_token_missing')
    }
    const lines = [
      `Session closed: ${results.sessionTitle}`,
      `Questions: ${results.questions.length}`,
      ...results.questions.slice(0, 5).map((q, i) => `${i + 1}. ${q.prompt}`),
    ]
    const message = lines.join('\n')
    const userId = zoomConfig.zoomUserId ?? 'me'
    const res = await fetch(`${ZOOM_API_BASE}/chat/users/${encodeURIComponent(userId)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        to_contact: userId === 'me' ? undefined : userId,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      throw new Error(`Zoom chat post failed: ${res.status} ${errText}`)
    }
  }

  async verifyWebhook(_req: Request, _secret: string): Promise<WebhookEvent> {
    throw new Error('zoom_webhook_not_implemented')
  }

  canSyncFormat(_format: 'json' | 'pdf' | 'docx'): boolean {
    return false
  }
}

export function getZoomProvider(env: {
  ZOOM_CLIENT_ID?: string
  ZOOM_CLIENT_SECRET?: string
  API_URL?: string
  PAGES_URL?: string
}): ZoomProvider | null {
  if (!env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET) return null
  const base = (env.API_URL ?? env.PAGES_URL)?.replace(/\/$/, '')
  if (!base) return null
  const redirectUri = `${base}/api/integrations/zoom/callback`
  return new ZoomProvider({
    clientId: env.ZOOM_CLIENT_ID,
    clientSecret: env.ZOOM_CLIENT_SECRET,
    redirectUri,
  })
}
