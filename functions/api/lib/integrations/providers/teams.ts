// TeamsProvider — TEAMS-01 IntegrationProvider for Microsoft Teams channel notifications.
//
// OAuth2 flow (Microsoft identity platform, v2.0):
//   1. Host hits /api/integrations/teams/connect — redirects to Microsoft with
//      `state` + PKCE `code_challenge`. The `code_verifier` is persisted in
//      INTEGRATIONS_KV under `oauth:pkce:{state}` so the callback can retrieve it.
//   2. Microsoft redirects back to /api/integrations/teams/callback?code=...&state=...
//   3. We exchange the code at the v2.0 token endpoint (with code_verifier) and
//      persist the access/refresh tokens via EncryptedTokenStore.
//   4. Microsoft does NOT return any channel binding from the token endpoint, so
//      the host follows up with POST /api/integrations/teams/config to declare
//      the target `{ groupId, channelId, channelName }`. Without that config we
//      skip delivery silently on session close.
//
// Outbound delivery uses Microsoft Graph chat-message API and an Adaptive Card
// attachment. The scope `ChannelMessage.Send` is sufficient to POST a message
// to a channel; `offline_access` is required to receive a refresh_token.

import type {
  IntegrationProvider,
  ProviderConfig,
  SessionResults,
  TokenResponse,
  WebhookEvent,
} from '../types'

const MS_AUTH_BASE = 'https://login.microsoftonline.com'
const MS_GRAPH_BASE = 'https://graph.microsoft.com'

// Space-separated per OAuth2 spec; Microsoft's v2.0 endpoint expects this form.
// `ChannelMessage.Send` covers POST /teams/{id}/channels/{id}/messages;
// `offline_access` is required to receive a refresh token.
const TEAMS_SCOPES = 'https://graph.microsoft.com/ChannelMessage.Send offline_access'

interface MicrosoftTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

interface TeamsOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  /** AAD tenant ID, GUID or `common`/`organizations`/`consumers`. */
  tenantId: string
}

export class TeamsProvider implements IntegrationProvider {
  constructor(private readonly teamsConfig: TeamsOAuthConfig) {}

  private get authorizeEndpoint(): string {
    return `${MS_AUTH_BASE}/${this.teamsConfig.tenantId}/oauth2/v2.0/authorize`
  }

  private get tokenEndpoint(): string {
    return `${MS_AUTH_BASE}/${this.teamsConfig.tenantId}/oauth2/v2.0/token`
  }

  /**
   * Build the Microsoft v2.0 authorize URL. `nonce` is interpreted as the PKCE
   * code_challenge (S256) so the route handler can supply a challenge derived
   * from the verifier it stored in KV.
   */
  getAuthUrl(state: string, nonce: string): string {
    const params = new URLSearchParams({
      client_id: this.teamsConfig.clientId,
      response_type: 'code',
      redirect_uri: this.teamsConfig.redirectUri,
      response_mode: 'query',
      scope: TEAMS_SCOPES,
      state,
      code_challenge: nonce,
      code_challenge_method: 'S256',
      // Force a consent prompt the first time so the user picks the right account.
      prompt: 'select_account',
    })
    return `${this.authorizeEndpoint}?${params}`
  }

  /**
   * Exchange the authorization code for an access/refresh token pair.
   * Microsoft returns errors as JSON with a 400, so inspect the body either way.
   */
  async exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.teamsConfig.clientId,
      client_secret: this.teamsConfig.clientSecret,
      redirect_uri: this.teamsConfig.redirectUri,
      code_verifier: codeVerifier,
      scope: TEAMS_SCOPES,
    })
    const res = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })
    const json = (await res.json().catch(() => ({}))) as MicrosoftTokenResponse
    if (!res.ok || !json.access_token) {
      const msg = json.error_description ?? json.error ?? `HTTP ${res.status}`
      throw new Error(`Microsoft OAuth failed: ${msg}`)
    }
    const out: TokenResponse = {
      access_token: json.access_token,
      token_type: json.token_type ?? 'Bearer',
      scope: json.scope ?? TEAMS_SCOPES,
    }
    if (json.refresh_token) out.refresh_token = json.refresh_token
    if (typeof json.expires_in === 'number') out.expires_in = json.expires_in
    return out
  }

  /**
   * Post an Adaptive Card session-summary to a Microsoft Teams channel via Graph.
   * Requires `config.accessToken`, `config.groupId`, and `config.channelId`.
   */
  async send(payload: SessionResults, config: ProviderConfig): Promise<void> {
    const accessToken =
      typeof config['accessToken'] === 'string' ? (config['accessToken'] as string) : ''
    const groupId = typeof config['groupId'] === 'string' ? (config['groupId'] as string) : ''
    const channelId =
      typeof config['channelId'] === 'string' ? (config['channelId'] as string) : ''
    if (!accessToken || !groupId || !channelId) {
      throw new Error('Teams: missing accessToken, groupId, or channelId')
    }
    const body = buildAdaptiveCardMessage(payload)
    const url = `${MS_GRAPH_BASE}/v1.0/teams/${encodeURIComponent(groupId)}/channels/${encodeURIComponent(channelId)}/messages`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Teams Graph send HTTP ${res.status}: ${res.statusText} ${text}`)
    }
  }

  /**
   * Inbound webhooks (Graph change-notifications) are not part of TEAMS-01.
   */
  async verifyWebhook(_req: Request, _secret: string): Promise<WebhookEvent> {
    throw new Error('Teams inbound webhooks not implemented')
  }

  /**
   * Notification-only provider — no document/export sync formats are supported.
   */
  canSyncFormat(_format: 'json' | 'pdf' | 'docx'): boolean {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive Card payload construction
// ─────────────────────────────────────────────────────────────────────────────

interface AdaptiveCardBlock {
  type: string
  [key: string]: unknown
}

/**
 * Build the Graph `messages` request body containing an Adaptive Card attachment
 * with a TextBlock header, vote-count line, and one FactSet per question.
 *
 * We keep the top-3 options per question to bound card size — Adaptive Cards
 * have a practical render limit around ~28 KB and Graph rejects oversized cards.
 */
export function buildAdaptiveCardMessage(payload: SessionResults): Record<string, unknown> {
  const totalVotes = payload.questions.reduce((sum, q) => {
    if (!q.options) return sum
    return sum + q.options.reduce((s, o) => s + o.votes, 0)
  }, 0)

  const body: AdaptiveCardBlock[] = [
    {
      type: 'TextBlock',
      size: 'Large',
      weight: 'Bolder',
      text: `Session complete: ${payload.sessionTitle}`,
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: `${totalVotes} vote${totalVotes === 1 ? '' : 's'} collected`,
      isSubtle: true,
      spacing: 'Small',
    },
  ]

  for (const q of payload.questions) {
    body.push({
      type: 'TextBlock',
      text: q.prompt,
      weight: 'Bolder',
      wrap: true,
      spacing: 'Medium',
    })
    if (q.options && q.options.length > 0) {
      const total = q.options.reduce((s, o) => s + o.votes, 0)
      const top = [...q.options].sort((a, b) => b.votes - a.votes).slice(0, 3)
      body.push({
        type: 'FactSet',
        facts: top.map((opt) => {
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0
          return { title: opt.label, value: `${opt.votes} (${pct}%)` }
        }),
      })
    }
  }

  return {
    body: {
      contentType: 'html',
      content: '<attachment id="qesto-summary"></attachment>',
    },
    attachments: [
      {
        id: 'qesto-summary',
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: JSON.stringify({
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body,
        }),
        name: null,
        thumbnailUrl: null,
      },
    ],
  }
}
