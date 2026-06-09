// Proof-aware decoders for common route parameters.

import { z } from 'zod'

// ── Common Route Parameter Validators ────────────────────────────────────────

export const SessionIdSchema = z.string().ulid()
export const TeamIdSchema = z.string().ulid()
export const UserIdSchema = z.string().ulid()
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ValidPagination = z.infer<typeof PaginationSchema>
