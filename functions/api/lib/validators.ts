// Proof-aware decoders for boundary crossings using Zod.
// All data from network, storage, or KV must be validated before casting.

import { z } from 'zod'

// ── Protocol Validators ──────────────────────────────────────────────────────

export const ClientMessageSchema = z.union([
  z.object({
    v: z.number().optional(),
    type: z.literal('vote'),
    data: z.object({ questionId: z.string(), optionId: z.string() }),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('advance'),
    data: z.object({}).strict(),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('back'),
    data: z.object({}).strict(),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('request_state'),
    data: z.object({}).strict(),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('pause'),
    data: z.object({}).strict(),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('resume'),
    data: z.object({}).strict(),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('energizer_activate'),
    data: z.object({
      energizer: z.object({
        id: z.string(),
        kind: z.enum(['quick_finger', 'team_quiz', 'emoji_poll', 'word_cloud']),
        title: z.string(),
        status: z.enum(['active', 'completed']),
        prompt: z.string().optional(),
        options: z.array(z.string()).optional(),
        correctIndex: z.number().optional(),
        startedAt: z.number().optional(),
        answers: z.array(z.object({
          voterId: z.string(),
          value: z.string(),
          correct: z.boolean(),
          speedMs: z.number(),
          rank: z.number(),
        })).optional(),
        questions: z.array(z.object({
          prompt: z.string(),
          options: z.array(z.string()),
          correctIndex: z.number(),
        })).optional(),
        currentIndex: z.number().optional(),
        submissions: z.array(z.object({
          voterId: z.string(),
          questionIndex: z.number(),
          value: z.string(),
          correct: z.boolean(),
        })).optional(),
        scores: z.array(z.object({
          voterId: z.string(),
          score: z.number(),
          rank: z.number(),
        })).optional(),
        leaderboard: z.array(z.object({
          voterId: z.string(),
          label: z.string(),
          score: z.number(),
          rank: z.number(),
          badges: z.array(z.object({
            id: z.string(),
            kind: z.enum(['first_answer', 'speedster', 'perfect_trivia', 'engaged']),
            label: z.string(),
            awardedAt: z.number(),
          })),
        })).optional(),
        badges: z.record(z.string(), z.array(z.object({
          id: z.string(),
          kind: z.enum(['first_answer', 'speedster', 'perfect_trivia', 'engaged']),
          label: z.string(),
          awardedAt: z.number(),
        }))).optional(),
      }),
    }),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('energizer_answer'),
    data: z.object({ energizerId: z.string(), value: z.string() }),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('energizer_advance'),
    data: z.object({ energizerId: z.string() }),
    timestamp: z.number(),
  }),
  // TOWNHALL (ADR-0044). submit/upvote open to voters; moderate is presenter-gated in the DO.
  z.object({
    v: z.number().optional(),
    type: z.literal('townhall_submit'),
    data: z.object({
      body: z.string().trim().min(3).max(500),
      displayName: z.string().trim().min(1).max(40).optional(),
    }),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('townhall_upvote'),
    data: z.object({ itemId: z.string().min(1) }),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('townhall_moderate'),
    data: z
      .object({
        itemId: z.string().min(1),
        action: z.enum([
          'approve',
          'dismiss',
          'restore',
          'answer',
          'spotlight',
          'clear_spotlight',
          'group',
          'ungroup',
        ]),
        groupParentId: z.string().min(1).optional(),
      })
      .refine((d) => d.action !== 'group' || !!d.groupParentId, {
        message: 'group action requires groupParentId',
      }),
    timestamp: z.number(),
  }),
])

export type ValidClientMessage = z.infer<typeof ClientMessageSchema>

// Generic envelope for lenient parsing (rejects only if JSON is invalid)
export const VersionedClientEnvelopeSchema = z.object({
  v: z.number().optional(),
  type: z.string().optional(),
  data: z.unknown().optional(),
  timestamp: z.number().optional(),
})

export type ValidVersionedClientEnvelope = z.infer<typeof VersionedClientEnvelopeSchema>

