# Validation Strategy for Trust Boundaries (HLT-031)

## Overview

This document outlines the systematic approach for fixing **HLT-031: Unchecked Boundary Cast** issues across the codebase. All data crossing trust boundaries must be validated before type narrowing.

## Trust Boundaries

Data requiring validation occurs at these boundaries:
1. **Network input**: HTTP request bodies, WebSocket messages, query parameters
2. **Persistent storage**: Database reads (D1), Key-value reads (KV), local storage
3. **External services**: OAuth responses, third-party APIs
4. **Type narrowing**: Any `as Type` cast on untrusted data

## Validation Pattern

### Before (Unsafe)
```typescript
const msg = JSON.parse(text) as ClientMessage
const user = await kv.get(key)
const data = JSON.parse(user) as UserData
```

### After (Safe)
```typescript
const msg = parseClientMessage(text) // validates and narrows type
const data = validateKvJson(user, UserDataSchema) // validates before casting
```

## Implementation: Proof-Aware Validators

All validators are in `functions/api/lib/validators.ts` using Zod schemas. Each schema:
- Defines the required shape and types
- Provides runtime validation at the boundary
- Returns `null` on validation failure (graceful degradation)
- Uses type inference to keep code in sync with schemas

## Fixed Boundaries ✅

### 1. WebSocket Protocol (SessionRoom)
- **File**: `functions/api/SessionRoom.ts`
- **Validator**: `parseClientMessage(text)`
- **Schemas**: `ClientMessageSchema`, `VersionedClientEnvelopeSchema`
- **Coverage**: All incoming WebSocket messages

### 2. Auth KV Storage
- **Files**: `functions/api/routes/auth/helpers.ts`, `functions/api/routes/auth/password.ts`
- **Validators**:
  - `validateKvJson(raw, OAuthStateSchema)` — OAuth identity links
  - `validateKvJson(raw, PasswordCredentialSchema)` — password hashes
  - `validateKvJson(raw, PasswordResetSchema)` — reset tokens
- **Coverage**: All auth credential reads from KV

### 3. Sessions & Questions
- **File**: `functions/api/routes/sessions.ts`
- **Validators**:
  - `validateKvJson(json, PollOptionArraySchema)` — question options
  - `validateKvJson(json, StringArraySchema)` — team IDs
  - `validateKvJson(json, CachedQuestionsSchema)` — cached AI questions
- **Coverage**: Database question parsing, team lookups, cache hydration

### 4. OAuth Token Exchange (Google & Microsoft)
- **File**: `functions/api/lib/oauth.ts`
- **Validators**:
  - `validateData(response, GoogleTokenResponseSchema)` — Google token responses
  - `validateData(response, MicrosoftTokenResponseSchema)` — Microsoft token responses
  - `validateData(payload, GoogleIdTokenPayloadSchema)` — Google ID token claims
  - `validateData(payload, MicrosoftIdTokenPayloadSchema)` — Microsoft ID token claims
  - `validateData(jwks, JwksResponseSchema)` — JWKS endpoint responses
- **Coverage**: All external OAuth provider API responses before use

### 5. Audit Events
- **File**: `functions/api/lib/audit.ts`
- **Validator**: `validateData(action, AuditActionSchema)`
- **Coverage**: Audit action enum validation before persistence

### 6. Team Management
- **File**: `functions/api/routes/teams.ts`
- **Validators**:
  - `validateData(json, PermissionArraySchema)` — role permissions from DB
  - `validateData(json, TeamInviteTokenSchema)` — team invite tokens from KV
- **Coverage**: Team role assignments, invitation token parsing

### 7. Templates & Billing
- **Files**: `functions/api/routes/templates.ts`, `functions/api/routes/billing.ts`
- **Validators**:
  - `validateData(json, TemplateIdArraySchema)` — customer template lists
  - `validateData(json, CustomerTemplateSchema)` — individual templates
  - `validateData(json, StripeCustomerRecordSchema)` — Stripe customer IDs
  - `validateData(json, StripeSubscriptionRecordSchema)` — Stripe subscription IDs
- **Coverage**: Template KV reads, Stripe customer/subscription lookups

