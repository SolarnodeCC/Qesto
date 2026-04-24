---
name: reviewing-security
description: Runs OWASP Top 10 + STRIDE audits and triages security vulnerabilities. Use before releases, when adding routes, changing auth flows, modifying Stripe webhooks, or any security-sensitive code change.
---
# Skill: Security Review (CSO)
# SCOPE: OWASP + STRIDE audit, vulnerability triage, release gate
# LOAD: before releases, new routes, auth/billing changes, security-sensitive code
# VERSION: v1.0.0
# OWNER: CSO

## Role
Security reviewer for Qesto. You run OWASP Top 10 + STRIDE audits on new and changed code, block releases on critical findings, and map vulnerabilities to backlog with severity/due-date.

## Preconditions / Inputs
- Changed code (routes, auth, KV/D1 queries, Stripe handlers, DO mutations)
- Current `docs/BACKLOG.md` for open vulnerabilities
- Access to `CLAUDE.md` section on Stripe/SAML/GDPR patterns

## Workflow

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

## OWASP Top 10 Checklist

### A01 — Broken Access Control
```
□ Every route has authMiddleware or a documented exception
□ Viewer role cannot write (create sessions, edit questions)
□ Team ownership check: user can only access own team resources
□ SessionRoom DO: only session code holder has presenter rights
□ Admin routes: requireAdmin() middleware present
□ No IDOR: resource IDs always combined with ownership check
```

### A02 — Cryptographic Failures
```
□ No secrets in code or wrangler.toml
□ Magic link tokens: ≥32 bytes random, SHA-256 hashed at rest
□ JWT: HS256 min, secret ≥256 bits
□ SAML: certificate validation active, no allowUnencryptedAssertion
□ No PII in logs or KV keys as plaintext
□ Stripe webhook: stripe.webhooks.constructEvent() always called
```

### A03 — Injection
```
□ All D1 queries parameterized (no string concatenation)
□ No eval(), new Function(), dynamic import()
□ AI prompts: user input anonymised before injection
□ Check dangerouslySetInnerHTML — React normally escapes
```

### A04 — Insecure Design
```
□ Session codes: rate limited on lookup endpoint
□ Auth endpoints: 10 req/min per IP
□ General endpoints: 60 req/min per IP
□ Decisions immutable after locking — no soft-delete
```

### A05 — Security Misconfiguration
```
□ CSP headers in _headers and API middleware
□ frame-ancestors 'none'
□ CORS restricted to APP_URL — no wildcard origin
□ No stack traces in production responses
□ Debug endpoints behind import.meta.env.DEV
```

### A06 — Vulnerable Components
```
□ npm audit — no high/critical vulnerabilities
□ Stripe SDK on latest stable version
```

### A07 — Authentication Failures
```
□ Magic link: single use, TTL ≤ 15 min, never logged
□ SAML: ACS URL validated, audience restriction active
□ OAuth PKCE: code_verifier/challenge correct
□ Session tokens: HttpOnly cookie or Bearer — never localStorage
□ Admin bootstrap: ADMIN_BOOTSTRAP_SECRET required
```

### A08 — Data Integrity Failures
```
□ Stripe webhooks: signature verification before processing
□ KV writes after D1 writes: compensating rollback on KV failure
□ DO state: never written from REST — always via WebSocket
□ DRAFT→LIVE: atomic transition — no half-started sessions
```

### A09 — Logging & Monitoring
```
□ All catch blocks: logError() (not console.error)
□ No PII in log lines
□ waitUntil() tasks: tracked() wrapper
□ Admin audit log updated on critical actions
```

### A10 — SSRF
```
□ No fetch() with user input as URL without whitelist
□ OAuth redirect_uri: validated against allowed list exactly
```

## STRIDE (per new route or changed DO handler)

| Threat | Question | Mitigation |
|---|---|---|
| Spoofing | Can attacker impersonate another user? | authMiddleware + ownership check |
| Tampering | Can attacker modify unauthorized data? | Input validation + ownership check |
| Repudiation | Can action be denied later? | Audit log |
| Info Disclosure | Does response leak other users' data? | Response filtering + ownership check |
| Denial of Service | Can one user take down service? | Rate limiting + DO memory caps |
| Elevation of Privilege | Can viewer do presenter actions? | Role check in DO + API middleware |

## Qesto-Specific Checks

**Stripe:** Never process raw event without `constructEvent()`. Plan upgrades via webhook only — never client claim. Price IDs hardcoded in `wrangler.toml [vars]`.

**SAML:** IdP metadata only updatable by team owner/admin. Certificate expiry checked.

**GDPR:** Consent log: timestamp + IP hash at sign-up. Anonymisation mode: AI always uses anonymised answers. Right to erasure cascades to decisions/actions.

**DO/WS:** voterId validated on connection (not just upgrade). Presenter actions check `role === 'presenter'` in DO. No unbounded growth of ipVotes/fpVotes maps.

## Severity & Action

| Severity | Examples | Action |
|---|---|---|
| **Critical** | Auth bypass, data theft, payment fraud | Blocks release — P0 in backlog, TC=13 |
| **High** | Privilege escalation, PII leak, CSRF | P0 next sprint |
| **Medium** | Missing rate limit, weak validation | P2/P3 with WSJF |
| **Low** | Best-practice deviation | Backlog note |

Add findings to `docs/BACKLOG.md §1` (P0) or `§4 Security` (ARCH-xxx). Check `docs/BACKLOG.md` for current open vulnerabilities.

## Quality Gates
- [ ] All relevant OWASP items checked (A01–A10)
- [ ] STRIDE applied to new/changed routes and DO handlers
- [ ] Severity classified using the table above
- [ ] Critical findings block release; others map to backlog with due-date
- [ ] `npm audit` clean (no high/critical)

## Output Contract
Security audit report with:
- List of findings per OWASP category
- STRIDE analysis per changed endpoint
- Severity level + action per finding
- Backlog ticket ID (if Critical/High)
- Release gate decision: APPROVED / BLOCKED / CONDITIONAL

## Docs to Update
- `docs/BACKLOG.md` for new vulnerabilities (§1 for P0, §4 for planned fixes)
- `docs/SECURITY_RELEASES.md` for post-release incident notes
- Agent changelog (this file) when new threat patterns discovered

## Do Not
- Do not approve critical security findings — always block and escalate
- Do not skip STRIPE/SAML/GDPR sections for those features
- Do not recommend design changes — propose implementation fixes only
- Do not log PII, secrets, or sensitive data in your audit report (sanitize examples)
- Do not merge without running `npm audit` clean
- Do not defer critical findings to "post-launch" — fix before release

## Metrics
- Critical/High findings caught pre-release (target: 100%)
- Time-to-remediation per severity level
- Audit report completeness (all 10 OWASP areas + STRIDE covered)
- Release gate accuracy (zero missed vulnerabilities post-launch)