// ── Storage Validators ───────────────────────────────────────────────────────

export const AuthClaimsSchema = z.object({
  sub: z.string(),
  // Intentionally coarse: RFC email validation belongs at the OAuth/SAML edge.
  // Microsoft preferred_username can be a non-RFC-email UPN on some tenants.
  email: z.string().min(1),
  jti: z.string().optional(),
  iat: z.number(),
  exp: z.number(),
})

export type ValidAuthClaims = z.infer<typeof AuthClaimsSchema>

// ── Auth KV Validators ───────────────────────────────────────────────────────

export const OAuthStateSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
})

export type ValidOAuthState = z.infer<typeof OAuthStateSchema>

export const PasswordCredentialSchema = z.object({
  hash: z.string(),
})

export type ValidPasswordCredential = z.infer<typeof PasswordCredentialSchema>

export const PasswordResetSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
})

export type ValidPasswordReset = z.infer<typeof PasswordResetSchema>

// ── Database Result Validators ───────────────────────────────────────────────

export const PollOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
})

export type ValidPollOption = z.infer<typeof PollOptionSchema>

export const PollOptionArraySchema = z.array(PollOptionSchema)

export type ValidPollOptionArray = z.infer<typeof PollOptionArraySchema>

export const StringArraySchema = z.array(z.string())

export type ValidStringArray = z.infer<typeof StringArraySchema>

export const CachedQuestionsSchema = z.object({
  questions: z.unknown(),
  confidence: z.number().optional(),
})

export type ValidCachedQuestions = z.infer<typeof CachedQuestionsSchema>

// ── OAuth/External Service Validators ─────────────────────────────────────

export const GoogleTokenResponseSchema = z.object({
  id_token: z.string().optional(),
  access_token: z.string().optional(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
})

export type ValidGoogleTokenResponse = z.infer<typeof GoogleTokenResponseSchema>

export const MicrosoftTokenResponseSchema = z.object({
  id_token: z.string(),
  access_token: z.string().optional(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
})

export type ValidMicrosoftTokenResponse = z.infer<typeof MicrosoftTokenResponseSchema>

// JWT payload schemas for Google and Microsoft ID tokens
export const GoogleIdTokenPayloadSchema = z.object({
  email: z.string().optional(),
  sub: z.string().optional(),
  email_verified: z.boolean().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  exp: z.number().optional(),
  iss: z.string().optional(),
  iat: z.number().optional(),
})

export type ValidGoogleIdTokenPayload = z.infer<typeof GoogleIdTokenPayloadSchema>

export const MicrosoftIdTokenPayloadSchema = z.object({
  email: z.string().optional(),
  preferred_username: z.string().optional(),
  oid: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  exp: z.number().optional(),
  iss: z.string().optional(),
  iat: z.number().optional(),
})

export type ValidMicrosoftIdTokenPayload = z.infer<typeof MicrosoftIdTokenPayloadSchema>

export const JwtHeaderSchema = z.object({
  alg: z.string().optional(),
  kid: z.string().optional(),
  typ: z.string().optional(),
})

export type ValidJwtHeader = z.infer<typeof JwtHeaderSchema>

export const JwksResponseSchema = z.object({
  keys: z.array(z.record(z.string(), z.unknown())).optional(),
})

export type ValidJwksResponse = z.infer<typeof JwksResponseSchema>

// ── Audit Event Validators ───────────────────────────────────────────────────

export const AuditActionSchema = z.enum([
  'session.create',
  'session.start',
  'session.close',
  'session.archive',
  'session.update',
  'question.create',
  'question.update',
  'question.delete',
  'user.role_change',
  'team.create',
  'team.update',
  'team.delete',
  'team.role.create',
  'team.role.update',
  'team.role.delete',
  'team.role.assign',
  'team.role.unassign',
  'team.permission_denied',
  'auth.login',
  'auth.logout',
  'billing.plan_change',
  'insights.generate',
  'energizer.create',
  'energizer.advance',
  'energizer.activate',
  'energizer.complete',
  'energizer.activation_denied',
  'ws.energizer_activated',
  'ws.energizer_activation_denied',
  'ws.energizer_advance_denied',
  'ws.energizer_answered',
  'ws.energizer_advanced',
  'ws.energizer_completed',
  'session.close_with_badges',
  'townhall.config',
  'townhall.question.delete',
  'user.create',
  'user.update',
  'user.suspend',
  'user.restore',
])

export type ValidAuditAction = z.infer<typeof AuditActionSchema>

// ── Audit Context Validators (boundary-crossing proof-aware decoders) ────────

export const AuditContextSchema = z.object({
  action: AuditActionSchema,
  subject_type: z.string().min(1),
  subject_id: z.string().min(1),
  before_snapshot: z.record(z.string(), z.unknown()).optional(),
  after_snapshot: z.record(z.string(), z.unknown()).optional(),
  actor_id: z.string().optional().nullable(),
  actor_ip: z.string().optional().nullable(),
  trace_id: z.string().optional().nullable(),
  idempotency_key: z.string().optional().nullable(),
})

export type ValidAuditContext = z.infer<typeof AuditContextSchema>

// ── User Context Validator (validates auth token payload before casting) ─────

export const UserContextSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  teams: z.array(z.string()).optional(),
  aud: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
})

