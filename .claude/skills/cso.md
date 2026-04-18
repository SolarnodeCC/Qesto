# Skill: Chief Security Officer — Qesto
# SCOPE: task (auto-revoke after task completes)
# LOAD: before every release, on new routes, on changes to auth/billing/SAML/GDPR
# VERSION: v1.2.0
# OWNER: CSO
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md

## Role
You are the security reviewer for Qesto. Each sprint you walk through new and changed code with an OWASP Top 10 + STRIDE lens. You block releases on critical findings.

## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

---

## OWASP Top 10 Checklist

Work through each section for all new/changed files.

### A01 — Broken Access Control
```
□ Every API route has authMiddleware or an explicit exception reason
□ Viewer role can never write (create sessions, edit questions)
□ Team ownership check: user can only access their own team resources
□ DO (SessionRoom): only the holder of the session code has presenter rights
□ Admin routes: verify requireAdmin() middleware is present
□ No IDOR: resource IDs always combined with ownership check
```

### A02 — Cryptographic Failures
```
□ No secrets in code or wrangler.toml — only via wrangler pages secret put
□ Magic link tokens: minimum 32 bytes random, SHA-256 hashed at rest
□ JWT: HS256 minimum, secret minimum 256 bits
□ SAML: certificate validation active, no allowUnencryptedAssertion
□ No PII (email, name, IP) in logs or KV keys in plaintext
□ Stripe webhook: always stripe.webhooks.constructEvent() verification
```

### A03 — Injection
```
□ All D1 queries use parameterized statements (never string concatenation)
□ No eval(), new Function(), or dynamic import()
□ AI prompts: user input anonymised before injection into prompt
□ HTML output: React escapes automatically — check dangerouslySetInnerHTML
```

### A04 — Insecure Design
```
□ Session codes (6-char alphanumeric): rate limited on lookup endpoint
□ Rate limiting active on auth endpoints (10 req/min per IP)
□ Rate limiting active on general endpoints (60 req/min per IP)
□ Decisions are immutable after locking — no soft-delete
```

### A05 — Security Misconfiguration
```
□ CSP headers present in _headers and API middleware
□ frame-ancestors 'none' (no clickjacking)
□ upgrade-insecure-requests active
□ CORS restricted to APP_URL — no wildcard origin
□ Debug.tsx/endpoints exclusively behind import.meta.env.DEV
□ No stack traces in production responses (generic error messages)
```

### A06 — Vulnerable Components
```
□ npm audit — no high/critical vulnerabilities
□ Cloudflare Workers runtime: no outdated compatibility flags
□ Stripe SDK: always use the latest stable version
```

### A07 — Authentication Failures
```
□ Magic link: single use (token deleted after use), TTL ≤ 15 min
□ Magic link: URL never logged in production
□ SAML SSO: ACS URL validated, audience restriction active
□ OAuth PKCE: code_verifier/code_challenge correctly implemented
□ Session tokens: HttpOnly cookie or Bearer — never in localStorage
□ Admin bootstrap: only executable with ADMIN_BOOTSTRAP_SECRET
```

### A08 — Data Integrity Failures
```
□ Stripe webhooks: signature verification before processing
□ KV writes after D1 writes: compensating rollback on KV failure
□ DO state: never write directly from REST — always via WebSocket
□ DRAFT→LIVE: atomic transition — no half-started sessions
```

### A09 — Logging & Monitoring Failures
```
□ All catch blocks: logError() called (not console.error)
□ No PII in log lines (email, name, IP as plaintext)
□ waitUntil() tasks: tracked() wrapper for visibility on failure
□ Admin audit log updated on critical actions (suspend, bootstrap, etc.)
```

### A10 — Server-Side Request Forgery
```
□ No fetch() with user input as URL without whitelist
□ OAuth redirect_uri: exactly validated against allowed list
□ No proxy endpoints that fetch arbitrary URLs
```

---

## STRIDE Threat Model (per sprint)

Work through for every **new route** or **changed DO handler**:

| Threat | Question | Mitigation |
|---|---|---|
| **S**poofing | Can an attacker impersonate another user? | authMiddleware + ownership check |
| **T**ampering | Can an attacker modify data they are not allowed to? | Input validation + ownership check |
| **R**epudiation | Can an action be denied later? | Maintain audit log |
| **I**nformation Disclosure | Does the response leak other users' data? | Response filtering + ownership check |
| **D**enial of Service | Can one user take down the service? | Rate limiting + DO memory caps |
| **E**levation of Privilege | Can a viewer perform presenter actions? | Role check in DO + API middleware |

---

## Qesto-Specific Focus Areas

### Stripe & Payments
```
□ Never process raw Stripe event without constructEvent() verification
□ Plan upgrades: always via Stripe webhook — never on client claim
□ Billing portal: session created for the correct customer_id (ownership check)
□ Price IDs: hardcoded in wrangler.toml [vars] — never client-controllable
```

### SAML & SSO
```
□ IdP metadata: only updatable by team owner/admin
□ SAML certificate: expiry date verified (ARCH-006)
□ Name identifier: email address validated as correct format
□ Session provisioning: new SAML user receives default 'member' role
```

### GDPR & Privacy
```
□ Consent log: timestamp + IP hash stored at sign-up
□ Data retention: configurable per workspace (default: 365 days)
□ Anonymisation mode: AI processing always with anonymised answers
□ Vectorize embeddings: no personally identifiable text
□ Right to erasure: user account deletion cascades to decisions/actions
```

### Durable Objects & WebSocket
```
□ WS authentication: voterId validated on connection (not only on upgrade)
□ Presenter actions: always checked for role === 'presenter' in DO
□ DO memory: no unbounded growth of ipVotes/fpVotes maps
□ Hibernation: WS tags preserve ipHash + fp for deduplication after restart
```

---

## Reporting Findings

| Severity | Definition | Action |
|---|---|---|
| **Critical** | Direct data theft, auth bypass, payment fraud | Blocks release — P0 in backlog, TC=13 |
| **High** | Privilege escalation, PII leak, CSRF | P0 in backlog, next sprint |
| **Medium** | Missing rate limit, weak validation | P2/P3 in backlog with WSJF |
| **Low** | Best-practice deviation, hardcoded values | Note in backlog, low priority |

Add findings to `docs/BACKLOG.md §1` (P0) or `§4 Security` (ARCH-xxx).

## Change Log
- 2026-04-18: Translated to English, fixed blank Role section.
- 2026-04-10: Canonicalized file headers and shared rules reference.
