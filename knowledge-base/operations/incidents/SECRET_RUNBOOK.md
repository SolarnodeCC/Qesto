# Secret Governance Runbook (Sprint 18 - ID 24)

_Hub: [Documentation map](./README.md)._

Emergency procedures for managing secret leaks, rotations, and access control.

---

## 🚨 INCIDENT: Secret Leaked in Git Commit

**Time to respond:** < 5 minutes

### Phase 1: Immediate Containment

```bash
# Step 1: Identify what was leaked
git log -p | grep -i "api_key\|password\|secret" | head -20

# Step 2: Identify which commits contain the secret
git log -S "LEAKED_SECRET_VALUE" --oneline

# Step 3: IMMEDIATELY revoke the secret in the service
# - Go to Stripe/Resend/Slack dashboard
# - Find the API key/secret
# - Click "Revoke" or "Delete"
# - Confirm revocation
```

### Phase 2: Generate Replacement

```bash
# Step 1: Create new secret in service provider
# (see docs/SECRET_ROTATION_POLICY.md for each service)

# Step 2: Test the new secret BEFORE deploying
# (see "Verify Deployment" section)

# Step 3: Update Cloudflare secret
wrangler pages secret put STRIPE_SECRET_KEY
# (paste new key, press Ctrl+D to finish)

# Step 4: Verify new secret is active
curl -H "Authorization: Bearer $(wrangler pages secret list)" \
  https://api.stripe.com/v1/balance
```

### Phase 3: Remove from Git History

```bash
# WARNING: This rewrites git history. Coordinate with team.

# Option A: Remove file from history
git filter-branch --tree-filter 'rm -f .env' HEAD

# Option B: Remove specific lines from history
git filter-branch --tree-filter 'sed -i "/sk_live_/d" wrangler.toml' HEAD

# Step 1: Remove from repository
git filter-branch --force --index-filter \
  'git rm -r --cached --ignore-unmatch wrangler.toml' \
  HEAD

# Step 2: Force push to remote (after team coordination)
git push origin -f --all
git push origin -f --tags

# Step 3: Notify all developers
# "Git history was rewritten. Pull latest and run: git reset --hard origin/main"
```

### Phase 4: Audit & Prevention

```bash
# Check if secret was used from git history
git log --all -p | grep -c "sk_live_12345"

# Review CloudFlare logs for unauthorized access
# (via Cloudflare Dashboard → Logs)

# Check which commits accessed the secret
git log --author="*" --since="2024-01-01" | grep "SECRET"

# Add to CI gate to prevent future leaks
# (see .github/workflows/secret-scan.yml)
```

### Phase 5: Notification

**Send to #security:**
```
🚨 INCIDENT: Secret Leaked in Git Commit

**Secret:** STRIPE_SECRET_KEY
**Leaked at:** 2024-04-11 14:30 UTC
**Exposed for:** ~20 minutes
**Status:** REVOKED & REPLACED

**Actions Taken:**
- Old key revoked in Stripe dashboard ✓
- New key generated & deployed ✓
- Removed from git history ✓
- Logs reviewed (no unauthorized access) ✓

**Root Cause:** Accidental commit of wrangler.toml

**Prevention:** CI gate now blocks Stripe keys in commits
```

---

## 🔄 ROTATION: Scheduled Secret Rotation

**Time required:** ~10 minutes per secret

### Stripe Secret Key (90-day rotation)

```bash
# Step 1: Create new key in Stripe dashboard
# - Go to Stripe → Developers → API Keys
# - Click "Create restricted key" 
# - Copy the new sk_live_xxxx key

# Step 2: Test new key locally
STRIPE_SECRET_KEY="sk_live_xxxx" npm test

# Step 3: Update in Cloudflare
wrangler pages secret put STRIPE_SECRET_KEY
# (paste: sk_live_xxxx, then Ctrl+D)

# Step 4: Verify in production (wait 2 min for deployment)
curl -H "Authorization: Bearer sk_live_xxxx" \
  https://api.stripe.com/v1/balance

# Step 5: Revoke old key in Stripe
# - Go to Stripe → Developers → API Keys → Old key
# - Click three dots → "Revoke"

# Step 6: Log rotation
echo "$(date -Iseconds) | STRIPE_SECRET_KEY | rotated | user:$(whoami) | status:success" \
  >> ROTATION_AUDIT.log
```

### JWT Secret (90-day rotation)

```bash
# Step 1: Generate new JWT secret (64 random bytes, base64-encoded)
openssl rand -base64 64

# Step 2: Update in Cloudflare
wrangler pages secret put JWT_SECRET
# (paste the new secret, Ctrl+D)

# Step 3: Verify JWT tokens still validate
npm run test:auth

# Step 4: Log rotation
echo "$(date -Iseconds) | JWT_SECRET | rotated | user:$(whoami) | status:success" \
  >> ROTATION_AUDIT.log

# NOTE: Old JWT tokens (issued before rotation) will be invalid
# after the grace period (see auth.ts JWT_EXPIRY). Consider:
# - If rotating JWT_SECRET, all active sessions are invalidated
# - Users will need to re-login
# - Plan rotation during low-traffic window
```

### OAuth Client Secrets (180-day rotation)