export type ValidUserContext = z.infer<typeof UserContextSchema>

// ── Team & Permission Validators ─────────────────────────────────────────────

export const PermissionSchema = z.enum([
  'session:create',
  'session:update',
  'session:launch',
  'session:close',
  'session:archive',
  'session:export',
  'session:moderate',
  'energizer:activate',
  'template:read',
  'template:write',
  'team:manage_members',
  'team:manage_auth',
  'team:read_audit',
  'billing:manage',
  'admin:read',
  'admin:write',
])

export type ValidPermission = z.infer<typeof PermissionSchema>

export const PermissionArraySchema = z.array(PermissionSchema)

export type ValidPermissionArray = z.infer<typeof PermissionArraySchema>

export const RoleSchema = z.enum(['owner', 'admin', 'member', 'viewer'])

export type ValidRole = z.infer<typeof RoleSchema>

// Intentionally excludes 'owner': invite creation never writes owner role,
// so accepting it from KV would allow a crafted entry to grant owner via invite.
export const TeamInviteTokenSchema = z.object({
  teamId: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
})

export type ValidTeamInviteToken = z.infer<typeof TeamInviteTokenSchema>

// ── Billing & Stripe Validators ──────────────────────────────────────────────

export const StripeCustomerRecordSchema = z.object({
  customerId: z.string(),
})

export type ValidStripeCustomerRecord = z.infer<typeof StripeCustomerRecordSchema>

export const StripeSubscriptionRecordSchema = z.object({
  subscriptionId: z.string(),
})

export type ValidStripeSubscriptionRecord = z.infer<typeof StripeSubscriptionRecordSchema>

// ── Template Validators ──────────────────────────────────────────────────────

export const TemplateIdArraySchema = z.array(z.string())

export type ValidTemplateIdArray = z.infer<typeof TemplateIdArraySchema>

export const CustomerTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  questions: z.array(z.object({
    id: z.string().optional(),
    position: z.number().optional(),
    kind: z.string(),
    prompt: z.string(),
    options_json: z.string().optional(),
  })),
})

export type ValidCustomerTemplate = z.infer<typeof CustomerTemplateSchema>

// ── SAML Validators ──────────────────────────────────────────────────────────

export const SamlStateTokenSchema = z.object({
  teamId: z.string(),
  idpSsoUrl: z.string().url(),
  createdAt: z.number().optional(),
})

export type ValidSamlStateToken = z.infer<typeof SamlStateTokenSchema>

// ── Insights Cache Validators ───────────────────────────────────────────────────

export const InsightThemeSchema = z.object({
  theme: z.string(),
  count: z.number().int().nonnegative(),
  examples: z.array(z.string()).min(0).max(8),
})

export type ValidInsightTheme = z.infer<typeof InsightThemeSchema>

