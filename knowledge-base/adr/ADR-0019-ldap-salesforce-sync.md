---
id: ADR-0019
status: accepted
created: 2026-05-22
---

# ADR-0019: LDAP and Salesforce Sync Model

## Decision

1. **LDAP** — `LDAP_URL` + bind credentials via secrets; `POST /api/ldap/sync` triggers directory import (skeleton).
2. **Group mapping** — LDAP groups map to Qesto team roles via config KV (LDAP-02 follow-up).
3. **Salesforce** — OAuth provider pushes closed-session JSON summary to configured object (SF-01 skeleton).
4. **Notion** — legacy customer export OAuth only; **internal docs use Obsidian** (`OBSIDIAN_KB_STANDARD.md`), not Notion.

## Consequences

- No bidirectional sync in v2.4 MVP.
- Enterprise SSO (SAML) remains separate from LDAP provisioning.
