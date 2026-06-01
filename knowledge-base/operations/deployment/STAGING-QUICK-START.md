# 🚀 Staging Environment Setup — Quick Start

**Estimated Time:** ~45 minutes  
**Target:** DevOps / Infrastructure Lead  
**Status:** Ready to provision

---

## Two Approaches

### **Approach 1: Automated (Recommended)**
Run the provisioning script to automate most of the work:

```bash
bash scripts/provision-staging.sh
```

**What it does:**
- ✅ Creates D1 database (qesto-staging)
- ✅ Applies all schema migrations
- ✅ Creates 9 KV namespaces
- ✅ Prompts for secret injection (Stripe + Resend)
- ✅ Verifies staging configuration
- ✅ Outputs resource IDs for wrangler.toml

**Time:** ~30 minutes

---

### **Approach 2: Manual (Full Control)**
Follow the detailed guide for step-by-step manual provisioning:

```bash
# See STAGING-PROVISIONING-GUIDE.md in this folder for complete instructions
```

**What you do manually:**
1. Create D1 database via Cloudflare dashboard or `wrangler d1 create`
2. Apply schema migrations manually
3. Create KV namespaces manually
4. Inject secrets via `wrangler pages secret put`
5. Update wrangler.toml with all resource IDs
6. Verify connectivity with provided commands

**Time:** ~45 minutes

---

## Prerequisites

Before starting, have these ready:

- ✅ `wrangler` CLI installed (`npm install -g wrangler`)
- ✅ Cloudflare account authenticated (`wrangler login`)
- ✅ Stripe test API keys (from https://dashboard.stripe.com/test/keys)
- ✅ Resend test API key (from https://resend.com/dashboard/api-keys)
- ✅ Git repository cloned and on `claude/plan-roadmap-sprints-FcRjL` branch

---

## Quick Summary

| Phase | What | Time |
|---|---|---|
| **1** | D1 database creation + migrations | 10 min |
| **2** | KV namespace creation | 15 min |
| **3** | Secret injection (Stripe + Resend) | 5 min |
| **4** | wrangler.toml configuration | 10 min |
| **5** | Verification | 5 min |
| **6** | Commit changes | 5 min |
| **TOTAL** | — | **~45 min** |

---

## After Provisioning

### ✅ Step 1: Verify IDs Were Captured

```bash
# The automation script will save IDs to:
cat /tmp/qesto_staging_db_id.txt
cat /tmp/qesto_staging_kv_ids.txt
```

### ✅ Step 2: Update wrangler.toml

Open `wrangler.toml` and find the `[env.staging]` section. Uncomment and populate:

```toml
[env.staging.d1_databases]
binding = "DB"
database_name = "qesto-staging"
database_id = "PASTE_DB_ID_HERE"

[[env.staging.kv_namespaces]]
binding = "SESSIONS_KV"
id = "PASTE_KV_ID_HERE"

# ... repeat for all 9 KV namespaces (USERS, TEAMS, TEMPLATES, DECISIONS, AUDIT, CIRCUIT_BREAKER, INTEGRATIONS, METRICS)
```

### ✅ Step 3: Commit Changes

```bash
git add wrangler.toml
git commit -m "infra: populate staging D1 and KV bindings with resource IDs"
git push origin claude/plan-roadmap-sprints-FcRjL
```

### ✅ Step 4: Deploy to Staging (Optional)

```bash
wrangler pages deploy dist --env staging --project-name=qesto
```

### ✅ Step 5: Verify Staging is Live

```bash
curl https://staging.qesto.cc/api/version
# Expected: { "version": "2.2.0", "commit": "...", "timestamp": "..." }
```

---

## What Gets Provisioned

### D1 Database
- `qesto-staging` — Full production schema + v2.2 additions
- Includes: sessions, questions, votes, users, teams, audit_events, recaps, custom_roles

### KV Namespaces (9)
| Name | Purpose |
|---|---|
| SESSIONS_KV | Session state cache |
| USERS_KV | User profile cache |
| TEAMS_KV | Team metadata cache |
| TEMPLATES_KV | Template cache |
| DECISIONS_KV | Decision/analytics cache |
| AUDIT_KV | Audit log staging |
| **CIRCUIT_BREAKER_KV** | Circuit breaker state (v2.2) |
| **INTEGRATIONS_KV** | Integration token storage (v2.2) |
| METRICS_KV | Live metrics snapshots |

### Secrets
| Secret | Used For |
|---|---|
| STRIPE_SECRET_KEY | Billing API calls |
| STRIPE_PUBLISHABLE_KEY | Frontend checkout |
| STRIPE_STARTER_MONTHLY_PRICE_ID | Product pricing |
| RESEND_API_KEY | Email delivery |

---

## Troubleshooting

### "Database already exists"
```bash
# That's OK! You can use the existing database.
# Get its ID:
wrangler d1 list | grep "qesto-staging"
```

### "KV namespace limit reached"
```bash
# Check your quota:
wrangler kv:namespace list

# If at limit, delete unused namespaces first:
wrangler kv:namespace delete --namespace-id <ID>
```

### "wrangler not authenticated"
```bash
# Login to Cloudflare:
wrangler login
```

### "Secrets not working"
```bash
# Secrets take 1-2 minutes to propagate; wait and retry.
# Cannot view secrets via wrangler, but deployment will error if missing.
wrangler pages secret put STRIPE_SECRET_KEY --env staging  # Retry
```

### "D1 query timeout"
```bash
# D1 can be slow on first access; retry after 10 seconds:
wrangler d1 execute qesto-staging --remote --command "SELECT 1"
```

**More details:** See [STAGING-PROVISIONING-GUIDE.md](./STAGING-PROVISIONING-GUIDE.md) → Troubleshooting section

---

## Documentation References

| Document | Purpose |
|---|---|
| **STAGING-PROVISIONING-GUIDE.md** | Complete manual + troubleshooting |
| **scripts/provision-staging.sh** | Automated provisioning script |
| **INFRA-SPRINT-20-CHECKLIST.md** | DevOps pre-work checklist |
| **EPIC-ROADMAP-V2.2-VALIDATED.md** | Full roadmap & sprint breakdown |
| **wrangler.toml** | Configuration file (update with IDs) |

---

## Next: Sprint 21 Feature Work

Once staging is ready:

1. **Deploy to staging** (optional validation):
   ```bash
   wrangler pages deploy dist --env staging --project-name=qesto
   ```

2. **Start Sprint 21 work:**
   - AUDIT-TIMEOUT (8 pts) — Timeout on external fetch calls
   - AUDIT-RETRY (8 pts) — Bounded retry with jitter
   - EXPORT-JSON (5 pts) — Session results export
   - AI-PROV-METADATA (5 pts) — Recap metadata schema

   See `docs/EPIC-ROADMAP-V2.2-VALIDATED.md` for full Sprint 21 breakdown.

---

## Questions?

- **Script not working?** → Check prerequisites, see Troubleshooting section above
- **Manual setup?** → Follow [STAGING-PROVISIONING-GUIDE.md](./STAGING-PROVISIONING-GUIDE.md) step-by-step
- **Confused about resource IDs?** → They're printed/saved during provisioning; see guide Phase 4
- **wrangler errors?** → Ensure `wrangler --version` is recent (`npm install -g wrangler@latest`)

---

**Status:** Ready to provision  
**Branch:** `claude/plan-roadmap-sprints-FcRjL`  
**Commit:** Latest includes Sprint 20 pre-work code + this provisioning guide  
**Estimated Completion:** ~45 minutes from now → Sprint 21 ready
