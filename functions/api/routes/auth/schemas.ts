import { z } from 'zod'

export const authEmailRequestSchema = z.object({ email: z.string().email().max(254) })

export const passwordSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
})

export const signupSchema = passwordSchema.extend({
  name: z.string().max(100).optional(),
})
