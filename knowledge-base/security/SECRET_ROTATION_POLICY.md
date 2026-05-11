---
id: SECURITY-SECRET_ROTATION_POLICY
type: security
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - security
  - compliance
  - policy
  - gdpr
relates_to:
  - SECURITY_FULL
---

# Secret Rotation Policy (Sprint 18 - ID 24)

_Hub: [Documentation map](./README.md)._

## Overview

This policy ensures cryptographic secrets (API keys, database passwords, signing keys, OAuth tokens) are rotated regularly to minimize blast radius if a secret is compromised.

---

## Secret Categories & Rotation Schedule

### High-Risk Secrets (90-day rotation)
**Compromise Impact:** High (financial, data access, authentication breach)

| Secret | Service | Rotation Schedule | Owner |
|--------|---------|-------------------|-------|
| `STRIPE_SECRET_KEY` | Stripe | 90 days | Finance Lead |
| `STRIPE_WEBHOOK_SECRET` | Stripe | 90 days | Finance Lead |
| `JWT_SECRET` | Authentication | 90 days | Security Team |
| `ADMIN_SECRET` | Admin API | 90 days | Engineering Lead |
| `RESEND_API_KEY` | Email Service | 90 days | Engineering |

### Medium-Risk Secrets (180-day rotation)
**Compromise Impact:** Medium (service-specific, limited scope)

| Secret | Service | Rotation Schedule | Owner |
|--------|---------|-------------------|-------|
| `SLACK_CLIENT_SECRET` | Slack Integration | 180 days | DevOps |
| `ZOOM_CLIENT_SECRET` | Zoom Integration | 180 days | Engineering |
| `TEAMS_CLIENT_SECRET` | Teams Integration | 180 days | Engineering |
| `WEBEX_CLIENT_SECRET` | Webex Integration | 180 days | Engineering |

### Low-Risk Secrets (Annual rotation)
**Compromise Impact:** Low (public-facing, revocable)

| Secret | Service | Rotation Schedule | Owner |
|--------|---------|-------------------|-------|
| `SAML_IDP_CERT` | SAML SSO | Annually | Security |
| `SAML_ENTITY_ID` | SAML SSO | Annually | Security |

---

## Rotation Workflow

### Step 1: Generate New Secret
In your service provider's dashboard (Stripe, Resend, Slack, etc.):
1. Navigate to API/Keys/Settings section
2. Create new API key
3. **Do NOT delete old key yet**
4. Test new key before rotation

### Step 2: Update Cloudflare Secrets

```bash
# Update secret via CLI
wrangler pages secret put SECRET_NAME < new_key_file

# Verify update (secret is encrypted, you'll see ✓ confirmation)
wrangler pages secret list

# Rollback in emergency (old key still active in service)
wrangler pages secret put SECRET_NAME < old_key_file
```

**No downtime:** Secrets are updated instantly across all Workers.

### Step 3: Verify Deployment

```bash
# Check that your Workers are using the new secret
# by making test API calls to the service:

# For Stripe:
curl -H "Authorization: Bearer $STRIPE_SECRET_KEY" https://api.stripe.com/v1/balance

# For Resend:
curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/emails

# For Slack:
curl -H "Content-Type: application/x-www-form-urlencoded" \
  -d "token=$SLACK_CLIENT_SECRET" \
  https://slack.com/api/auth.test
```

### Step 4: Deactivate Old Secret

Once new secret is confirmed working:
1. In service provider dashboard, **revoke/deactivate old key**
2. Document the rotation in CHANGELOG
3. Add audit log entry (see below)

### Step 5: Document Rotation

```bash
# Add audit log entry
cat >> ROTATION_AUDIT.log <<EOF
$(date -Iseconds) | STRIPE_SECRET_KEY | rotated | user:$(whoami) | status:success
EOF
```

---

## Emergency Key Revocation

**If a secret is compromised:**

### Immediate Actions (within 5 minutes)
1. **Revoke the secret** in the service provider dashboard
2. **Generate new secret** immediately
3. **Update in Cloudflare:** `wrangler pages secret put SECRET_NAME < new_key`
4. **Verify** the new secret is working (step 3 above)
5. **Notify:** Slack #security channel with incident details

### Post-Incident (within 24 hours)
1. **Root cause analysis:** How was the secret exposed?
   - Leaked in git?
   - Exposed in logs?
   - Exposed in error messages?
   - Exposed via API response?

2. **Remediation:**
   - Remove secret from git history (if applicable): `git filter-branch`
   - Redact from logs (via secretGuard middleware)
   - Redact from error messages
   - Review access logs (who accessed the secret?)

3. **Post-Mortem:** Document incident in #security and add prevention

---

## Rotation Calendar

**First Monday of each quarter:**
- High-risk secrets (STRIPE_SECRET_KEY, JWT_SECRET, ADMIN_SECRET, RESEND_API_KEY)

**First Monday of January & July:**
- Medium-risk secrets (OAuth client secrets)

**First Monday of January:**
- Low-risk secrets (SAML certificates)

---

## Secret Storage Best Practices

### ✅ DO
- Store secrets in **Cloudflare Workers Secrets** (encrypted at rest)
- Use `wrangler pages secret put` (CLI, never in code)
- Rotate on schedule (90/180/365 days)
- Log access via `secretGuard.logSecretAccess()`
- Audit logs stored in D1 (encrypted, audit trail)
- Use separate secrets for each environment (dev/staging/production)

### ❌ DON'T
- Hardcode secrets in code (wrangler.toml, .env files, comments)
- Commit secrets to git (even accidentally)
- Share secrets in Slack/email/chat
- Use same secret across environments
- Log secret values (use `secretGuard.redactSecret()`)
- Include secrets in error messages (use `secretGuard.createSafeError()`)

---

## Monitoring & Alerts

### Secret Rotation Reminders

Set calendar reminders:
```bash
# For Stripe secret (90-day)
- Every 70 days: "Start Stripe rotation process"
- Every 75 days: "Test new Stripe key"
- Every 85 days: "Rotate Stripe secret in Cloudflare"
- Every 90 days: "Revoke old Stripe key"
```

### Secret Access Audit

Review secret access logs weekly:
```bash
# Via secretGuard audit log
const logs = getSecretAuditLog({ action: 'read' })
console.log(`This week: ${logs.length} secret reads`)
```

### Automated Alerts

⚠️ TODO: Set up Cloudflare Workers Analytics to alert on:
- Unusual secret access patterns
- Failed authentication (invalid secret)
- Rate limit errors on API calls (expired secret?)

---

## Compliance Checklist

- [ ] All secrets stored in Cloudflare Workers Secrets (0 in code)
- [ ] High-risk secrets rotated every 90 days
- [ ] Medium-risk secrets rotated every 180 days
- [ ] Low-risk secrets rotated annually
- [ ] Rotation log maintained (ROTATION_AUDIT.log)
- [ ] Secret access logged via `secretGuard.logSecretAccess()`
- [ ] Emergency revocation runbook tested (quarterly)
- [ ] No secrets in git history (verified via CI gate)
- [ ] No secrets in logs (redacted via `secretGuard.redactSecret()`)
- [ ] No secrets in error messages (redacted via `secretGuard.createSafeError()`)

---

## References

- **Cloudflare Workers Secrets:** https://developers.cloudflare.com/workers/configuration/secrets/
- **OWASP Secret Management:** https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- **CWE-798: Hardcoded Credentials:** https://cwe.mitre.org/data/definitions/798.html
