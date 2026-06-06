/**
 * NOTION-COMPLETE-01 — Notion OAuth + page append on session close (Sprint 41).
 */
import type {
  IntegrationProvider,
  ProviderConfig,
  SessionResults,
  TokenResponse,
  WebhookEvent,
} from '../types'
import { absent } from '../../absent'

interface NotionOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export class NotionProvider implements IntegrationProvider {
  constructor(private readonly config: NotionOAuthConfig) {}

  getAuthUrl(state: string, _nonce: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      owner: 'user',
      state,
    })
    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`
  }

  async exchangeCode(code: string, _codeVerifier: string): Promise<TokenResponse> {
    const credentials = btoa(`${this.config.clientId}:${this.config.clientSecret}`)
    const res = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
      }),
    })
    const json = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      workspace_name?: string
      error?: string
    }
    if (!res.ok || !json.access_token) {
      throw new Error(`Notion OAuth failed: ${json.error ?? res.statusText}`)
    }
    return {
      access_token: json.access_token,
      ...(json.refresh_token ? { refresh_token: json.refresh_token } : {}),
      token_type: 'bearer',
    }
  }

  async send(results: SessionResults, config: ProviderConfig): Promise<void> {
    const token = (config as ProviderConfig & { accessToken?: string }).accessToken
    const pageId = config.databaseId as string | undefined
    if (!token || !pageId) throw new Error('notion_not_configured')
    const text = `${results.sessionTitle}\n${results.questions.map((q) => q.prompt).join('\n')}`.slice(0, 2000)
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { page_id: pageId },
        properties: {
          title: { title: [{ text: { content: results.sessionTitle.slice(0, 100) } }] },
        },
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
          },
        ],
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      throw new Error(`Notion page create failed: ${res.status} ${errText}`)
    }
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
  NOTION_CLIENT_SECRET?: string
  API_URL?: string
  PAGES_URL?: string
}): NotionProvider | null {
  if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) return absent<NotionProvider>()
  const base = (env.API_URL ?? env.PAGES_URL)?.replace(/\/$/, '')
  if (!base) return absent<NotionProvider>()
  return new NotionProvider({
    clientId: env.NOTION_CLIENT_ID,
    clientSecret: env.NOTION_CLIENT_SECRET,
    redirectUri: `${base}/api/integrations/notion/callback`,
  })
}
