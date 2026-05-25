---
status: shipped
branch: feat/sprint-51-v31-multi-region-ldap
---

# Sprint 51 — Obsidian KB + Multi-Region Write + LDAP Sync Start

**Window:** 2027-03-31 → 2027-04-14

| ID | Status |
|----|--------|
| KB-OBSIDIAN-01 | Shipped — `OBSIDIAN_KB_STANDARD.md`, README/CONTRIBUTING/AGENTS |
| KB-NOTION-DEPRECATE-01 | Shipped — `archive/notion-import/`, no active `notion.so` in KB |
| ADR-0022-PHASE-2 | Shipped — `ADR-0022-phase-2-write-routing.md`, `MULTI_REGION_RUNBOOK.md` |
| MULTI-REGION-WRITE-01 | Shipped — `resolveWriteRegion()`, health `writeRegion`, session create telemetry |
| MULTI-REGION-FAILOVER-01 | Shipped — KV flag, `POST/DELETE /api/admin/multi-region/failover` |
| LDAP-01 | Shipped — mock/bridge `fetchLdapDirectory` + `syncLdapDirectoryToTeam` |

## Verification

```bash
npm run typecheck
npm test -- tests/unit/multi-region.test.ts tests/unit/ldap-sync.test.ts
```
