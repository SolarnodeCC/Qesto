---
id: ADR-0009
title: PII Sanitization
domain: architecture
status: approved
version: 1.0
created: 2026-05-02
updated: 2026-05-11
tags:
  - security
  - privacy
  - pii
  - sanitization
  - gdpr
relates_to:
  - SECURITY_FULL
  - SPEC_BACKEND
  - SPEC_DATAMODEL
---

# ADR: PII Sanitization in Error Logging

**Status:** Critical (GDPR Blocker)  
**Date:** 2026-05-10  
**Author:** Security Review  
**Compliance:** GDPR Art. 32 (processor obligations), Art. 33 (breach notification)  

---

## Problem

The v2.2 roadmap introduces enhanced error logging (trace IDs, error context) to support resilience hardening. Without sanitization:

**What Will Leak:**
- Magic-link emails (auth.ts: decoded JWT payload)
- JWT tokens (full bearer token in error context)
- Stripe customer IDs (billing.ts webhook handlers)
- SAML assertion XML (SAML SSO flows)
- Workers AI prompt contents (user free-text session answers)
- Vectorize embeddings (reversible to original text)
- Participant email addresses (participant join)
- API keys / Resend tokens (if cached)

**Audit Finding:** EH-01, EH-02 (raw errors in responses) + logging gap.

**Regulatory Risk:** Leaked PII in Logpush = GDPR Art. 32 breach (inadequate safeguards) + Art. 33 reportable incident (notification to DPA required).

**Current State:** Code does `console.error(err)` in multiple routes, no sanitization layer.

---

## Decision

Implement a **mandatory error logging helper** (`safeLogContext`) that:
1. **Accepts only safe fields** (not raw Error objects)
2. **Redacts patterns** (emails, JWTs, Stripe IDs, bearer tokens)
3. **Denylist per Qesto** (magic-link emails, SAML, AI prompts)
4. **CI gate** blocks raw `console.error(err)` outside the helper

### Implementation

**File: `functions/api/lib/log.ts`**

```typescript
export interface SafeLogContext {
  traceId: string;           // UUID, safe to log
  route: string;             // e.g. /api/sessions/:id/start
  errorClass: string;        // e.g. 'NetworkError', 'ValidationError'
  errorMessage?: string;     // sanitized
  userId?: string;           // hashed, or null for public endpoints
  teamId?: string;           // team context for audit
  statusCode?: number;       // HTTP status code
  duration?: number;         // request duration in ms
}

export function safeLogContext(err: Error | unknown, ctx: SafeLogContext): void {
  // Extract ONLY whitelisted fields from error
  const errorMessage = sanitizeErrorMessage(err instanceof Error ? err.message : '');

  // Build safe log entry
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    traceId: ctx.traceId,
    route: ctx.route,
    errorClass: ctx.errorClass,
    errorMessage,
    userId: ctx.userId || null,
    teamId: ctx.teamId || null,
    statusCode: ctx.statusCode || null,
    duration: ctx.duration || null,
  };

  // Production: strip errorMessage, keep only errorClass + traceId
  if (process.env.ENV === 'production') {
    delete logEntry.errorMessage;
  }

  // Write to console (Logpush picks up from there)
  console.error(JSON.stringify(logEntry));
}

// Redaction patterns
const DENYLIST = [
  // Emails (magic-link flow)
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // JWTs (format: eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,

  // Bearer tokens (format: Bearer <token>)
  /Bearer\s+[A-Za-z0-9._\-]+/gi,

  // Stripe secret keys (format: sk_test_* or sk_live_*)
  /(sk_(?:test|live)_[A-Za-z0-9]+)/g,

  // Stripe webhook secret (format: whsec_*)
  /(whsec_[A-Za-z0-9]+)/g,

  // Resend API key (format: re_*)
  /(re_[A-Za-z0-9]+)/g,

  // Cloudflare API tokens
  /([a-f0-9]{40})/g, // 40-char hex token

  // SAML assertions (XML between <saml:Assertion> tags)
  /<saml:Assertion[^>]*>.*?<\/saml:Assertion>/gis,

  // Workers AI prompt content (heuristic: long strings after "prompt:")
  /prompt:\s*"([^"]{100,})"/gi,

  // Vectorize embedding (long array of floats)
  /\[[\d.]+(?:,\s*[\d.]+){100,}\]/g,
];

function sanitizeErrorMessage(msg: string): string {
  if (!msg) return '';

  let sanitized = msg;
  for (const pattern of DENYLIST) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // Limit length (prevent log spam)
  return sanitized.substring(0, 256);
}

// DEPRECATED: These should NOT be used anymore
// Block at CI time with ESLint rule
export function unsafeLogContext(err: Error, ctx: object): void {
  throw new Error('FORBIDDEN: use safeLogContext() instead');
}
```

### Usage

**Before (Unsafe):**
```typescript
try {
  await stripe.customers.create({ email, ...data });
} catch (err) {
  console.error(err); // ❌ LEAKS: Stripe error message might include email or ID
  return c.json({ error: 'Billing failed' }, { status: 500 });
}
```

