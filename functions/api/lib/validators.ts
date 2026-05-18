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
  email: z.string().email(),
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
