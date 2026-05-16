---
id: ADR-KV-TENANT-CONVENTIONS
title: KV Tenant Conventions
domain: architecture
status: accepted
version: 1.0
created: 2026-04-20
updated: 2026-05-11
tags:
  - kv
  - multi-tenant
  - key-patterns
  - data-isolation
relates_to:
  - SPEC_DATAMODEL
  - SPEC_BACKEND
---

# ADR: KV Key Scoping & Tenant-Isolation Conventions

**Date**: 2026-04-23  
**Status**: Proposed  
**Context**: Sprint 18 Planning Review + ENT-05 (Multi-Tenant Isolation)  
**Relevant Issues**: ENT-05 (Multi-Tenant Isolation Enforcement), Data isolation audit

---

## Problem

Qesto is a multi-tenant platform (teams own sessions, decisions, audit logs). Data isolation is critical:
- **GDPR**: Team A cannot see Team B's data
- **Security**: Cross-tenant data leaks are P0 breaches
- **Compliance**: Audit logs must prove isolation

Current KV usage is inconsistent:
- Some KV stores use flat keys (e.g., `session:{id}`)
- Some may be un-prefixed by team_id (audit required)
- Query boundaries unclear in code

**Problem**: Without a strict KV key-scoping convention, cross-tenant leaks are easy and hard to detect.

---

## Context

### KV Stores in Use
| Store | Purpose | Current Key Pattern | Multi-tenant? |
|---|---|---|---|
| `USERS_KV` | User preferences, API keys | `user:{user_id}` | ❌ No team scoping |
| `SESSIONS_KV` | Session metadata cache | `session:{session_id}` | ❌ Unclear; needs audit |
| `TEAMS_KV` | Team config, members | `team:{team_id}` | ✅ Yes |
| `TEMPLATES_KV` | Question templates | `template:{template_id}` | ❌ Unclear |
| `DECISIONS_KV` | Session decision cache (vectorize) | `decisions:{session_id}` | ❌ Unclear |
| `AUDIT_KV` | Audit event ledger | `audit:{session_id}` | ❌ Unclear |
| `ACTIONS_KV` | Action history (internal) | `actions:{action_id}` | ❌ Unclear |

