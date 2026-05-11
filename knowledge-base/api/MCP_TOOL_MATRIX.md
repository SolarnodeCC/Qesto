# Qesto MCP Server — Tool Matrix
# STATUS: Wave 1 Pilot
# OWNER: qesto-architect + qesto-backend
# Date: 2026-04-24

_Internal MCP server for Qesto operations: session analytics, team audit, decision search, metrics reporting._

---

## Tool Matrix (8 Tools)

| # | Tool Name | Purpose | Auth | Classification | Status |
|---|---|---|---|---|---|
| 1 | `sessions.list` | List team's sessions with metadata | Bearer token | **Read** | Spec ✅ |
| 2 | `sessions.get` | Fetch single session details | Bearer token | **Read** | Spec ✅ |
| 3 | `teams.audit_log` | Team activity/member audit trail | Admin role | **Read** | Spec ✅ |
| 4 | `decisions.search` | Vector search across session decisions | Bearer token | **Read** | Spec ✅ |
| 5 | `metrics.session_stats` | Session duration, participant count, plan usage | Bearer token | **Read** | Spec ✅ |
| 6 | `metrics.team_monthly` | Team monthly onboarded users, active sessions | Admin role | **Read** | Spec ✅ |
| 7 | `admin.bulk_export` | Export sessions/decisions for data requests | Admin role | **Read** | Spec ✅ |
| 8 | `admin.compliance_report` | GDPR compliance report (deletions, consents) | Admin role | **Read** | Spec ✅ |

---

## Tool Specifications (Sample: `sessions.list`)

```typescript
// MCP Tool: sessions.list
// Category: Read-only analytics
// Input schema:
{
  type: 'object',
  properties: {
    teamId: { type: 'string', description: 'Team UUID' },
    limit: { type: 'number', description: 'Max results (1-100, default 20)' },
    offset: { type: 'number', description: 'Pagination offset' },
    status: {
      type: 'string',
      enum: ['draft', 'active', 'closed', 'archived'],
      description: 'Filter by session status'
    }
  },
  required: ['teamId']
}

// Output schema:
{
  type: 'object',
  properties: {
    sessions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          voterCount: { type: 'number' },
          questionCount: { type: 'number' }
        }
      }
    },
    total: { type: 'number' },
    offset: { type: 'number' }
  }
}
```

---

## Authentication & Authorization

### Bearer Token (Read-only tools)
- User must be team member or session participant
- Token: JWT from `POST /auth/magic-link`
- Scope: Only own team/session data

### Admin Role (Audit & Compliance)
- User must have `role === 'admin'` in team
- Additional: Stripe webhook secret validation for bulk exports
- Scope: Full team data

---

## Read/Write Classification

### READ (8/8 tools)
All tools are **read-only**:
- No mutations on D1 or KV
- No external API calls (Stripe, email, AI)
- Safe for concurrent calls
- Pagination enforced

### WRITE
None for Wave 1. Future tools may include:
- `admin.invite_user` (write)
- `admin.update_plan` (write)

---

## Evaluation Query Set (10 test queries)

| Query | Expected | Eval Status |
|---|---|---|
| List all sessions for team "acme-corp" | 5–15 sessions returned | Ready |
| Get details for session "sess_abc123" | Full metadata + question count | Ready |
| Search decisions for "budget" keyword | 3–5 relevant decisions | Ready |
| Get team monthly metrics (Mar 2026) | Active sessions: 12, Users added: 5 | Ready |
| Paginate: sessions with limit=5, offset=10 | Correct offset + next page link | Ready |
| Query with invalid teamId | 403 Forbidden | Ready |
| Query with missing auth token | 401 Unauthorized | Ready |
| Get audit log for team (last 30 days) | 50+ events (member adds, invites, etc) | Ready |
| Export sessions for GDPR request | ZIP file with JSON blobs | Ready |
| Compliance report: Check deleted user cascade | Confirm decisions anonymized | Ready |

---

## Implementation Status

- [x] Tool matrix defined (8 tools)
- [x] Auth/read-write classification finalized
- [x] Tool schemas drafted (TypeScript interfaces ready)
- [ ] Server scaffold created (npm package structure)
- [ ] Tools implemented in MCP SDK
- [ ] Eval queries executed
- [ ] Server tested in isolation

---

## Next Steps (Wave 1 → Implementation)

1. Use MCP SDK to scaffold server package
2. Implement each tool's handler logic (query D1, format response, pagination)
3. Run 10 eval queries against staging DB
4. Measure latency (target: < 1s p95)
5. Document final tool responses for integration into Claude

---

## References

- [MCP Specification](https://modelcontextprotocol.io/)
- Qesto D1 schema: `docs/ARCHITECTURE.md §Database`
- Auth patterns: `functions/api/auth.ts`
