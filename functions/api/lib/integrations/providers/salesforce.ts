/**
 * SF-COMPLETE-01 — Salesforce OAuth + session results note (Sprint 40).
 */
import type {
  IntegrationProvider,
  ProviderConfig,
  SessionResults,
  TokenResponse,
  WebhookEvent,
} from '../types'
import { absent } from '../../absent'

interface SalesforceOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

interface SalesforceTokenJson {
  access_token?: string
  refresh_token?: string
  instance_url?: string
  id?: string
  token_type?: string
  issued_at?: string
  signature?: string
  error?: string
  error_description?: string
}

export interface SalesforceIntegrationConfig extends ProviderConfig {
  service: 'salesforce'
  instanceUrl: string
  access_token?: string
}

export class SalesforceProvider implements IntegrationProvider {
  constructor(private readonly config: SalesforceOAuthConfig) {}

  getAuthUrl(state: string, _nonce: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
    })
    return `https://login.salesforce.com/services/oauth2/authorize?${params.toString()}`
  }

  async exchangeCode(code: string, _codeVerifier: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
    })
    const res = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const json = (await res.json()) as SalesforceTokenJson
    if (!res.ok || !json.access_token) {
      throw new Error(`Salesforce OAuth failed: ${json.error_description ?? json.error ?? res.statusText}`)
    }
    const token: TokenResponse & { instance_url?: string } = {
      access_token: json.access_token,
      ...(json.refresh_token ? { refresh_token: json.refresh_token } : {}),
      token_type: json.token_type ?? 'Bearer',
    }
    if (json.instance_url) {
      ;(token as TokenResponse & { instance_url: string }).instance_url = json.instance_url
    }
    return token
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    })
    const res = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const json = (await res.json()) as SalesforceTokenJson
    if (!res.ok || !json.access_token) {
      throw new Error(`Salesforce refresh failed: ${json.error_description ?? json.error ?? res.statusText}`)
    }
    return {
      access_token: json.access_token,
      ...(json.refresh_token ? { refresh_token: refreshToken } : {}),
      token_type: json.token_type ?? 'Bearer',
      ...(json.instance_url ? { instance_url: json.instance_url } : {}),
    }
  }

  async send(results: SessionResults, config: ProviderConfig): Promise<void> {
    const sf = config as SalesforceIntegrationConfig & { accessToken?: string }
    const token = sf.accessToken
    const instanceUrl = sf.instanceUrl?.replace(/\/$/, '')
    if (!token || !instanceUrl) {
      throw new Error('salesforce_not_configured')
    }
    const title = `Qesto session: ${results.sessionTitle}`
    const body = results.questions
      .map((q, i) => `${i + 1}. ${q.prompt}`)
      .join('\n')
      .slice(0, 32000)
    const res = await fetch(`${instanceUrl}/services/data/v59.0/sobjects/Note`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Title: title.slice(0, 80),
        Body: body || title,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      throw new Error(`Salesforce Note create failed: ${res.status} ${errText}`)
    }
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
  SALESFORCE_CLIENT_SECRET?: string
  API_URL?: string
  PAGES_URL?: string
}): SalesforceProvider | null {
  if (!env.SALESFORCE_CLIENT_ID || !env.SALESFORCE_CLIENT_SECRET) return absent<SalesforceProvider>()
  const base = (env.API_URL ?? env.PAGES_URL)?.replace(/\/$/, '')
  if (!base) return absent<SalesforceProvider>()
  const redirectUri = `${base}/api/integrations/salesforce/callback`
  return new SalesforceProvider({
    clientId: env.SALESFORCE_CLIENT_ID,
    clientSecret: env.SALESFORCE_CLIENT_SECRET,
    redirectUri,
  })
}