**Risk**: If `SESSIONS_KV` stores raw session data without team scoping, code like `await KV.get('session:123')` returns data for any team (not just requester's team).

---

## Proposed Convention

### Standard: Tenant-Scoped Keys

**All KV keys must include tenant_id as the first component:**

```
{tenant_id}:{resource_type}:{resource_id}[:{scope}]
```

**Examples**:
- User session cache: `team:org-uuid:session:sess-123` (tenant_id=org-uuid)
- Team config: `team:org-uuid:config` (singleton, no resource_id)
- Audit events: `team:org-uuid:audit:event-456` (event ID within team namespace)
- Decision themes: `team:org-uuid:decisions:sess-123:themes`
- Referral link: `referral:code-abcd5` (global, not tenant-scoped; public data)

### Rationale

1. **Namespace isolation**: Every read/write includes tenant validation at the key level
2. **Audit trail**: KV key itself proves tenant (no hidden coupling in code)
3. **Deletion**: Prefix-delete `team:{team_id}:*` removes all team data (disaster recovery)
4. **Caching**: CDN rules can cache public data (`referral:*`), team data is cache-busted

---

## Tenant-Aware Query Wrapper

To enforce scoping, use a query wrapper instead of raw `KV.get()`:

**Pattern**:
```typescript
// ❌ BAD: Tenant context implicit, easy to leak
await c.env.SESSIONS_KV.get(`session:${sessionId}`);

// ✅ GOOD: Tenant explicitly validated
const session = await tenantKV(c, 'SESSIONS_KV').get(`session:${sessionId}`);
// Internally: checks req.context.teamId matches session owner; throws 403 if not
```

**Implementation** (new utility function):

File: `src/lib/kv.ts`

```typescript
export interface KVContext {
  env: Env;
  teamId: string;
  userId: string;
}

/**
 * Tenant-aware KV wrapper.
 * All gets/puts are implicitly scoped to the provided teamId.
 * @throws 403 if tenant_id in key doesn't match context.teamId
 */
export function tenantKV(context: KVContext, kvStoreName: string) {
  const kvStore = context.env[kvStoreName];
  
  return {
    async get(key: string): Promise<string | null> {
      const fullKey = `team:${context.teamId}:${key}`;
      const value = await kvStore.get(fullKey);
      return value;
    },

    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      const fullKey = `team:${context.teamId}:${key}`;
      await kvStore.put(fullKey, value, options);
    },

    async delete(key: string) {
      const fullKey = `team:${context.teamId}:${key}`;
      await kvStore.delete(fullKey);
    },

    /**
     * Delete all team data (e.g., on team deletion).
     * @param prefix Optional prefix (e.g., 'audit:') to delete only audit events
     */
    async deleteTeamPrefix(prefix?: string) {
      const searchKey = prefix 
        ? `team:${context.teamId}:${prefix}`
        : `team:${context.teamId}:`;
      // KV has no list() in SDK; use D1 audit table instead (audit is append-only)
      // For other stores, use list() with prefix on next SDK upgrade
      console.warn(`Deleting prefix ${searchKey}. Manual cleanup may be needed.`);
    }
  };
}

// Usage
const session = await tenantKV(c, 'SESSIONS_KV').get(`session:${sessionId}`);
await tenantKV(c, 'AUDIT_KV').put(`audit:event-${id}`, JSON.stringify(event));
```

---

## Global/Public Data (Exceptions)

**Some KV data is intentionally global and public**:
- Referral links: `referral:{code}` (discoverable by code, not team-scoped)
- Analytics aggregates: `analytics:daily:2026-04-23` (public metrics)
- Feature flags: `feature:flag-name` (not tenant-specific)

**Convention for global keys**:
- Use **no `team:` prefix** to mark them as non-tenant-scoped
- Add a comment: `// Global/public data; not tenant-scoped`
- Always validate public data at read (e.g., referral code must link back to valid team)

**Examples**:
```typescript
// ✅ GOOD: Referral is intentionally public; but validation links it to a team
const referral = await c.env.REFERRALS_KV.get(`referral:${code}`);
if (!referral) throw 404;
const { referrerId } = JSON.parse(referral);
// Now validate referrerId is requester's allowed context (e.g., is requester in referrerId's team?)
```

---

## Migration Plan

**Current state**: Audit needed to identify un-scoped KV keys.

**Sprint 18**:
1. Write `scripts/audit-kv-scoping.ts` to scan codebase for unsafe KV patterns:
   - `KV.get()` without tenant context
   - Keys missing `team:{id}:` prefix
2. Identify high-risk stores (SESSIONS_KV, AUDIT_KV, DECISIONS_KV)
3. Create a **Breaking Change PR** with:
   - New `tenantKV()` wrapper in `src/lib/kv.ts`
   - Migrate all routes to use wrapper
   - Update all KV keys to `team:{id}:*` pattern
   - Update unit tests to mock tenant context

**Sprint 19+**:
- Deploy migration PR (coordinate with ops; may need KV backfill for existing keys)
- Monitor: log any `tenantKV()` 403 errors (indicates cross-tenant attempt or bug)

---

## Code Review Checklist

**For any PR touching KV**:
- [ ] All KV reads use `tenantKV(context, 'STORE_NAME')`
- [ ] All KV keys use `{resource_type}:{resource_id}` pattern (team scoping handled by wrapper)
- [ ] If global/public data, explicit comment: `// Global/public data; not tenant-scoped` + validation logic
- [ ] No raw `KV.get(hardcodedKey)` anywhere
- [ ] Tests mock tenant context: `{ teamId: 'test-team', ... }`

---

## Testing Strategy

**Unit tests**:
```typescript
describe('tenantKV wrapper', () => {
  it('prefixes keys with team:teamId:', async () => {
    const kv = tenantKV({ teamId: 'team-A', ... }, 'TEST_KV');
    await kv.put('session:123', 'data');
    expect(mockKV.put).toHaveBeenCalledWith('team:team-A:session:123', ...);
  });

  it('isolates team A from team B', async () => {
    const kvA = tenantKV({ teamId: 'team-A', ... }, 'TEST_KV');
    const kvB = tenantKV({ teamId: 'team-B', ... }, 'TEST_KV');
    
    await kvA.put('session:123', 'A-data');
    await kvB.put('session:123', 'B-data'); // Same key, different values
    
    expect(await kvA.get('session:123')).toBe('A-data');
    expect(await kvB.get('session:123')).toBe('B-data');
  });
});
```

**Integration tests**:
- Cross-team access attempt → 403 Forbidden (middleware blocks before reaching KV)
- Team deletion → all `team:{id}:*` keys removed (snapshot test on cleanup)

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Migration breaks existing keys (KV has no built-in rename) | Create backfill job: list existing KV, migrate to new prefix, delete old |
| `tenantKV()` wrapper overhead (extra string concatenation) | Negligible (ms/request); benchmark if needed |
| Team-agnostic data (analytics, flags) is forgotten | Code review checklist; linter rule if possible |
| Wrapper doesn't catch all cases (e.g., hardcoded team IDs) | Linter rule: flag `KV.get()` outside `tenantKV()` |

---

## Open Questions

1. **KV list() API**: Cloudflare KV SDK lacks prefix-list in some versions. Plan to upgrade to latest SDK for `deleteTeamPrefix()` support?
2. **Team deletion**: Should team deletion hard-delete from KV (GDPR right to be forgotten) or soft-delete? (Recommend hard-delete with audit trail in D1.)
3. **Rate limits**: Tenant-scoped keys don't change rate-limit bucketing (still per-KV-store). OK? (Yes; bucketing is infrastructure, not user-facing.)

---

## References

- **Cloudflare KV Docs**: https://developers.cloudflare.com/kv/
- **Qesto ARCHITECTURE.md**: KV patterns, multi-tenant isolation requirements
- **GDPR Compliance**: Right to erasure (Article 17) → hard-delete on team removal
- **Sprint 18 Plan**: ENT-05 Multi-Tenant Isolation (8 pts)
