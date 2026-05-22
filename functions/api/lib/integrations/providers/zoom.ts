/**
 * ZOOM-01 — Zoom integration provider (OAuth skeleton, Sprint 35).
 * Full OAuth + session-close chat post ships when ZOOM_CLIENT_ID/SECRET are configured.
 */
import type {
  IntegrationProvider,
  ProviderConfig,
  SessionResults,
  TokenResponse,
  WebhookEvent,
} from '../types'

export class ZoomProvider implements IntegrationProvider {
  constructor(
    private readonly clientId: string,
    private readonly redirectUri: string,
  ) {}

  getAuthUrl(_state: string, _nonce: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
    })
    return `https://zoom.us/oauth/authorize?${params.toString()}`
  }

  async exchangeCode(_code: string, _codeVerifier: string): Promise<TokenResponse> {
    throw new Error('zoom_oauth_not_implemented')
  }

  async refreshToken(_refreshToken: string): Promise<TokenResponse> {
    throw new Error('zoom_refresh_not_implemented')
  }

  async send(_results: SessionResults, _config: ProviderConfig): Promise<void> {
    throw new Error('zoom_send_not_implemented')
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
  APP_URL?: string
}): ZoomProvider | null {
  if (!env.ZOOM_CLIENT_ID || !env.APP_URL) return null
  const redirectUri = `${env.APP_URL.replace(/\/$/, '')}/api/integrations/zoom/callback`
  return new ZoomProvider(env.ZOOM_CLIENT_ID, redirectUri)
}
