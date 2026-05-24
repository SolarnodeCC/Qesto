import { describe, expect, it } from 'vitest'
import { entryPassesFilter, resolveRoleForGroups } from '../../functions/api/lib/ldap-group-map'

describe('ldap-group-map', () => {
  it('resolves role from first matching group', () => {
    const map = { 'qesto-admins': 'admin' as const, 'qesto-members': 'member' as const }
    expect(resolveRoleForGroups(['qesto-admins'], map)).toBe('admin')
    expect(resolveRoleForGroups(['unknown'], map, 'viewer')).toBe('viewer')
  })

  it('filters by OU and group', () => {
    expect(
      entryPassesFilter(
        { ou: 'ou=people,dc=corp', groups: ['hr'] },
        { allowedOus: ['ou=people'], allowedGroups: ['hr'] },
      ),
    ).toBe(true)
    expect(
      entryPassesFilter(
        { ou: 'ou=vendor', groups: ['hr'] },
        { allowedOus: ['ou=people'] },
      ),
    ).toBe(false)
  })
})
