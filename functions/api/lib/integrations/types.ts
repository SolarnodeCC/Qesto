/**
 * Shared types for integration providers (Slack, Notion, Airtable, etc.).
 * See ADR-INTEGRATION-FOUNDATION.md.
 */

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

export interface WebhookEvent {
  type: string
  timestamp: number
  data: Record<string, unknown>
}

export interface ProviderConfig {
  teamId: string
  service: 'slack' | 'notion' | 'airtable'
  channel?: string // For Slack
  databaseId?: string // For Notion
  baseId?: string // For Airtable
  [key: string]: unknown
}

export interface SessionResults {
  sessionId: string
  sessionTitle: string
  questions: Array<{
    id: string
    prompt: string
    options?: Array<{ id: string; label: string; votes: number }>
    responses?: string[]
  }>
  consent_posture: 'full' | 'partial' | 'none'
  timestamp: number
}

export interface SyncResult {
  service: string
  success: boolean
  error?: string
}

export interface IntegrationProvider {
  /**
   * Send session results to external service.
   */
  send(payload: SessionResults, config: ProviderConfig): Promise<void>

  /**
   * Verify and parse inbound webhook.
   */
  verifyWebhook(req: Request, secret: string): Promise<WebhookEvent>

  /**
   * Get OAuth authorization URL.
   */
  getAuthUrl(state: string, nonce: string): string

  /**
   * Exchange authorization code for token.
   */
  exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse>

  /**
   * Check if provider supports export format.
   */
  canSyncFormat(format: 'json' | 'pdf' | 'docx'): boolean
}
