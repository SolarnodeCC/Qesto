---
id: ADR-0008
title: Integration Foundation
domain: architecture
status: accepted
version: 1.0
created: 2026-04-20
updated: 2026-05-11
tags:
  - integrations
  - webhooks
  - external-services
  - api-contracts
relates_to:
  - SPEC_INTEGRATIONS
  - SPEC_BACKEND
---

# ADR: Integration Provider Architecture

**Status:** Approved (Agent-Validated)  
**Date:** 2026-05-10  
**Author:** Architecture Review  
**Affected Components:** Slack, Notion, Airtable, future integrations  

---

## Problem

v2.2 will ship 2–3 integrations (Slack, Notion, Airtable). Without a shared foundation:
- OAuth 2.0 implementation duplicated 3× (auth flow, token refresh, PKCE)
- Token storage (KV-backed encryption) duplicated 3×
- Webhook signature verification duplicated 3×
- Retry + circuit breaker wrapped differently in each service
- v2.3 integrations (Linear, Teams, Jira) require the same scaffolding again

**Audit Finding:** This is the "god module" duplication pattern the audit flags under F-01 (code duplication).

**Current State:** No integrations exist; routes will implement these patterns inline.

---

## Decision

Implement a **typed provider pattern** with shared OAuth, token-store, HTTP client, and webhook-verify libraries.

### Architecture

```
functions/api/
├── integrations/
│   ├── slack.ts       (provider-specific logic)
│   ├── notion.ts
│   └── airtable.ts
│
services/integrations/
├── IntegrationService.ts     (orchestration)
├── IntegrationProvider.ts    (interface)
└── providers/
    ├── SlackProvider.ts      (implements IntegrationProvider)
    ├── NotionProvider.ts
    └── AirtableProvider.ts
│
lib/integrations/
├── oauth.ts           (generic OAuth 2.0 client)
├── token-store.ts     (KV-backed encrypted token storage)
├── http-client.ts     (fetch with circuit breaker, timeout, retry)
└── webhook-verify.ts  (HMAC verification helpers)
```

### Core Abstraction

**IntegrationProvider interface:**

```typescript
// services/integrations/IntegrationProvider.ts
export interface IntegrationProvider {
  // Outbound: sync session results
  send(payload: SessionResults, config: ProviderConfig): Promise<void>;

  // Inbound: verify and process webhook
  verifyWebhook(req: Request, secret: string): Promise<WebhookEvent>;

  // OAuth flow
  getAuthUrl(state: string, nonce: string): string;
  exchangeCode(code: string): Promise<TokenResponse>;

  // Capability check
  canSyncFormat(format: 'json' | 'pdf' | 'docx'): boolean;
}
```

### Shared Libraries

**1. OAuth (`lib/integrations/oauth.ts`)**

```typescript
export class OAuth2Client {
  constructor(config: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
  }) { }

  // Returns URL with PKCE code_challenge + state
  getAuthorizationUrl(state: string): string;

  // Exchanges code for token (with PKCE code_verifier verification)
  async exchangeAuthorizationCode(code: string, codeVerifier: string): Promise<TokenResponse>;

  // Refreshes expired token
  async refreshToken(refreshToken: string): Promise<TokenResponse>;
}
```

**2. Token Store (`lib/integrations/token-store.ts`)**

```typescript
export class EncryptedTokenStore {
  constructor(kv: KVNamespace) { }

  // Encrypt and store token
  async storeToken(
    teamId: string,
    service: 'slack' | 'notion' | 'airtable',
    token: TokenResponse
  ): Promise<void>;

  // Retrieve and decrypt token
  async getToken(teamId: string, service: string): Promise<TokenResponse | null>;

  // Rotate token on refresh
  async rotateToken(teamId: string, service: string, newToken: TokenResponse): Promise<void>;

  // Revoke token (delete from KV)
  async revokeToken(teamId: string, service: string): Promise<void>;
}
```

**3. HTTP Client (`lib/integrations/http-client.ts`)**

```typescript
export class IntegrationHttpClient {
  constructor(
    private circuitBreaker: CircuitBreaker,
    private timeout: number = 10000
  ) { }

  async fetch<T>(
    url: string,
    options: RequestInit,
    retryConfig: { maxAttempts: number; backoff: 'exponential' | 'linear' }
  ): Promise<T>;
}
```

**4. Webhook Verify (`lib/integrations/webhook-verify.ts`)**

```typescript
export function verifyHMAC(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1'
): boolean;

export function verifySlackRequest(req: Request, secret: string): boolean;
export function verifyNotionSignature(req: Request, secret: string): boolean;
// ... etc
```

### Per-Service Implementation

**Example: Slack Provider**

