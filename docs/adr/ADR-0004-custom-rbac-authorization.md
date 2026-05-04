# ADR-0004: Custom RBAC Authorization

_Hub: [../README.md](../README.md)._

Date: 2026-05-04
Status: Proposed for Sprint 20 review
Backlog ID: AUTHZ-ADR-01

## Context

Qesto currently has a simple team/admin role model and plan entitlements:

- Plan entitlements decide whether a paid capability is available.
- Team roles decide whether a user can act inside a team.
- Admin roles decide whether a user can operate platform-wide admin surfaces.

Sprint 20 closed the entitlement evidence gap through `PLAN_ENTITLEMENT_AUDIT.md` and contract tests. Sprint 21 must not add custom roles until authorization semantics are explicit enough to avoid privilege drift, audit gaps, and route-by-route one-off checks.

## Decision

Qesto will introduce custom RBAC as a scoped permission layer on top of the existing plan and team-role model.

Authorization order:

1. **Authentication**: request must have a valid user session.
2. **Plan entitlement**: paid capability must be available for the user's plan.
3. **Team membership**: user must belong to the team or own the session/resource.
4. **Scoped permission**: user must have the required permission for the route/action.
5. **Admin override**: platform admin/owner can operate admin-only routes, with audit logging.

Plan entitlements remain separate from RBAC. A custom role can never unlock a paid capability that the plan denies.

## Permission Model

Permissions are action-oriented strings:

| Permission | Scope | Examples |
|---|---|---|
| `session:create` | team | Create DRAFT sessions |
| `session:update` | session/team | Edit title, settings, questions |
| `session:launch` | session/team | Run preflight and start DRAFT -> LIVE |
| `session:close` | session/team | Close LIVE sessions |
| `session:archive` | session/team | Archive CLOSED sessions |
| `session:export` | session/team + plan | Export results |
| `template:read` | team/global | Browse customer and Qesto templates |
| `template:write` | team | Create/edit customer templates |
| `team:manage_members` | team | Invite/remove members |
| `team:manage_auth` | team + plan | Configure SAML/SSO |
| `team:read_audit` | team | View audit events |
| `billing:manage` | team/account | Open checkout/portal and change plan |
| `admin:read` | platform | View admin dashboards |
| `admin:write` | platform | Mutate users, plans, suspensions |

## Built-In Role Mapping

Existing roles map into permissions before custom roles are added:

| Role | Default permissions |
|---|---|
| `owner` | All team permissions, billing, SAML, audit, member management |
| `admin` | All team permissions except billing ownership transfer |
| `member` | `session:create`, `session:update`, `session:launch`, `session:close`, `template:read` |
| `viewer` | `template:read`, read-only session/results access |

Custom roles may remove or add team-scoped permissions but must remain bounded by plan entitlements.

## Route Ownership Map

| Route group | Owner | Required guard |
|---|---|---|
| `functions/api/routes/sessions.ts` | Backend + Product | `session:*` permission plus plan gates for paid question/export/AI capability |
| `functions/api/routes/teams.ts` | Backend + Enterprise | `team:manage_members`, `team:manage_auth`, audit for membership/auth changes |
| `functions/api/routes/templates.ts` | Frontend + Product | `template:read` / `template:write`; no direct session creation from card |
| `functions/api/routes/insights.ts` and `ai-insights/*` | Backend + AI | `session:export`/insights read permission plus `insightsAI` entitlement |
| `functions/api/routes/billing.ts` | Backend + Finance | `billing:manage`; plan mutation audit |
| `functions/api/routes/admin.ts` | Platform Ops | `admin:read` / `admin:write`; platform audit |
| `functions/api/routes/energizers/*` | Realtime + Product | No LIVE protocol expansion before DO protocol ADR |

## Data Model Direction

Sprint 21 implementation should add tables rather than overload KV:

```sql
custom_roles (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

team_role_assignments (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at INTEGER NOT NULL
);
```

Built-in roles remain valid and should not require migration on day one. Custom role assignments augment or replace a user's team permission set only within that team.

## Audit Semantics

The following must emit audit events:

- custom role created, renamed, edited, deleted;
- user assigned to or removed from a custom role;
- SAML/auth settings changed;
- permission denied for sensitive admin/team-auth mutations when traceability is needed.

Audit payloads must not include emails, prompts, JWTs, SAML secrets, certificates, or raw participant text.

## Contract Test Strategy

Every new permission must have:

- one allow test for a role with the permission;
- one deny test for an authenticated user without the permission;
- one plan-deny test when the permission touches a paid capability;
- one cross-team isolation test when the resource is team-scoped;
- one audit test for role mutation actions.

## Consequences

Positive:

- Sprint 21 can implement custom RBAC without mixing it into plan entitlements.
- Paid features remain monetization-safe.
- Audit expectations are clear before UI work starts.

Tradeoffs:

- More route metadata is required.
- Role mutation work needs D1 migrations and new admin/team UX.
- Existing tests need expansion before implementation can safely land.

## Gates

- Sprint 20 can close when this ADR is reviewed and no RBAC implementation has begun.
- Sprint 21 RBAC implementation can begin only after this ADR is accepted by Product Owner + Architect.
- LIVE energizer permissions stay out of scope until the Durable Object protocol/versioning ADR exists.