export const CachedInsightsSchema = z.object({
  themes: z.array(InsightThemeSchema),
  trend: z.object({
    '7d': z.number(),
    '30d': z.number(),
  }),
  cached_at: z.number(),
})

export type ValidCachedInsights = z.infer<typeof CachedInsightsSchema>

// ── AI & Vector Validators ───────────────────────────────────────────────────

export const AiEmbeddingResponseSchema = z.object({
  data: z.array(z.number()),
})

export type ValidAiEmbeddingResponse = z.infer<typeof AiEmbeddingResponseSchema>

export const AiBatchEmbeddingResponseSchema = z.object({
  data: z.array(z.array(z.number())).optional(),
})

export type ValidAiBatchEmbeddingResponse = z.infer<typeof AiBatchEmbeddingResponseSchema>

export const VectorMetadataSchema = z.record(z.string(), z.unknown())

export type ValidVectorMetadata = z.infer<typeof VectorMetadataSchema>

// ── OAuth state token validator (integrations) ───────────────────────────────

export const OAuthStatePayloadSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
  exp: z.number(),
})

export type ValidOAuthStatePayload = z.infer<typeof OAuthStatePayloadSchema>

// ── Energizer Config Validators ──────────────────────────────────────────────

export const EmojiPollConfigSchema = z.object({
  emojis: z.array(z.string()),
})

export type ValidEmojiPollConfig = z.infer<typeof EmojiPollConfigSchema>

export const QuickFingerConfigSchema = z.object({
  options: z.array(z.string()),
  correct_index: z.number(),
})

export type ValidQuickFingerConfig = z.infer<typeof QuickFingerConfigSchema>

export const TeamQuizQuestionSchema = z.object({
  prompt: z.string(),
  options: z.array(z.string()),
  correct_index: z.number(),
})

export const TeamQuizConfigSchema = z.object({
  questions: z.array(TeamQuizQuestionSchema),
  current_index: z.number(),
})

export type ValidTeamQuizConfig = z.infer<typeof TeamQuizConfigSchema>

export const WordCloudConfigSchema = z.object({
  max_words_per_participant: z.number(),
})

export type ValidWordCloudConfig = z.infer<typeof WordCloudConfigSchema>

export const BattleRoyaleConfigSchema = z.object({
  num_rounds: z.number(),
  participants: z.array(z.string()),
  scoring_multiplier: z.number(),
  elimination_threshold: z.number(),
})

export type ValidBattleRoyaleConfig = z.infer<typeof BattleRoyaleConfigSchema>

export const BracketConfigSchema = z.object({
  bracket_size: z.union([z.literal(4), z.literal(8), z.literal(16)]),
  participants: z.array(z.string()),
  match_format: z.union([z.literal('single_elimination'), z.literal('double_elimination')]),
})

export type ValidBracketConfig = z.infer<typeof BracketConfigSchema>

// Permissive envelope: proves the value is a non-null object without
// checking kind-specific fields. Kind-specific validation must be done
// separately via the per-kind schemas above.
export const EnergizerConfigEnvelopeSchema = z.record(z.string(), z.unknown())

export type ValidEnergizerConfigEnvelope = z.infer<typeof EnergizerConfigEnvelopeSchema>

// ── Cache & Rate Limit Validators ───────────────────────────────────────────

export const RateLimitCounterSchema = z.object({
  count: z.number().int().nonnegative(),
  resetAt: z.number(),
})

export type ValidRateLimitCounter = z.infer<typeof RateLimitCounterSchema>

export const CachedDataSchema = z.object({
  data: z.unknown(),
  expires_at: z.number(),
})

export type ValidCachedData = z.infer<typeof CachedDataSchema>

// ── Integration Token Validators ─────────────────────────────────────────────

export const StoredTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  stored_at: z.number(),
  expires_at: z.number().optional(),
})

export type ValidStoredToken = z.infer<typeof StoredTokenSchema>