```typescript
// services/integrations/providers/SlackProvider.ts
import { IntegrationProvider, TokenResponse } from '../IntegrationProvider';
import { OAuth2Client, EncryptedTokenStore, IntegrationHttpClient, verifySlackRequest } from '../../lib/integrations';

export class SlackProvider implements IntegrationProvider {
  private oauth: OAuth2Client;
  private tokenStore: EncryptedTokenStore;
  private http: IntegrationHttpClient;

  constructor(env: Env) {
    this.oauth = new OAuth2Client({
      clientId: env.SLACK_CLIENT_ID,
      clientSecret: env.SLACK_CLIENT_SECRET,
      redirectUri: `${env.API_URL}/api/integrations/slack/callback`,
      authorizationEndpoint: 'https://slack.com/oauth_authorize',
      tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
    });
    this.tokenStore = new EncryptedTokenStore(env.INTEGRATIONS_KV);
    this.http = new IntegrationHttpClient(CircuitBreaker.INTEGRATIONS);
  }

  async send(payload: SessionResults, config: ProviderConfig): Promise<void> {
    const token = await this.tokenStore.getToken(config.teamId, 'slack');
    if (!token) throw new Error('Slack integration not configured');

    const message = this.formatResultsForSlack(payload);
    await this.http.fetch(
      'https://slack.com/api/chat.postMessage',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token.access_token}` },
        body: JSON.stringify(message),
      },
      { maxAttempts: 2, backoff: 'exponential' }
    );
  }

  async verifyWebhook(req: Request, secret: string): Promise<WebhookEvent> {
    if (!verifySlackRequest(req, secret)) {
      throw new Error('Invalid Slack signature');
    }
    const body = await req.json();
    return this.parseSlackEvent(body);
  }

  getAuthUrl(state: string, nonce: string): string {
    return this.oauth.getAuthorizationUrl(state);
  }

  async exchangeCode(code: string): Promise<TokenResponse> {
    return await this.oauth.exchangeAuthorizationCode(code, nonce);
  }

  canSyncFormat(format: string): boolean {
    // Slack supports JSON snippet + PDF attachment
    return ['json', 'pdf'].includes(format);
  }

  private formatResultsForSlack(payload: SessionResults): object {
    return {
      channel: payload.config.slackChannel,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `Session: *${payload.sessionTitle}*` },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: JSON.stringify(payload.results, null, 2) },
        },
      ],
    };
  }
}
```

### Integration Service (Orchestration)

```typescript
// services/integrations/IntegrationService.ts
export class IntegrationService {
  private providers: Map<string, IntegrationProvider> = new Map([
    ['slack', new SlackProvider(this.env)],
    ['notion', new NotionProvider(this.env)],
    ['airtable', new AirtableProvider(this.env)],
  ]);

  async syncSessionResults(
    sessionId: string,
    results: SessionResults,
    integrations: IntegrationConfig[]
  ): Promise<SyncResult[]> {
    return Promise.all(
      integrations.map(async (config) => {
        const provider = this.providers.get(config.service);
        if (!provider) return { service: config.service, success: false, error: 'Unknown provider' };

        try {
          await provider.send(results, config);
          return { service: config.service, success: true };
        } catch (err) {
          // Emit integration failure event
          await this.env.METRICS_AE.writeDataPoint({
            indexes: ['integration.sync_failed'],
            blobs: [JSON.stringify({ service: config.service, error: err.message })],
          });
          return { service: config.service, success: false, error: err.message };
        }
      })
    );
  }
}
```

---

## Trade-offs

| Choice | Alternative | Why Chosen |
|---|---|---|
| **Per-service providers** | Generic webhook dispatcher with config | Type safety, per-service customization (Slack signing vs. Notion bearer token) |
| **Shared OAuth library** | Build from scratch in each route | DRY, prevents PKCE bugs being replicated 3× |
| **KV-backed token storage** | In-memory cache | Persists across isolate restarts, survives deployments |
| **Single IntegrationService** | Separate routes for Slack/Notion/Airtable | Centralized audit logging, error handling, observability |

---

## Rollout Plan

1. **Sprint 20 pre-work (8 pts):** Build foundation libraries (OAuth, token-store, http-client, webhook-verify)
2. **Sprint 22 (5 pts):** Implement SlackProvider, oauth flow, webhook inbound
3. **Sprint 24 (3 pts):** NotionProvider (reuses foundation)
4. **v2.3 (3 pts each):** AirtableProvider, Linear, Teams (foundation already in place)

**Cost reduction:** 5 + 3 + 3 = 11 pts for v2.2 integrations (vs. 15 pts if built without foundation)

---

## Monitoring

**Metrics to emit:**
- `integration.sync_success` — sync completed without error
- `integration.sync_failed` — sync failed, includes error type + service
- `integration.auth_failed` — OAuth flow failed
- `integration.webhook_received` — inbound webhook processed
- `integration.webhook_invalid` — webhook signature verification failed

---

## Testing

**Unit tests (lib/integrations/*.test.ts):**
- OAuth PKCE flow (code_challenge → code_verifier validation)
- Token encrypt/decrypt roundtrip
- HMAC signature verification for Slack/Notion/Airtable
- Retry logic (max attempts, backoff)
- Circuit breaker integration

**Integration tests (services/integrations/*.test.ts):**
- SlackProvider → mock Slack API, assert message format
- NotionProvider → mock Notion API, assert database sync
- E2E: create session → sync to Slack → assert message posted

**Staging tests:**
- Real OAuth flow with sandbox Slack/Notion accounts
- Real webhook delivery (Slack slash command → handler)

---

## Security Considerations

- **Token encryption:** Keys rotated per deployment; KV values encrypted at rest by Cloudflare
- **OAuth secrets:** Stored as Cloudflare secrets (not in code, not in git)
- **Webhook signature:** HMAC verification mandatory before processing
- **Scopes:** Minimal (read session, write results only; no user/team access)

---

## References

- Jankurai Audit: F-01 (code duplication)
- Backend Review: Integration scope estimates (Agent validation)
- Stripe + Resend patterns: Reference for HTTP client wrapping
