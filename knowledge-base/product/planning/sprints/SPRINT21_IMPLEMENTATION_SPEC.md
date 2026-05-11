# Sprint 21 Implementation Spec

_Hub: [Documentation map](./README.md)._

_Created: 2026-05-04 (Europe/Amsterdam)._

## Goal

Sprint 21 turns the Sprint 20 entitlement evidence and accepted authorization ADR into the first custom RBAC implementation slice. The sprint stays deliberately narrow: custom roles and delegated permissions for team-management/compliance actions, with plan entitlements still enforced above permissions.

## Built Scope

### AUTHZ-ADR-01

- [`ADR-0004: Custom RBAC Authorization`](../../adr/ADR-0004-custom-rbac-authorization.md) is accepted for Sprint 21 implementation.
- Authorization order remains:
  1. authentication;
  2. plan entitlement;
  3. team membership;
  4. scoped permission;
  5. admin override where applicable.

### AUTHZ-RBAC-01

- Added D1-backed custom role tables:
  - `custom_roles`
  - `team_role_assignments`
- Added migration: `migrations/0013_custom_rbac.sql`.
- Added `functions/api/lib/authz.ts` with:
  - canonical permission keys;
  - built-in role-to-permission mapping;
  - custom assignment lookup;
  - `hasTeamPermission()`.
- Team routes now use permission checks for:
  - `team:manage_members`;
  - `team:manage_auth`.
- Plan entitlements still win over custom permissions. Example: `team:manage_auth` cannot configure SAML unless `samlSso` is available on the plan.

### AUTHZ-RBAC-02

Backend UX/API foundation:

- `GET /api/teams/:id/roles`
- `POST /api/teams/:id/roles`
- `PATCH /api/teams/:id/roles/:roleId`
- `DELETE /api/teams/:id/roles/:roleId`
- `POST /api/teams/:id/roles/:roleId/assignments`
- `DELETE /api/teams/:id/roles/:roleId/assignments/:userId`

The frontend admin role-management screen remains follow-up UI polish; the backend contract is ready.

### Compliance UX Follow-Through

- Role creation, update, deletion, assignment, unassignment, and permission-denied events emit audit records.
- Invite/member removal uses the same permission gate and audit path.
- Audit snapshots avoid emails, tokens, SAML secrets, prompts, and participant text.

## Acceptance Criteria

- Custom role can grant `team:manage_members` to a non-admin team member.
- A user without that permission receives 403 and an audit event.
- SAML configuration remains plan-gated even when the user has `team:manage_auth`.
- Built-in owner/admin/member/viewer behavior remains compatible with existing team tests.
- Focused tests pass:
  - `tests/integration/custom-rbac.test.ts`
  - `tests/integration/teams-crud.test.ts`
  - `tests/integration/entitlement-contracts.test.ts`
- `npm run typecheck` passes.

## Deferred

- Full role-management frontend screen.
- Route-by-route session permission rollout.
- Billing permission UI.
- LIVE energizer permissions, pending Durable Object protocol/versioning ADR.
