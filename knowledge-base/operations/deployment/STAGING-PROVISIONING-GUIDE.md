# Staging Provisioning Guide — Sprint 20 Pre-Work

**Timeline:** ~45 minutes (15 min Cloudflare setup + 30 min configuration)  
**Prerequisites:** Cloudflare account access, `wrangler` CLI installed, git  
**Owner:** DevOps / Infrastructure Lead

---

## Phase 1: Cloudflare D1 Database Provisioning (10 min)

### Step 1.1: Create Staging D1 Database

```bash
# Create the staging D1 database
wrangler d1 create qesto-staging --use-remote

# Output will show:
# ✓ Created database qesto-staging
# [[d1_databases]]
# binding = "DB"
# database_name = "qesto-staging"
# database_id = "12345678-abcd-1234-abcd-1234567890ab"  # <-- SAVE THIS
```

**Save the `database_id` for later.**

### Step 1.2: Apply Migrations to Staging D1

```bash
# Apply all migrations to staging (0000_init through latest)
wrangler d1 migrations apply qesto-staging --remote

# Verify tables exist
wrangler d1 execute qesto-staging --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

# Expected output: sessions, questions, votes, users, teams, audit_events, recaps, custom_roles, etc.
```

### Step 1.3: Verify v2.2 Schema

```bash
# Verify v2.2 columns exist on recaps table
wrangler d1 execute qesto-staging --remote --command "PRAGMA table_info(recaps)"

# Expected: Should show format_version, ai_model_version, generated_at, evidence_json columns
```

---

## Phase 2: Cloudflare KV Namespace Provisioning (15 min)

### Step 2.1: Create All 9 KV Namespaces

Run this script to create all staging KV namespaces in one go:

```bash
#!/bin/bash
# Create staging KV namespaces for v2.2

NAMESPACES=(
  "SESSIONS_KV"
  "USERS_KV"
  "TEAMS_KV"
  "TEMPLATES_KV"
  "DECISIONS_KV"
  "AUDIT_KV"
  "CIRCUIT_BREAKER_KV"
  "INTEGRATIONS_KV"
  "METRICS_KV"
)

echo "Creating KV namespaces for staging..."
for ns in "${NAMESPACES[@]}"; do
  echo "Creating ${ns}..."
  wrangler kv:namespace create "${ns}_STAGING" --preview
done

echo "Done! Save the namespace IDs from the output above."
```

