// Worker environment surface: vars, secrets, and Cloudflare bindings.
// Split out of types.ts (audit 2026-07-08: 468-line cross-domain hub).

export type MarketingWorkflowPayload = {
  sessionId: string
  language: 'nl' | 'en' | 'de' | 'fr'
  questionCount: number
  participantCount: number
  durationMinutes: number
}

export type WorkflowCreateOptions<Params> = {
  id?: string
  /** Cloudflare Workflows exposes this object as `event.payload`. */
  params?: Params
  retention?: {
    successRetention?: string
    errorRetention?: string
  }
}

export type Env = {
  // Vars
  ENV: 'production' | 'preview' | 'dev' | 'staging'
  /** Pages origin — used for CORS allowed-origin and CSRF check. */
  PAGES_URL: string
  /** Worker's own URL — used for OAuth redirect_uri and email magic-link base. */
  API_URL: string
  CF_ACCESS_AUDIENCE?: string
  CF_ACCESS_CERTS_URL?: string
  COMMIT_SHA?: string
  /** Injected automatically by Cloudflare Pages at deploy time. */
  CF_PAGES_COMMIT_SHA?: string
  /** SAML SP entity ID (e.g. `https://qesto.cc`). Vars, not secret. */
  SAML_SP_ENTITY_ID?: string
  /** SAML Assertion Consumer Service URL (e.g. `https://api.qesto.cc/api/auth/saml/callback`). */
  SAML_ACS_URL?: string
  /**
   * SAML SSO master switch (#529 / SEC-SAML-01). `'true'` alone is insufficient:
   * {@link SAML_SIGNATURE_VERIFY_ENABLED} must also be `'true'` before routes
   * serve traffic. MUST stay off in production until XML-DSig ships.
   */
  SAML_SSO_ENABLED?: string
  /**
   * SEC-SAML-01 second gate — XML-DSig assertion verification implemented and on.
   * Defaults off; flip only after `verifyAssertionSignature()` ships in saml.ts.
   */
  SAML_SIGNATURE_VERIFY_ENABLED?: string
  /** Superuser email — bypasses all plan quotas. */
  SUPERUSER_EMAIL?: string
  /** Seed admin email — granted owner/admin in dev/test. */
  SEED_ADMIN_EMAIL?: string
  /** Checkout URL for paid plan upgrades. */
  CHECKOUT_URL?: string
  /** Public Stripe price IDs; safe to expose for checkout/price reconciliation. */
  STRIPE_STARTER_MONTHLY_PRICE_ID?: string
  STRIPE_STARTER_ANNUAL_PRICE_ID?: string
  STRIPE_TEAM_ANNUAL_PRICE_ID?: string
  /** Display prices in euro cents, used by public plan catalog when set. */
  STARTER_MONTHLY_EUR_CENTS?: string
  STARTER_ANNUAL_EUR_CENTS?: string
  TEAM_ANNUAL_EUR_CENTS?: string
  /** Optional sender shown in Resend, e.g. "Qesto <login@yourdomain.com>". */
  RESEND_FROM?: string
  /** Sprint 25 guard: enables versioned LIVE energizer WebSocket broadcasts. */
  LIVE_ENERGIZERS_ENABLED?: string
  /** v2.2: Circuit breaker for external dependencies (Stripe, Resend, Workers AI). */
  CIRCUIT_BREAKER_ENABLED?: string
  /** v2.2: Integration webhooks (Slack, Notion, Airtable). */
  INTEGRATION_ENABLED?: string
  /** AI-SENTIMENT-01: enable aggregate mood signals in LIVE sessions. */
  SENTIMENT_ENABLED?: string
  /** SEC-RATELIMIT-01: return 503 when ACTIONS_KV rate limiter fails. */
  RATE_LIMIT_FAIL_CLOSED?: string
  /** SEC-WS-CAP-01: max WebSocket connects per IP per minute (default 15). */
  WS_CONNECT_PER_IP_PER_MIN?: string
  /** GROWTH-ENGINE: IndexNow API key for SEO indexing (optional). */
  INDEXNOW_KEY?: string
  /** SEO-INDEXNOW: IndexNow key filename for Option 1 (e.g., 'e8964e65669d47a69dd02b32bfe2a64e'). */
  INDEXNOW_KEY_FILE?: string
  /** ADR-0022: multi-region read replica routing (S46+). */
  MULTI_REGION_ENABLED?: string
  MULTI_REGION_PRIMARY?: string
  MULTI_REGION_REPLICAS?: string
  /** ADR-0022 / S51: multi-region failover and state KV. */
  MULTI_REGION_FAILOVER_ENABLED?: string
  /** REALTIME-V2: enable Realtime V2 protocol negotiation. */
  REALTIME_V2_ENABLED?: string
  /** REALTIME-V2: default protocol version when client doesn't specify. */
  REALTIME_V2_DEFAULT?: string
  /** REALTIME-V3: enable protocol v3 (results_delta) negotiation (S79). */
  REALTIME_V3_ENABLED?: string
  /** TOWNHALL (ADR-0044): enable the moderated anonymous Q&A board message family. */
  REALTIME_TOWNHALL_ENABLED?: string
  /** BETA_XR_ENABLED (ADR-0066): XR spatial/immersive session beta. OFF by default. */
  BETA_XR_ENABLED?: string
  /** SCIM API bearer token for identity provider integration. */
  SCIM_BEARER_TOKEN?: string
  /** JOIN-CAPTCHA: enable reCAPTCHA verification on session join. */
  JOIN_CAPTCHA_ENABLED?: string
  /** PWA-PUSH-HARDENING-01: VAPID public key (safe to expose to clients). */
  VAPID_PUBLIC_KEY?: string

  // Secrets (wrangler pages secret put ... / wrangler versions secret put ...)
  JWT_SECRET: string
  /** SEC-JWT-ROTATE-01: previous signing secret during rotation window. */
  JWT_SECRET_PREV?: string
  MULTI_REGION_WRITES_ENABLED?: string
  /** AI-GATEWAY-01 (ADR-042 Phase 1.1): gateway id — `wrangler secret put CLOUDFLARE_AI_GATEWAY_ID`. */
  CLOUDFLARE_AI_GATEWAY_ID?: string
  /** AI-GATEWAY-01: API token with AI Gateway Run permission — `wrangler secret put CLOUDFLARE_AI_GATEWAY_TOKEN`. */
  CLOUDFLARE_AI_GATEWAY_TOKEN?: string
  /** Optional account-id override (defaults to the wrangler.toml account). */
  CLOUDFLARE_ACCOUNT_ID?: string
  KB_ADMIN_KEY?: string
  KB_SEARCH_SERVICE_KEY?: string
  RESEND_API_KEY?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  MICROSOFT_CLIENT_ID?: string
  MICROSOFT_CLIENT_SECRET?: string
  MICROSOFT_TENANT_ID?: string
  /** SLACK-01: Slack OAuth2 app credentials (set via `wrangler pages secret put`). */
  SLACK_CLIENT_ID?: string
  SLACK_CLIENT_SECRET?: string
  /** ZOOM-01: Zoom OAuth app (Sprint 35 skeleton). */
  ZOOM_CLIENT_ID?: string
  ZOOM_CLIENT_SECRET?: string
  SALESFORCE_CLIENT_ID?: string
  SALESFORCE_CLIENT_SECRET?: string
  NOTION_CLIENT_ID?: string
  NOTION_CLIENT_SECRET?: string
  LDAP_URL?: string
  LDAP_BIND_DN?: string
  LDAP_BIND_PASSWORD?: string
  /** S52: LDAP bridge integration. */
  LDAP_BRIDGE_URL?: string
  LDAP_TEAM_ID?: string
  LDAP_SYNC_MOCK?: string
  /** GROWTH-ENGINE: HMAC secret for internal marketing webhook trigger. */
  MARKETING_WEBHOOK_SECRET?: string
  /** INT-PROVIDER-01: AES-GCM master key for integration OAuth tokens at rest. */
  OAUTH_TOKEN_MEK?: string
  /** PWA push — VAPID private key (wrangler secret). */
  VAPID_PRIVATE_KEY?: string
  /**
   * EMBED-WIDGET-API-01 (ADR-0050): HMAC-SHA-256 signing key for origin-bound
   * widget tokens. Server secret — set via `wrangler pages secret put
   * EMBED_WIDGET_SECRET`, NEVER in wrangler.toml (hard rule #2). No secret
   * material derived from it ever ships to the browser.
   */
  EMBED_WIDGET_SECRET?: string
  /**
   * LEARN-LTI-01 (ADR-0058): LTI 1.1 consumer credentials. The LMS (Canvas /
   * Blackboard / Moodle) signs the launch with `LTI_CONSUMER_KEY` + the shared
   * secret. Server secret — set via `wrangler pages secret put LTI_CONSUMER_SECRET`,
   * NEVER in wrangler.toml (hard rule #2). When either is unset, LTI launch is
   * disabled (503), never an open launch surface.
   */
  LTI_CONSUMER_KEY?: string
  LTI_CONSUMER_SECRET?: string
  /**
   * SOVEREIGN-AUDIT-API-01 (ADR-0058): HMAC-SHA256 key used to sign verifiable
   * compliance audit exports. Server secret — set via `wrangler pages secret put
   * SOVEREIGN_AUDIT_SIGNING_KEY`, NEVER in wrangler.toml (hard rule #2). When
   * unset, the signed-export endpoint is disabled (503) rather than emitting an
   * unsigned (forgeable) document.
   */
  SOVEREIGN_AUDIT_SIGNING_KEY?: string
  /**
   * CONNECT-INVITE-01 (ADR-0062): HMAC-SHA-256 signing key for federation invite
   * envelopes. Server secret — set via `wrangler pages secret put
   * CONNECT_INVITE_SECRET`, NEVER in wrangler.toml (hard rule #2). When unset, the
   * mint/verify federation endpoints are disabled (503) rather than issuing
   * forgeable invites.
   */
  CONNECT_INVITE_SECRET?: string
  /**
   * DELIBERATE-GA-01 / M-1 (ADR-0049): optional server-side secret salt folded
   * into the anonymous `voter_hash` one-ballot dedup token (defence-in-depth so
   * the token no longer rests solely on the 128-bit ULID `user.sub`). Server
   * secret — set via `wrangler pages secret put DELIBERATE_VOTER_SALT`, NEVER in
   * wrangler.toml (hard rule #2). Fail-safe: when unset, `voterBallotHash` is
   * byte-identical to the pre-M-1 construction, so existing ballots verify
   * unchanged; the salt only differentiates sessions created after it is set
   * (historical rows are never rehashed).
   */
  DELIBERATE_VOTER_SALT?: string
  /** LinkedIn auto-posting (MKTG): OAuth app credentials + redirect. */
  LINKEDIN_CLIENT_ID?: string
  LINKEDIN_CLIENT_SECRET?: string
  LINKEDIN_REDIRECT_URI?: string
  /** Optional fallback org URN when the OAuth scope can't read the ACL list. */
  LINKEDIN_ORG_URN?: string
  /** Marketing automation: Reddit OAuth app (web-app type, real refresh tokens). */
  REDDIT_CLIENT_ID?: string
  REDDIT_CLIENT_SECRET?: string
  REDDIT_REDIRECT_URI?: string
  /** Marketing automation: YouTube Data API OAuth app credentials + redirect. */
  YOUTUBE_CLIENT_ID?: string
  YOUTUBE_CLIENT_SECRET?: string
  YOUTUBE_REDIRECT_URI?: string
  /** Marketing automation: HMAC key signing short-TTL video preview URLs. */
  VIDEO_PREVIEW_SIGNING_KEY?: string

  // Bindings
  DB: D1Database
  USERS_KV: KVNamespace
  SESSIONS_KV: KVNamespace
  TEAMS_KV: KVNamespace
  TEMPLATES_KV: KVNamespace
  DECISIONS_KV: KVNamespace
  AUDIT_KV: KVNamespace
  ACTIONS_KV: KVNamespace
  HELP_CONVERSATIONS_KV?: KVNamespace
  MARKETING_KV?: KVNamespace
  SESSION_ROOM: DurableObjectNamespace
  AI: Ai
  WORKFLOWS?: { create: <Params = unknown>(config?: WorkflowCreateOptions<Params>) => Promise<{ id: string }> }
  DECISIONS_VECTORIZE: VectorizeIndex
  HELP_VECTORIZE: VectorizeIndex
  KB_VECTORIZE: VectorizeIndex
  METRICS_KV?: KVNamespace
  METRICS_AE?: AnalyticsEngineDataset
  CIRCUIT_BREAKER_KV?: KVNamespace
  INTEGRATIONS_KV?: KVNamespace
  /** ADR-0022 / S51: multi-region state and DO cross-region mirror. */
  MULTI_REGION_STATE_KV?: KVNamespace
  /** LinkedIn auto-posting: encrypted token + org/person URN + topics + rotation. */
  LINKEDIN_KV?: KVNamespace
  /** ADR-042 Phase 2.1: Cloudflare Queues for async post-session work. */
  INSIGHTS_QUEUE?: Queue<any>
  /** ADR-042 Phase 2.3: R2 durable session snapshots for DO recovery. */
  R2_SESSIONS?: R2Bucket
  /** Marketing automation: Video Asset Library storage (no upload endpoint in v1). */
  R2_VIDEOS?: R2Bucket
}