### 8. KV Utility Functions
- **File**: `functions/api/lib/kv.ts`
- **Validator**: `readKvJson(kv, key, schema?)`
- **Behavior**: Accepts optional Zod schema; returns `null` if validation fails

## Remaining High-Priority Boundaries 🔴

### Routes (HLT-031) — ~15 files
- ✅ `functions/api/routes/teams.ts` — ✅ FIXED
- ✅ `functions/api/routes/templates.ts` — ✅ FIXED
- ✅ `functions/api/routes/billing.ts` — ✅ FIXED
- `functions/api/routes/knowledge-base.ts` — KB data parsing
- `functions/api/routes/insights.ts` — Insights response parsing
- `functions/api/routes/admin.ts` — Admin data parsing (also has SQL issues—HLT-031-SQL)
- `functions/api/routes/auth/register-analyze.ts` — Analysis request parsing
- `functions/api/routes/kb-search.ts` — Search result parsing
- `functions/api/routes/energizers/vote-next.ts` — Energizer voting data
- `functions/api/routes/ai-insights/register-analyze.ts` — AI analysis parsing

### Libraries (HLT-031) — ~10 files
- ✅ `functions/api/lib/audit.ts` — ✅ FIXED (audit event action validation)
- ✅ `functions/api/lib/oauth.ts` — ✅ FIXED (OAuth token/JWT validation)
- `functions/api/lib/authz.ts` — Authorization rule parsing
- `functions/api/lib/saml.ts` — SAML response parsing
- `functions/api/lib/integrations/token-store.ts` — Token storage
- `functions/api/lib/help-vectorize.ts` — Vector embedding parsing
- `functions/api/lib/insights-vectorize.ts` — Insights vectorization
- `functions/api/lib/insights-analyze-data.ts` — Insights analysis data
- `functions/api/services/kbSearchService.ts` — KB search results
- `functions/api/repositories/kbVectorRepository.ts` — Vector repository

### Frontend (HLT-031) — ~5 files
- `src/api/client.ts` — API response parsing
- `src/hooks/useLiveSession.ts` — WebSocket message handling
- `src/components/SessionWizard.tsx` — Form data validation
- `src/pages/JoinPage.tsx` — URL/QR code parameter parsing
- `src/components/LanguageSwitcher.tsx` — Language preference parsing

### Scripts (HLT-031) — 3 files
- `scripts/embed-kb.ts` — KB embedding validation
- `scripts/kb-sync-cli.ts` — KB sync data validation
- `scripts/sync-help-docs.ts` — Help docs parsing

## Remediation Priority

1. **Critical** (Auth/Security): admin.ts, oauth.ts, saml.ts, audit.ts
2. **High** (Data Integrity): teams.ts, templates.ts, billing.ts, insights.ts
3. **Medium** (Nice-to-have): kb-search.ts, help-*.ts, vectorize.ts
4. **Low** (Frontend): React components, client API

## Adding a New Validator

### Step 1: Define the Schema
```typescript
// functions/api/lib/validators.ts
export const MyDataSchema = z.object({
  id: z.string(),
  value: z.number(),
  metadata: z.unknown().optional(),
})

export type ValidMyData = z.infer<typeof MyDataSchema>
```

### Step 2: Use in Boundary Crossing
```typescript
// functions/api/routes/myroute.ts
import { validateKvJson, MyDataSchema } from '../lib/validators'

const data = validateKvJson(raw, MyDataSchema)
if (!data) {
  // Handle validation failure
  return null
}

// data is now safely typed as MyData
```

### Step 3: Test
- Verify happy path: valid data parses correctly
- Verify error path: invalid data returns null or throws appropriately
- Check type inference: TypeScript should infer the validated type

## SQL Injection (HLT-031-SQL)

**Note**: `functions/api/routes/admin.ts` also flags HLT-031-SQL (raw SQL construction). This is a separate issue from type validation. See SQL hardening guidance.

## References

- Zod docs: https://zod.dev
- OWASP Input Validation: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- TypeScript exactOptionalPropertyTypes: Ensures optional fields don't have `undefined` values
