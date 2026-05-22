/**
 * SF-01/02 — Salesforce integration provider skeleton.
 */
import type {
  IntegrationProvider,
  ProviderConfig,
  SessionResults,
  TokenResponse,
  WebhookEvent,
} from '../types'

export class SalesforceProvider implements IntegrationProvider {
  constructor(
    private readonly clientId: string,
    private readonly redirectUri: string,
  ) {}

  getAuthUrl(state: string, _nonce: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
    })
    return `https://login.salesforce.com/services/oauth2/authorize?${params.toString()}`
  }

  async exchangeCode(_code: string, _codeVerifier: string): Promise<TokenResponse> {
    throw new Error('salesforce_oauth_not_implemented')
  }

  async send(_results: SessionResults, _config: ProviderConfig): Promise<void> {
    throw new Error('salesforce_push_not_implemented')
  }

  async verifyWebhook(_req: Request, _secret: string): Promise<WebhookEvent> {
    throw new Error('salesforce_webhook_not_implemented')
  }

  canSyncFormat(format: 'json' | 'pdf' | 'docx'): boolean {
    return format === 'json'
  }
}

export function getSalesforceProvider(env: {
  SALESFORCE_CLIENT_ID?: string
  APP_URL?: string
}): SalesforceProvider | null {
  if (!env.SALESFORCE_CLIENT_ID || !env.APP_URL) return null
  const redirectUri = `${env.APP_URL.replace(/\/$/, '')}/api/integrations/salesforce/callback`
  return new SalesforceProvider(env.SALESFORCE_CLIENT_ID, redirectUri)
}