**Save ALL the namespace IDs that are printed** (format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### Step 2.2: Collect Namespace IDs

After running the script, create a temporary file with all the IDs:

```bash
# Copy the namespace IDs from the output above into this format:
cat > /tmp/kv_ids.txt << 'EOF'
SESSIONS_KV_STAGING_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
USERS_KV_STAGING_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TEAMS_KV_STAGING_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TEMPLATES_KV_STAGING_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DECISIONS_KV_STAGING_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUDIT_KV_STAGING_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CIRCUIT_BREAKER_KV_STAGING_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
INTEGRATIONS_KV_STAGING_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
METRICS_KV_STAGING_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EOF

# Source the IDs
source /tmp/kv_ids.txt
```

---

## Phase 3: Cloudflare Secrets Provisioning (5 min)

### Step 3.1: Provision Stripe Test Keys

1. **Get test keys from Stripe dashboard:**
   - Go to https://dashboard.stripe.com/test/keys
   - Copy the **Publishable Key** (format: `pk_test_...`)
   - Copy the **Secret Key** (format: `sk_test_...`)

2. **Inject as staging secrets:**

```bash
# Inject Stripe secret key (sensitive)
wrangler pages secret put STRIPE_SECRET_KEY --env staging
# Paste: sk_test_4eC39HqLyjWDarhtfr3SPGw (or your test key)

# Inject Stripe publishable key
wrangler pages secret put STRIPE_PUBLISHABLE_KEY --env staging
# Paste: pk_test_51I... (or your test key)

# Inject Stripe price IDs (get from Stripe dashboard → Products → Prices)
wrangler pages secret put STRIPE_STARTER_MONTHLY_PRICE_ID --env staging
# Paste: price_1ISsHr2eZvKYlo2C1p4jTuqa (or your test price ID)
```

### Step 3.2: Provision Resend Test API Key

1. **Get test key from Resend dashboard:**
   - Go to https://resend.com/dashboard/api-keys
   - Create or copy your test API key (format: `re_...`)

2. **Inject as staging secret:**

```bash
wrangler pages secret put RESEND_API_KEY --env staging
# Paste: re_test_abc123def456... (or your test key)
```

### Step 3.3: Verify Secrets Were Stored

```bash
# You cannot retrieve secrets, but you can verify they exist by attempting a deploy
# If secrets are missing, wrangler will error during deploy
echo "Secrets stored successfully (you cannot view them, but they exist in Cloudflare)"
```

---

## Phase 4: Update wrangler.toml with Resource IDs (10 min)

### Step 4.1: Uncomment and Populate Staging D1 Binding

```bash
# Open wrangler.toml and find the [env.staging] section
# Uncomment the D1 binding and paste your database_id:

# Before:
# [[env.staging.d1_databases]]
# binding = "DB"
# database_name = "qesto-staging"
# database_id = "PASTE_STAGING_D1_ID_HERE"

# After:
# [[env.staging.d1_databases]]
# binding = "DB"
# database_name = "qesto-staging"
# database_id = "12345678-abcd-1234-abcd-1234567890ab"
```

### Step 4.2: Uncomment and Populate Staging KV Bindings

```bash
# For each KV namespace, uncomment and paste the ID:

# Before:
# [[env.staging.kv_namespaces]]
# binding = "SESSIONS_KV"
# id = "PASTE_ID_HERE"

# After (example):
# [[env.staging.kv_namespaces]]
# binding = "SESSIONS_KV"
# id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Repeat for all 9 namespaces:
# - SESSIONS_KV
# - USERS_KV
# - TEAMS_KV
# - TEMPLATES_KV
# - DECISIONS_KV
# - AUDIT_KV
# - CIRCUIT_BREAKER_KV
# - INTEGRATIONS_KV
# - METRICS_KV
```

**Quick Script to Help:**

```bash
# Create a helper to replace placeholders (copy IDs from /tmp/kv_ids.txt above)
cat >> /tmp/update_wrangler.sh << 'EOF'
#!/bin/bash

# Use sed to replace IDs in wrangler.toml
# Format: sed -i 's/PLACEHOLDER/VALUE/g' file

# Example:
# sed -i 's/binding = "SESSIONS_KV".*/binding = "SESSIONS_KV"\nid = "SESSIONS_KV_STAGING_ID"/g' wrangler.toml
# (This is complex; manual editing is safer)

echo "Manual editing recommended for wrangler.toml"
echo "Open the file and paste IDs into each [[env.staging.kv_namespaces]] block"
EOF
```

**Recommended:** Manually open `wrangler.toml` and paste the IDs into each KV namespace block (safer than sed).

---

## Phase 5: Verify Staging Configuration (5 min)

### Step 5.1: Dry-Run Deploy to Staging

```bash
# This will validate the configuration without deploying
wrangler deploy --env staging --dry-run

# Expected output:
# ✓ Staging environment configured
# ✓ D1 binding present
# ✓ KV bindings present
# ✓ Secrets accessible
# ✓ Ready to deploy
```

### Step 5.2: Test D1 Connectivity

```bash
# Verify you can query the staging database
wrangler d1 execute qesto-staging --remote --command "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'"

# Expected output: table_count should be >10 (all tables created)
```

### Step 5.3: Test Feature Flags

```bash
# Verify staging environment variables are set
wrangler deploy --env staging --dry-run 2>&1 | grep -E "LIVE_ENERGIZERS_ENABLED|CIRCUIT_BREAKER_ENABLED|INTEGRATION_ENABLED"

# Expected output:
# LIVE_ENERGIZERS_ENABLED = "true"
# CIRCUIT_BREAKER_ENABLED = "true"
# INTEGRATION_ENABLED = "true"
```

---

## Phase 6: Final Verification Checklist

Run through this checklist to confirm everything is ready:

```bash
#!/bin/bash
# Staging Provisioning Verification Checklist

echo "=== Staging Provisioning Verification ==="
echo ""

# 1. Check D1 Database
echo "✓ D1 Database:"
wrangler d1 execute qesto-staging --remote --command "SELECT sqlite_version()" && echo "  D1 is responsive" || echo "  ✗ D1 connection failed"

# 2. Check KV Namespaces
echo ""
echo "✓ KV Namespaces:"
for ns in SESSIONS USERS TEAMS TEMPLATES DECISIONS AUDIT CIRCUIT_BREAKER INTEGRATIONS METRICS; do
  wrangler kv:key put --namespace-id <PASTE_KV_ID_HERE> "healthcheck" "ok" --path /tmp/kv_test 2>/dev/null && echo "  $ns: OK" || echo "  $ns: MISSING"
done

# 3. Check Secrets
echo ""
echo "✓ Secrets (cannot view, but verified by deployment):"
echo "  STRIPE_SECRET_KEY: Set"
echo "  STRIPE_PUBLISHABLE_KEY: Set"
echo "  RESEND_API_KEY: Set"

# 4. Check Staging Config
echo ""
echo "✓ Staging Configuration:"
grep -A 5 "\[env.staging\]" wrangler.toml | grep -q "database_id" && echo "  D1 binding configured" || echo "  ✗ D1 binding missing"
grep -c "binding = \".*_KV\"" wrangler.toml | grep -q "9" && echo "  KV bindings configured (9)" || echo "  ✗ KV bindings incomplete"

# 5. Schema Verification
echo ""
echo "✓ Database Schema:"
wrangler d1 execute qesto-staging --remote --command "PRAGMA table_info(recaps)" | grep -q "format_version" && echo "  v2.2 schema applied" || echo "  ✗ v2.2 schema missing"

echo ""
echo "=== Verification Complete ==="
```

---

## Troubleshooting

### **Problem: "Database already exists"**
```bash
# D1 databases are globally unique; use a different name or check if qesto-staging already exists
wrangler d1 list  # See all your D1 databases
```

### **Problem: "KV namespace creation failed"**
```bash
# Check quota: each Cloudflare account has a limit (usually 10-50 namespaces)
wrangler kv:namespace list
```

### **Problem: "Secrets not accessible during deploy"**
```bash
# Secrets take 1-2 minutes to propagate
# Wait 2 minutes and retry
wrangler pages secret put STRIPE_SECRET_KEY --env staging  # Retry
```

### **Problem: "D1 query timeout"**
```bash
# D1 can be slow on first access; retry
wrangler d1 execute qesto-staging --remote --command "SELECT 1"  # Retry after 10s
```

### **Problem: "wrangler.toml syntax error"**
```bash
# Validate the TOML file
npx toml-cli validate wrangler.toml

# Common issues:
# - Missing quotes around IDs
# - Incorrect indentation
# - Duplicate [[env.staging.kv_namespaces]] blocks
```

---

## Next Steps (After Provisioning)

Once staging is ready:

1. **Commit wrangler.toml changes:**
   ```bash
   git add wrangler.toml
   git commit -m "infra: populate staging D1 and KV bindings with resource IDs"
   git push origin claude/plan-roadmap-sprints-FcRjL
   ```

2. **Deploy to staging (optional, can wait for Sprint 21):**
   ```bash
   wrangler pages deploy dist --env staging --project-name=qesto
   ```

3. **Verify staging is live:**
   ```bash
   curl https://staging.qesto.cc/api/version
   # Expected: { "version": "2.2.0", "commit": "...", "timestamp": "..." }
   ```

4. **Begin Sprint 21 Feature Work:**
   - See `docs/EPIC-ROADMAP-V2.2-VALIDATED.md` for Sprint 21 sprint breakdown
   - Start with AUDIT-TIMEOUT (timeout on external fetch calls)

---

## Resource IDs Reference

**Save these securely (e.g., in a team wiki or password manager):**

| Resource | Environment | ID |
|---|---|---|
| D1 Database | staging | `_____________` |
| SESSIONS_KV | staging | `_____________` |
| USERS_KV | staging | `_____________` |
| TEAMS_KV | staging | `_____________` |
| TEMPLATES_KV | staging | `_____________` |
| DECISIONS_KV | staging | `_____________` |
| AUDIT_KV | staging | `_____________` |
| CIRCUIT_BREAKER_KV | staging | `_____________` |
| INTEGRATIONS_KV | staging | `_____________` |
| METRICS_KV | staging | `_____________` |

---

## Questions?

If you hit issues:
1. Check the **Troubleshooting** section above
2. Review `docs/INFRA-SPRINT-20-CHECKLIST.md` for detailed DevOps context
3. Verify wrangler CLI is up-to-date: `wrangler --version`
4. Check Cloudflare dashboard for resource status

**Estimated Total Time:** ~45 minutes (mostly waiting for Cloudflare propagation)  
**Success Indicator:** `wrangler d1 execute qesto-staging --remote --command "SELECT COUNT(*) FROM recaps"` returns 0 rows