// Generic KV validator: parse and optionally validate with a schema
export function validateKvJson<T>(
  raw: string | null,
  schema?: z.ZodSchema<T>,
): T | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (schema) {
      return schema.parse(parsed)
    }
    return parsed as T
  } catch {
    return null
  }
}

// ── Webhook Validators (HLT-031: input boundary crossing) ───────────────────

export const WebhookEventSchema = z.enum([
  'session.closed',
  'session.started',
  'session.energizer',
  'energizer.activated',
  'sentiment.threshold',
  'leaderboard.milestone',
])

export const WebhookConfigSchema = z.object({
  id: z.string().min(1),
  teamId: z.string().min(1),
  url: z.string().url(),
  secret: z.string().min(32),
  events: z.array(WebhookEventSchema).min(1),
  enabled: z.boolean(),
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  createdBy: z.string().min(1),
})

export type ValidWebhookConfig = z.infer<typeof WebhookConfigSchema>

export const WebhookPayloadSchema = z.object({
  event: WebhookEventSchema,
  timestamp: z.number().positive(),
  data: z.record(z.string(), z.unknown()),
})

export type ValidWebhookPayload = z.infer<typeof WebhookPayloadSchema>

// ── Authorization/Permission Validators ──────────────────────────────────────
// (PermissionSchema, ValidPermission, and PermissionArraySchema already defined above)

// ── Common Route Parameter Validators ────────────────────────────────────────

export const SessionIdSchema = z.string().ulid()
export const TeamIdSchema = z.string().ulid()
export const UserIdSchema = z.string().ulid()
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ValidPagination = z.infer<typeof PaginationSchema>

// ── Integration Payload Validators ───────────────────────────────────────────

export const SlackIntegrationPayloadSchema = z.object({
  teamId: TeamIdSchema,
  webhookUrl: z.string().url(),
  events: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
})

export type ValidSlackIntegrationPayload = z.infer<typeof SlackIntegrationPayloadSchema>

// ── AI coaching response (Workers AI JSON boundary) ─────────────────────────

export const CoachingAiResponseSchema = z.object({
  headline: z.string().min(1),
  bullets: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1).optional(),
  followUps: z.array(z.string()).max(3).optional(),
})

export type ValidCoachingAiResponse = z.infer<typeof CoachingAiResponseSchema>

// ── GDPR / KV team documents ─────────────────────────────────────────────────

export const TeamIdsIndexSchema = z.array(z.string().min(1))

export const TeamDocumentMemberSchema = z.object({
  userId: z.string().min(1),
})

export const TeamDocumentSchema = z.object({
  members: z.array(TeamDocumentMemberSchema).optional(),
})

export type ValidTeamDocument = z.infer<typeof TeamDocumentSchema>

// ── Energizer Validators ────────────────────────────────────────────────────

export const EnergizerSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  kind: z.enum(['quick_finger', 'team_quiz', 'emoji_poll', 'word_cloud']),
  prompt: z.string().min(1),
  state: z.enum(['draft', 'active', 'completed']),
  createdAt: z.number().positive(),
})

export type ValidEnergizer = z.infer<typeof EnergizerSchema>

// ── Trace/Observability Validators ──────────────────────────────────────────

export const TraceContextSchema = z.object({
  trace_id: z.string().min(1),
  span_id: z.string().min(1).optional(),
  parent_span_id: z.string().min(1).optional(),
  sampled: z.boolean().optional(),
})

export type ValidTraceContext = z.infer<typeof TraceContextSchema>

// Safely parse client message with type guard
// Validates before returning to ensure type safety at boundary
export function parseClientMessage(text: string): ValidClientMessage | null {
  try {
    const envelope = VersionedClientEnvelopeSchema.parse(JSON.parse(text))
    if (typeof envelope.type === 'string') {
      return ClientMessageSchema.parse(envelope) as ValidClientMessage
    }
    return null
  } catch {
    return null
  }
}

// Validate already-parsed object with a schema
export function validateData<T>(data: unknown, schema: z.ZodSchema<T>): T | null {
  try {
    return schema.parse(data)
  } catch {
    return null
  }
}
