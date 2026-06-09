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
  // RETRO (ADR-0048). 3-column board.
  z.object({
    v: z.number().optional(),
    type: z.literal('retro_submit'),
    data: z.object({
      column: z.enum(['went_well', 'didnt_go_well', 'actions']),
      body: z.string().trim().min(2).max(500),
    }),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('retro_upvote'),
    data: z.object({ itemId: z.string().min(1) }),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('ideate_submit'),
    data: z.object({ body: z.string().trim().min(2).max(500) }),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('ideate_upvote'),
    data: z.object({ itemId: z.string().min(1) }),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('ideate_reveal'),
    data: z.object({}).optional(),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('ideate_dismiss'),
    data: z.object({ itemId: z.string().min(1) }),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('ideate_merge'),
    data: z.object({ targetId: z.string().min(1), sourceId: z.string().min(1) }),
    timestamp: z.number(),
  }),
  // COPILOT-06 (ADR-0046): presenter injects a copilot-drafted question into the live set.
  z.object({
    v: z.number().optional(),
    type: z.literal('add_question'),
    data: z.object({
      question: z.object({
        kind: z.enum([
          'poll',
          'ranking',
          'consent',
          'open',
          'multi_select',
          'likert',
          'upvote',
          'word_cloud',
          'slider',
        ]),
        prompt: z.string().trim().min(1).max(500),
        options: z.array(z.object({ label: z.string().trim().min(1).max(200) })).max(10),
      }),
    }),
    timestamp: z.number(),
  }),
  // ENTERPRISE-POLISH s1c: presenter approves/rejects buffered open responses.
  z.object({
    v: z.number().optional(),
    type: z.literal('approve_response'),
    data: z.object({ questionId: z.string().min(1), responseId: z.string().min(1) }),
    timestamp: z.number(),
  }),
  z.object({
    v: z.number().optional(),
    type: z.literal('reject_response'),
    data: z.object({ questionId: z.string().min(1), responseId: z.string().min(1) }),
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
