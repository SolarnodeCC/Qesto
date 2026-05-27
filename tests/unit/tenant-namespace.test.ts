import { describe, expect, it } from 'vitest'
import { namespacedKey, tenantNamespacePrefix } from '../../functions/api/lib/tenant-namespace'

describe('tenant-namespace', () => {
  it('prefixes keys', () => {
    expect(namespacedKey('t1', 'session:x')).toBe(`${tenantNamespacePrefix('t1')}session:x`)
  })
})
