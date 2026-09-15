/**
 * Requirement: knowledge-base/specifications/domain/SPEC_BACKEND.md §7 Admin + §Validation (Zod) — admin user-creation schema.
 */
import { describe, it, expect } from 'vitest'
import { AdminCreateUserSchema } from '../../functions/api/lib/domain-schemas'

describe('AdminCreateUserSchema', () => {
  it('accepts optional admin_role on create', () => {
    const parsed = AdminCreateUserSchema.safeParse({
      email: 'admin@example.com',
      admin_role: 'owner',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.admin_role).toBe('owner')
    }
  })

  it('allows null admin_role', () => {
    const parsed = AdminCreateUserSchema.safeParse({
      email: 'user@example.com',
      admin_role: null,
    })
    expect(parsed.success).toBe(true)
  })
})