```bash
# Step 1: Rotate each OAuth provider (Slack, Zoom, Teams, etc.)
# Example for Slack:
# - Go to Slack API → Your Apps → App Name
# - Under "Credentials", click "Rotate" for Client Secret
# - Copy new client secret

# Step 2: Update all OAuth secrets
wrangler pages secret put SLACK_CLIENT_SECRET
wrangler pages secret put ZOOM_CLIENT_SECRET
wrangler pages secret put TEAMS_CLIENT_SECRET
wrangler pages secret put WEBEX_CLIENT_SECRET

# Step 3: Test OAuth flow
npm run test:oauth

# Step 4: Log all rotations
echo "$(date -Iseconds) | SLACK_CLIENT_SECRET | rotated | user:$(whoami) | status:success" >> ROTATION_AUDIT.log
echo "$(date -Iseconds) | ZOOM_CLIENT_SECRET | rotated | user:$(whoami) | status:success" >> ROTATION_AUDIT.log
# ... (repeat for each secret)
```

---

## 🔍 INVESTIGATION: Secret Access Audit

Check who accessed what secrets and when.

```bash
# Via secretGuard audit log
import { getSecretAuditLog } from '@/middleware/secretGuard'

// Get all secret accesses in the last 24 hours
const logs = getSecretAuditLog({
  since: new Date(Date.now() - 24 * 60 * 60 * 1000)
})

console.log(`Secret accesses (last 24h): ${logs.length}`)
logs.forEach(log => {
  console.log(`${log.timestamp} | ${log.secretName} | ${log.action} | ${log.accessor}`)
})

// Get rotations for STRIPE_SECRET_KEY
const stripeLogs = getSecretAuditLog({
  secretName: 'STRIPE_SECRET_KEY',
  action: 'rotate'
})

console.log(`STRIPE_SECRET_KEY rotations:`)
stripeLogs.forEach(log => {
  console.log(`${log.timestamp} | rotated by ${log.accessor}`)
})
```

---

## 🛡️ PREVENTION: CI Secret Scanning

The CI gate (`.github/workflows/secret-scan.yml`) automatically detects hardcoded secrets.

**To test locally:**

```bash
# Simulate secret detection
./scripts/detect-secrets.sh

# Output example:
# ❌ FAIL: Stripe API keys found in source code
# ❌ FAIL: Resend API key hardcoded
# ✅ PASS: No hardcoded secrets detected
```

**To bypass (NEVER in production):**

```bash
# If false positive, add to .gitleaks.toml
# (ask #security before bypassing)
git-secrets --register-aws
```

---

## 📋 COMPLIANCE: Audit Trail

Keep this file updated whenever secrets are rotated or accessed.

```
ROTATION_AUDIT.log:

2024-04-11T14:30:00Z | STRIPE_SECRET_KEY | rotated | user:alice | status:success
2024-04-11T14:35:00Z | JWT_SECRET | rotated | user:bob | status:success
2024-04-11T14:40:00Z | SLACK_CLIENT_SECRET | rotated | user:alice | status:success
2024-04-11T14:45:00Z | ZOOM_CLIENT_SECRET | rotated | user:bob | status:success
2024-04-11T14:50:00Z | TEAMS_CLIENT_SECRET | rotated | user:alice | status:success
2024-04-11T14:55:00Z | WEBEX_CLIENT_SECRET | rotated | user:bob | status:success

[Monthly Review: 6 secrets rotated, 0 incidents, CI gate: 100% pass rate]
```

---

## 📞 Escalation Contacts

**Secret Leak (Security Issue):**
- Immediate: Slack #security (thread with incident details)
- Notify: Security Lead (@sec-lead)
- Document: Create GitHub issue `[SECURITY] Secret Leak`

**Rotation Questions:**
- Engineering Lead: @eng-lead
- DevOps: @devops
- Ask in #infrastructure

**Compliance/Audit:**
- Security Team: #security
- Compliance Officer: @compliance

---

## 🧪 Testing

Test the secret governance setup:

```bash
# Test 1: Verify CI gate catches hardcoded secrets
echo 'STRIPE_SECRET_KEY="sk_live_TEST123"' >> wrangler.toml
git add wrangler.toml
git commit -m "test: hardcoded secret"
git push origin feature-branch
# Expected: CI fails with "FAIL: Stripe API keys found"

# Test 2: Verify secret rotation works
wrangler pages secret put TEST_SECRET
# (paste: test_value_123)
# Check: Secret is deployed and accessible

# Test 3: Verify secret redaction
import { redactSecret } from '@/middleware/secretGuard'
const redacted = redactSecret("Authorization: Bearer sk_live_123")
console.log(redacted) // "Authorization: Bearer ***REDACTED***"

# Test 4: Verify audit logging
import { logSecretAccess } from '@/middleware/secretGuard'
logSecretAccess({
  timestamp: new Date().toISOString(),
  secretName: 'TEST_SECRET',
  accessor: 'test-user',
  action: 'read',
  status: 'success'
})
```

---

## 📚 References

- **Cloudflare Secrets:** https://developers.cloudflare.com/workers/configuration/secrets/
- **OWASP Secret Management:** https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- **git-filter-branch:** https://git-scm.com/docs/git-filter-branch
- **Emergency Key Revocation:** See specific service providers (Stripe, Slack, etc.)
