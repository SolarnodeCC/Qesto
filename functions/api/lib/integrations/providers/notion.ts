/**
 * NOTION-01 — Notion integration provider skeleton.
 */
import type {
  IntegrationProvider,
  ProviderConfig,
  SessionResults,
  TokenResponse,
  WebhookEvent,
} from '../types'

export class NotionProvider implements IntegrationProvider {
  constructor(private readonly clientId: string, private readonly redirectUri: string) {}

  getAuthUrl(state: string, _nonce: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      owner: 'user',
      state,
    })
    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`
  }

  async exchangeCode(_code: string, _codeVerifier: string): Promise<TokenResponse> {
    throw new Error('notion_oauth_not_implemented')
  }

  async send(_results: SessionResults, _config: ProviderConfig): Promise<void> {
    throw new Error('notion_send_not_implemented')
  }

  async verifyWebhook(_req: Request, _secret: string): Promise<WebhookEvent> {
    throw new Error('notion_webhook_not_implemented')
  }

  canSyncFormat(_format: 'json' | 'pdf' | 'docx'): boolean {
    return true
  }
}

export function getNotionProvider(env: {
  NOTION_CLIENT_ID?: string
  APP_URL?: string
}): NotionProvider | null {
  if (!env.NOTION_CLIENT_ID || !env.APP_URL) return null
  return new NotionProvider(env.NOTION_CLIENT_ID, `${env.APP_URL.replace(/\/$/, '')}/api/integrations/notion/callback`)
}