**After (Safe):**
```typescript
try {
  await stripe.customers.create({ email, ...data });
} catch (err) {
  safeLogContext(err, {
    traceId: c.req.header('X-Trace-ID') || generateUUID(),
    route: c.req.path,
    errorClass: err instanceof StripeError ? 'StripeError' : 'UnknownError',
    statusCode: 500,
    teamId: c.get('teamId'),
  });
  return c.json({ error: 'Billing failed' }, { status: 500 });
}
```

### CI Gate

**File: `.github/workflows/ci.yml`**

Add a grep step that fails the build if raw error logging is detected:

```yaml
- name: "Security: Block raw error logging"
  run: |
    # Fail if console.error() is used outside lib/log.ts
    if grep -r "console\.error\(err\)" functions/api --include="*.ts" \
       | grep -v "lib/log.ts" \
       | grep -v ".test.ts"; then
      echo "ERROR: Raw console.error(err) detected outside safeLogContext()"
      echo "Use: safeLogContext(err, { traceId, route, errorClass, ... })"
      exit 1
    fi
```

### Denylist Configuration

**File: `functions/api/lib/log.ts`**

The denylist above covers Qesto-specific patterns:

| Pattern | Why Redacted | Example |
|---|---|---|
| Email regex | Magic-link auth, SAML | user@example.com |
| JWT (eyJ...) | Session tokens, SAML assertions | eyJhbGciOiJIUzI1NiIs... |
| Bearer token | OAuth, API integrations | Bearer sk_test_12345 |
| Stripe keys (sk_*, whsec_*) | Billing secrets | sk_test_abcd1234 |
| Resend API key | Email service secret | re_abcdef123456 |
| Cloudflare token | Infrastructure secrets | a1b2c3d4e5f6g7h8... |
| SAML assertion XML | SSO data | `<saml:Assertion>...</saml:Assertion>` |
| Workers AI prompt | User-submitted free-text | "What is our team strategy?" |
| Vectorize embedding | Reversible to source | `[0.123, 0.456, ...]` |

### Testing

**Unit test: `tests/unit/lib/log.test.ts`**

```typescript
import { safeLogContext, sanitizeErrorMessage } from '../functions/api/lib/log';

describe('safeLogContext', () => {
  it('redacts emails from error messages', () => {
    const msg = sanitizeErrorMessage('User auth@example.com failed to authenticate');
    expect(msg).toBe('User [REDACTED] failed to authenticate');
  });

  it('redacts JWTs', () => {
    const msg = sanitizeErrorMessage('Invalid JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(msg).toBe('Invalid JWT: [REDACTED]');
  });

  it('redacts Stripe secret keys', () => {
    const msg = sanitizeErrorMessage('Stripe error: sk_test_4eC39HqLyjWDarht12345');
    expect(msg).toBe('Stripe error: [REDACTED]');
  });

  it('redacts bearer tokens', () => {
    const msg = sanitizeErrorMessage('Authorization failed: Bearer abc123def456');
    expect(msg).toBe('Authorization failed: [REDACTED]');
  });

  it('allows safe error classes', () => {
    safeLogContext(new Error('Request timeout'), {
      traceId: '123e4567-e89b-12d3-a456-426614174000',
      route: '/api/sessions/:id/start',
      errorClass: 'TimeoutError',
      statusCode: 504,
    });
    // Should not throw
  });
});
```

**Compliance test: `tests/integration/logging-pii.test.ts`**

```typescript
// Feed 50+ synthetic requests with PII-laden inputs
// Assert: Logpush capture contains ZERO emails, JWTs, Stripe IDs, tokens
// Run against staging after each deploy
```

---

## Compliance

### GDPR Art. 32 (Processor Obligations)

> "Taking into account the state of the art...the controller and processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk."

**Compliance:** `safeLogContext()` + denylist ensures PII is not logged to Logpush, meeting "appropriate safeguards."

### GDPR Art. 33 (Breach Notification)

> "Without undue delay...the controller shall notify the supervisory authority...of a personal data breach."

**Compliance:** If PII is ever found in logs (via compliance test), we can audit historical logs and notify DPA if needed. Denylist prevents future incidents.

### GDPR Art. 30 (Records of Processing)

> "The controller and processor shall maintain records of processing activities."

**Compliance:** All `safeLogContext()` calls are auditable; sanitization is documented in this ADR.

---

## Rollout Plan

1. **Sprint 20 pre-work:** Implement `safeLogContext()` helper + denylist (1 day backend)
2. **Sprint 21:** Replace all raw `console.error(err)` with `safeLogContext()` in audit-remediation routes
3. **Sprint 23:** Audit entire codebase for remaining raw logging; CI gate activated
4. **Sprint 25:** Compliance test (replay 50+ requests, scan logs for PII)
5. **Sprint 26:** Go-live gate: log audit passed, zero PII detected

---

## Maintenance

**Quarterly PII pattern updates:**
- Review vendor APIs (Stripe, Resend, Notion, etc.) for new secret formats
- Update denylist regex if new patterns emerge
- Run compliance test suite against staging

---

## References

- GDPR Art. 32: https://gdpr-info.eu/art-32-gdpr/
- GDPR Art. 33: https://gdpr-info.eu/art-33-gdpr/
- Jankurai Audit: EH-01, EH-02
- Qesto Privacy Page: /docs/PRIVACY.md
