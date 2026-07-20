// SlackProvider — ADR-0008 integration provider for Slack workspace messaging.
//
// OAuth2 flow:
//   1. Host hits /api/integrations/slack/connect — redirects to Slack with `state`
//   2. Slack redirects back to /api/integrations/slack/callback?code=...&state=...
//   3. We exchange code for `access_token` (bot token) and persist via EncryptedTokenStore
//
// Slack OAuth v2 deviates from generic OAuth2:
//   - No PKCE required for server-side bot flows
//   - Token endpoint returns a JSON envelope `{ ok, access_token, team, incoming_webhook, ... }`
//   - Scope parameter is comma-separated (not space-separated)
//
// Session close trigger calls send() with the team's channel configured via
// `integration:config:{teamId}:slack` and access token from EncryptedTokenStore.

import type {
  IntegrationProvider,
  ProviderConfig,
  SessionResults,
  TokenResponse,
  WebhookEvent,
} from '../types'

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize'
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access'
const SLACK_POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage'

// Bot-scope token grants chat.postMessage + channels.list.
const SLACK_SCOPES = 'chat:write,channels:read'

interface SlackOAuthResponse {
  ok: boolean
  access_token?: string
  token_type?: string
  scope?: string
  bot_user_id?: string
  app_id?: string
  team?: { id: string; name: string }
  incoming_webhook?: { channel_id: string; channel: string; url: string }
  error?: string
}

interface SlackPostMessageResponse {
  ok: boolean
  error?: string
  ts?: string
  channel?: string
}

interface SlackOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export class SlackProvider implements IntegrationProvider {
  constructor(private readonly slackConfig: SlackOAuthConfig) {}

  /**
   * Build the Slack OAuth2 authorize URL.
   * Slack does not require PKCE for server-side flows; `_nonce` is accepted for
   * IntegrationProvider interface parity but is unused.
   */
  getAuthUrl(state: string, _nonce: string): string {
    const params = new URLSearchParams({
      client_id: this.slackConfig.clientId,
      scope: SLACK_SCOPES,
      redirect_uri: this.slackConfig.redirectUri,
      state,
    })
    return `${SLACK_AUTH_URL}?${params}`
  }

  /**
   * Exchange Slack OAuth code for a bot access token.
   * Slack returns a JSON envelope with `ok: false` on errors instead of HTTP 4xx,
   * so we must inspect the body rather than relying on response.ok.
   */
  async exchangeCode(code: string, _codeVerifier: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      code,
      client_id: this.slackConfig.clientId,
      client_secret: this.slackConfig.clientSecret,
      redirect_uri: this.slackConfig.redirectUri,
    })
    const res = await fetch(SLACK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })
    if (!res.ok) {
      throw new Error(`Slack OAuth HTTP ${res.status}: ${res.statusText}`)
    }
    const json = (await res.json()) as SlackOAuthResponse
    if (!json.ok || !json.access_token) {
      throw new Error(`Slack OAuth failed: ${json.error ?? 'unknown'}`)
    }
    return {
      access_token: json.access_token,
      token_type: json.token_type ?? 'bot',
      scope: json.scope ?? SLACK_SCOPES,
    }
  }

  /**
   * Extract metadata needed for the integration config record (channel,
   * team name) from a fresh OAuth exchange response. The route handler calls
   * exchangeCodeWithMetadata directly when it needs both the token and the
   * channel binding established by the user during the OAuth consent screen.
   */
  async exchangeCodeWithMetadata(code: string): Promise<{
    token: TokenResponse
    teamName?: string
    channelId?: string
    channelName?: string
  }> {
    const params = new URLSearchParams({
      code,
      client_id: this.slackConfig.clientId,
      client_secret: this.slackConfig.clientSecret,
      redirect_uri: this.slackConfig.redirectUri,
    })
    const res = await fetch(SLACK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })
    if (!res.ok) {
      throw new Error(`Slack OAuth HTTP ${res.status}: ${res.statusText}`)
    }
    const json = (await res.json()) as SlackOAuthResponse
    if (!json.ok || !json.access_token) {
      throw new Error(`Slack OAuth failed: ${json.error ?? 'unknown'}`)
    }
    const out: {
      token: TokenResponse
      teamName?: string
      channelId?: string
      channelName?: string
    } = {
      token: {
        access_token: json.access_token,
        token_type: json.token_type ?? 'bot',
        scope: json.scope ?? SLACK_SCOPES,
      },
    }
    if (json.team?.name) out.teamName = json.team.name
    if (json.incoming_webhook?.channel_id) out.channelId = json.incoming_webhook.channel_id
    if (json.incoming_webhook?.channel) out.channelName = json.incoming_webhook.channel
    return out
  }

  /**
   * Post a session summary to the configured Slack channel.
   * Requires `config.accessToken` (string) and `config.channel` (channel ID).
   */
  async send(payload: SessionResults, config: ProviderConfig): Promise<void> {
    const accessToken = typeof config['accessToken'] === 'string' ? (config['accessToken'] as string) : ''
    const channel = config.channel
    if (!accessToken || !channel) {
      throw new Error('Slack: missing accessToken or channel')
    }
    const text = buildSlackMessage(payload)
    const res = await fetch(SLACK_POST_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ channel, text }),
    })
    if (!res.ok) {
      throw new Error(`Slack chat.postMessage HTTP ${res.status}: ${res.statusText}`)
    }
    const json = (await res.json()) as SlackPostMessageResponse
    if (!json.ok) {
      throw new Error(`Slack chat.postMessage failed: ${json.error ?? 'unknown'}`)
    }
  }

  /**
   * Slack inbound webhooks (event subscriptions) are out of scope for v2.2.
   * The provider only handles outbound notifications today.
   */
  async verifyWebhook(_req: Request, _secret: string): Promise<WebhookEvent> {
    throw new Error('Slack inbound webhooks are unsupported in v2.2')
  }

  canSyncFormat(format: 'json' | 'pdf' | 'docx'): boolean {
    return format === 'json'
  }
}

/**
 * Build a compact Markdown-ish summary suitable for Slack's chat.postMessage.
 * Keeps the top-3 options per poll question to bound message size.
 */
export function buildSlackMessage(payload: SessionResults): string {
  const lines: string[] = [`*Session complete: ${payload.sessionTitle}*`]
  lines.push(`_${new Date(payload.timestamp).toUTCString()}_`)
  lines.push('')
  for (const q of payload.questions) {
    lines.push(`• *${q.prompt}*`)
    if (q.options && q.options.length > 0) {
      const total = q.options.reduce((s, o) => s + o.votes, 0)
      const top = [...q.options].sort((a, b) => b.votes - a.votes).slice(0, 3)
      for (const opt of top) {
        const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0
        lines.push(`  ${opt.label}: ${opt.votes} (${pct}%)`)
      }
    }
  }
  return lines.join('\n')
}
