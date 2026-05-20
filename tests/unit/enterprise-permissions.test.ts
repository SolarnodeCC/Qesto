/**
 * QA-ENT-02 — Enterprise permission regression bundle.
 * Verifies owner/admin/member/viewer/custom-role allow/deny paths
 * for both session actions (session:launch, session:close) and
 * energizer actions (energizer:activate) across all four built-in roles
 * and a custom role.
 *
 * Acceptance: All 16 permission allow/deny paths green.
 */

import { describe, it, expect } from 'vitest'
import {
  BUILTIN_ROLE_PERMISSIONS,
  KNOWN_PERMISSIONS,
  validatePermissions,
  type Permission,
} from '../../functions/api/lib/authz'

// ─────────────────────────────────────────────────────────────────────────────
// Built-in role permission matrix
// ─────────────────────────────────────────────────────────────────────────────

describe('QA-ENT-02: built-in role permissions', () => {
  describe('owner role', () => {
    const perms = BUILTIN_ROLE_PERMISSIONS['owner']!

    it('can launch sessions', () => expect(perms).toContain('session:launch'))
    it('can close sessions', () => expect(perms).toContain('session:close'))
    it('can activate energizers', () => expect(perms).toContain('energizer:activate'))
    it('can manage billing', () => expect(perms).toContain('billing:manage'))
    it('can manage team members', () => expect(perms).toContain('team:manage_members'))
  })

  describe('admin role', () => {
    const perms = BUILTIN_ROLE_PERMISSIONS['admin']!

    it('can launch sessions', () => expect(perms).toContain('session:launch'))
    it('can close sessions', () => expect(perms).toContain('session:close'))
    it('can activate energizers', () => expect(perms).toContain('energizer:activate'))
    it('cannot manage billing (not owner)', () => expect(perms).not.toContain('billing:manage'))
    it('can manage team members', () => expect(perms).toContain('team:manage_members'))
  })

  describe('member role', () => {
    const perms = BUILTIN_ROLE_PERMISSIONS['member']!

    it('can launch sessions', () => expect(perms).toContain('session:launch'))
    it('can close sessions', () => expect(perms).toContain('session:close'))
    it('cannot activate energizers (not presenter-gated role)', () => expect(perms).not.toContain('energizer:activate'))
    it('cannot manage billing', () => expect(perms).not.toContain('billing:manage'))
    it('cannot manage team members', () => expect(perms).not.toContain('team:manage_members'))
  })

  describe('viewer role', () => {
    const perms = BUILTIN_ROLE_PERMISSIONS['viewer']!

    it('cannot launch sessions', () => expect(perms).not.toContain('session:launch'))
    it('cannot close sessions', () => expect(perms).not.toContain('session:close'))
    it('cannot activate energizers', () => expect(perms).not.toContain('energizer:activate'))
    it('cannot manage billing', () => expect(perms).not.toContain('billing:manage'))
    it('cannot manage team members', () => expect(perms).not.toContain('team:manage_members'))
    it('can read templates', () => expect(perms).toContain('template:read'))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Effective permission merging (built-in + custom role union)
// ─────────────────────────────────────────────────────────────────────────────

describe('QA-ENT-02: custom role permission merging', () => {
  function mergePermissions(builtIn: Permission[], custom: Permission[]): Permission[] {
    return [...new Set([...builtIn, ...custom])]
  }

  it('member + energizer:activate custom role → can activate energizers', () => {
    const effective = mergePermissions(
      BUILTIN_ROLE_PERMISSIONS['member']!,
      ['energizer:activate'],
    )
    expect(effective).toContain('energizer:activate')
    expect(effective).toContain('session:launch') // still has member perms
  })

  it('viewer + session:launch custom role → can launch sessions', () => {
    const effective = mergePermissions(
      BUILTIN_ROLE_PERMISSIONS['viewer']!,
      ['session:launch', 'session:close'],
    )
    expect(effective).toContain('session:launch')
    expect(effective).toContain('session:close')
    expect(effective).not.toContain('billing:manage') // still can't bill
  })

  it('admin with billing:manage custom override → can manage billing', () => {
    // Admin normally can't manage billing; custom role can grant it
    const effective = mergePermissions(
      BUILTIN_ROLE_PERMISSIONS['admin']!,
      ['billing:manage'],
    )
    expect(effective).toContain('billing:manage')
  })

  it('custom role energizer:activate deny via absence → member cannot activate', () => {
    // Without energizer:activate in built-in or custom, member cannot activate
    const memberPerms = BUILTIN_ROLE_PERMISSIONS['member']!
    const customPerms: Permission[] = [] // no override
    const effective = mergePermissions(memberPerms, customPerms)
    expect(effective).not.toContain('energizer:activate')
  })

  it('deduplicates overlapping permissions', () => {
    const effective = mergePermissions(
      ['session:launch', 'session:close', 'energizer:activate'],
      ['session:launch', 'energizer:activate'], // duplicates
    )
    const launchCount = effective.filter((p) => p === 'session:launch').length
    expect(launchCount).toBe(1)
    const activateCount = effective.filter((p) => p === 'energizer:activate').length
    expect(activateCount).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN_PERMISSIONS set coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('QA-ENT-02: KNOWN_PERMISSIONS registry', () => {
  it('includes energizer:activate', () => expect(KNOWN_PERMISSIONS.has('energizer:activate')).toBe(true))
  it('includes session:launch', () => expect(KNOWN_PERMISSIONS.has('session:launch')).toBe(true))
  it('includes session:close', () => expect(KNOWN_PERMISSIONS.has('session:close')).toBe(true))
  it('rejects unknown string', () => expect(KNOWN_PERMISSIONS.has('admin:superpower' as Permission)).toBe(false))
})

// ─────────────────────────────────────────────────────────────────────────────
// validatePermissions input sanitization
// ─────────────────────────────────────────────────────────────────────────────

describe('QA-ENT-02: validatePermissions input sanitization', () => {
  it('accepts valid permission array', () => {
    const result = validatePermissions(['session:launch', 'energizer:activate'])
    expect(result).toEqual(['session:launch', 'energizer:activate'])
  })

  it('rejects non-array input', () => {
    expect(validatePermissions('session:launch')).toBeNull()
    expect(validatePermissions(null)).toBeNull()
    expect(validatePermissions(undefined)).toBeNull()
    expect(validatePermissions({ session: 'launch' })).toBeNull()
  })

  it('rejects array with unknown permission', () => {
    expect(validatePermissions(['session:launch', 'hack:everything'])).toBeNull()
  })

  it('deduplicates permissions', () => {
    const result = validatePermissions(['session:launch', 'session:launch', 'energizer:activate'])
    expect(result).toHaveLength(2)
  })

  it('rejects empty string permissions', () => {
    expect(validatePermissions([''])).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SessionRoom canActivateEnergizer logic (unit — no DO runtime needed)
// ─────────────────────────────────────────────────────────────────────────────

describe('QA-ENT-02: canActivateEnergizer permission gate', () => {
  type Attachment = {
    role: 'presenter' | 'voter'
    permissions?: string[]
  }

  function canActivateEnergizer(att: Attachment): boolean {
    if (att.role !== 'presenter') return false
    return att.permissions === undefined || att.permissions.includes('energizer:activate')
  }

  it('presenter with no permissions restriction → can activate', () => {
    expect(canActivateEnergizer({ role: 'presenter' })).toBe(true)
  })

  it('presenter with energizer:activate → can activate', () => {
    expect(canActivateEnergizer({ role: 'presenter', permissions: ['energizer:activate', 'session:launch'] })).toBe(true)
  })

  it('presenter WITHOUT energizer:activate → denied', () => {
    expect(canActivateEnergizer({ role: 'presenter', permissions: ['session:launch'] })).toBe(false)
  })

  it('voter with energizer:activate → denied (role check first)', () => {
    expect(canActivateEnergizer({ role: 'voter', permissions: ['energizer:activate'] })).toBe(false)
  })

  it('voter with no permissions → denied', () => {
    expect(canActivateEnergizer({ role: 'voter' })).toBe(false)
  })

  it('presenter with empty permissions array → denied', () => {
    expect(canActivateEnergizer({ role: 'presenter', permissions: [] })).toBe(false)
  })
})
