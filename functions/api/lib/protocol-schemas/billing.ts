// Proof-aware decoders for billing and Stripe boundaries.

import { z } from 'zod'

// ── Billing & Stripe Validators ──────────────────────────────────────────────

export const StripeCustomerRecordSchema = z.object({
  customerId: z.string(),
})

export type ValidStripeCustomerRecord = z.infer<typeof StripeCustomerRecordSchema>

export const StripeSubscriptionRecordSchema = z.object({
  subscriptionId: z.string(),
})

export type ValidStripeSubscriptionRecord = z.infer<typeof StripeSubscriptionRecordSchema>

export const StripeSubscriptionObjectSchema = z.object({
  id: z.string(),
  customer: z.string(),
  status: z.enum(['active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired']),
  items: z.object({
    data: z.array(z.object({
      id: z.string(),
      price: z.object({
        id: z.string(),
      }),
    })),
  }).optional(),
  current_period_start: z.number().optional(),
  current_period_end: z.number().optional(),
  cancel_at_period_end: z.boolean().optional(),
  canceled_at: z.number().nullable().optional(),
})

export type ValidStripeSubscriptionObject = z.infer<typeof StripeSubscriptionObjectSchema>

export const StripeWebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  created: z.number(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
})

export type ValidStripeWebhookEvent = z.infer<typeof StripeWebhookEventSchema>
