# Growth Engine Sprint 1 — Provisioning & E2E Testing Guide

**Status**: Code merged to branch, ready for infrastructure setup  
**Date**: May 22, 2026  
**Environments**: Staging → Production

---

## Phase 1: Infrastructure Provisioning

### Step 1: Provision Webhook Secret

The `/api/webhooks/marketing` endpoint validates HMAC signatures using `MARKETING_WEBHOOK_SECRET`.

**Generate secret (local machine):**
```bash
openssl rand -hex 32
# Output: a1b2c3d4e5f6...
```

**Add to Cloudflare secrets:**
```bash
# Production
echo "YOUR_SECRET_HERE" | wrangler secret put MARKETING_WEBHOOK_SECRET
```

**Verify:**
```bash
wrangler secret list
# Both environments should show MARKETING_WEBHOOK_SECRET
```

---

### Step 2: Apply D1 Migration

The migration adds `is_public` column to sessions table.

**Production:**
```bash
wrangler d1 migrations apply qesto_3_db

# ⚠️ This is PRODUCTION — verify carefully before running
# Migration should be backward-compatible (adds column with DEFAULT 1)
```

**Verify:**
```bash
wrangler d1 execute qesto_3_db \
  "SELECT name FROM pragma_table_info('sessions') WHERE name='is_public';"

# Should return: is_public
```

---

### Step 3: Deploy Updated Worker Code

The code includes:
- `/api/webhooks/marketing` endpoint (receives session.closed events)
- `/api/templates/*` endpoints (gallery, detail, use template, store)
- `SessionWizard` toggle for "Include in template gallery"
- `deliverMarketingWebhook()` called on session close

**Deploy:**
```bash
# Build frontend
npm run build

# Deploy to Cloudflare Pages (includes Worker functions)
wrangler pages deploy dist
```

**Verify endpoints exist:**
```bash
curl https://qesto.cc/api/templates -i
# Should return 200 with {"ok":true,"data":[],...}

curl -X POST https://qesto.cc/api/webhooks/marketing -i
# Should return 401 (missing signature)
```

---

## Phase 2: Manual E2E Testing Checklist

### Environment: Production

---

### Test 1: Session Creation with is_public Toggle

**Steps:**
1. Go to the frontend: https://qesto.cc
2. Create new session → Step 1: Title + Goal
3. Step 2: Add questions (any method)
4. Step 3: Skip energizers
5. Step 4: **Verify toggle** "Include in template gallery" appears
   - ✅ Toggle is checked by default (is_public=true)
   - ✅ Text says "Include in template gallery"
   - ✅ Can toggle it off
6. Step 5: Review + Launch

**Verification:**
```bash
# Check session is_public flag in D1
wrangler d1 execute qesto_3_db \
  "SELECT id, is_public FROM sessions WHERE status='draft' ORDER BY created_at DESC LIMIT 1;"

# Should show: is_public = 1
```

---

### Test 2: Session Close & Webhook Trigger

**Steps:**
1. Complete a session (as host, run it live, close it)
2. Call close endpoint:
   ```bash
   curl -X POST https://qesto.cc/api/sessions/{SESSION_ID}/close \
     -H "Authorization: Bearer {MAGIC_LINK_JWT}" \
     -H "Content-Type: application/json"
   ```
3. Verify response: `{ "ok": true, "data": { "session": {...} } }`

**Verification — Check Worker logs:**
```bash
wrangler tail

# Should see:
# - event: webhook.marketing.skipped_no_secret (if secret not set)
# - OR event: workflow.queued (if workflow triggered)
# - OR event: workflow.not_available (if WORKFLOWS binding not configured)
```

---

### Test 3: Template Gallery Page

**Steps:**
1. Go to: https://qesto.cc/templates
2. **Verify page loads** (no auth required)
   - ✅ Responsive grid visible
   - ✅ Filter dropdowns: Industry, Theme, Language
   - ✅ Template cards show: title, purpose, question count, industry badge

**If templates exist in KV:**
3. Click a template card → goes to `/templates/{id}`
4. Verify detail page:
   - ✅ Back link works
   - ✅ Title, purpose, metadata visible
   - ✅ Questions list visible
   - ✅ "Use this template" button visible
   - ✅ Right-side sticky card shows metadata

---

### Test 4: Magic Link Flow

**Steps:**
1. On template detail page, click "Use this template"
2. **Verify modal appears**:
   - ✅ Magic link displayed
   - ✅ "Copy link" button works (shows "Copied!" feedback)
   - ✅ "Open session" button opens new tab
   - ✅ Message: "Expires in 1 hour"

**Join session via magic link:**
3. Copy the magic link
4. Open in new incognito window (no auth)
5. **Verify anonymous session loads**:
   - ✅ Questions from template pre-populated
   - ✅ Can participate in session (no login required)

---

### Test 5: i18n (Language Switching)

**Test all 5 languages:**
- EN (English)
- NL (Dutch)
- DE (German)
- FR (French)
- ES (Spanish)

**Verify gallery page** (`/templates`):
- ✅ All UI text translates correctly
- ✅ Filter labels change
- ✅ Template cards show translated content (title, purpose)

---

### Test 6: Accessibility (WCAG 2.1 AA)

**Keyboard navigation:**
- Tab through filters, cards, buttons
- ✅ All interactive elements reachable
- ✅ Focus visible (outline)
- ✅ No keyboard traps

**Automated check (Lighthouse):**
```bash
# Chrome DevTools → Lighthouse → Accessibility
# Target: Score ≥ 90, no critical issues
```

---

### Test 7: Mobile Responsiveness

**Viewport: 375px (iPhone SE)**
- ✅ Gallery grid collapses to 1 column
- ✅ All text readable (no horizontal scroll)
- ✅ Buttons tappable (≥44px height)

**Viewport: 768px (Tablet)**
- ✅ Gallery grid shows 2 columns

**Viewport: 1024px+ (Desktop)**
- ✅ Gallery grid shows 3 columns

---

### Test 8: Performance

**Steps:**
1. Open `/templates` in production
2. **Measure load time:**
   - ✅ DOMContentLoaded < 1.5s
   - ✅ Fully Loaded < 2.5s
   - ✅ No CLS (layout shift)

---

### Test 9: Error Cases

**9a: Invalid template ID**
- Go to: `https://qesto.cc/templates/tmpl_invalid123`
- ✅ Page shows "Template not found" message

**9b: Webhook signature mismatch**
- Send POST to `/api/webhooks/marketing` with invalid signature
- ✅ Response: 401 Unauthorized
- ✅ No workflow triggered

---

### Test 10: Dark Mode

1. Set system to dark mode
2. Open `/templates` gallery
   - ✅ Cards readable (contrast ≥ 4.5:1)
   - ✅ Text colors adjust
3. Open template detail page
   - ✅ Sticky CTA card visible and readable

---

### Test 11: Private Session Exclusion

1. Create session with toggle **OFF** ("Do not include in template gallery")
   - ✅ Webhook NOT triggered on close
   - ✅ No template stored in MARKETING_KV

---

### Test 12: Browser Compatibility

**Test on:**
- ✅ Chrome 125+
- ✅ Firefox 124+
- ✅ Safari 17+
- ✅ Edge 125+

---

## Phase 3: Post-Testing Checklist

- [ ] All 12 test phases passed in production
- [ ] No console errors or warnings
- [ ] Analytics events fire correctly (`event: webhook.marketing.*`)
- [ ] MARKETING_KV has ≥ 5 templates (if workflow is active)
- [ ] i18n strings complete for all 5 languages
- [ ] Performance benchmarks met (< 2s load on gallery)
- [ ] Accessibility audit passed (Lighthouse ≥ 90)
- [ ] Mobile responsive on 3 breakpoints

---

## Phase 4: Production Deployment

Once all staging tests pass:

1. **Apply D1 migration to production:**
   ```bash
   wrangler d1 migrations apply qesto_3_db
   ```

2. **Deploy to production:**
   ```bash
   npm run build
   wrangler pages deploy dist
   ```

3. **Monitor production:**
   ```bash
   wrangler tail  # (no --env = production)
   
   # Watch for:
   # - webhook.marketing.skipped_no_secret (if secret missing)
   # - webhook.marketing.delivery_failed (if delivery fails)
   # - Any other errors
   ```

---

## Troubleshooting

### Issue: Webhook signature validation fails

**Error:** 401 Invalid signature

**Fix:**
1. Verify the signing key is configured: `wrangler secret list | grep MARKETING`
2. Verify the sender reads the same binding: `deliverMarketingWebhook` uses `env.MARKETING_WEBHOOK_SECRET`
3. Check logs: `wrangler tail | grep webhook.marketing`

---

### Issue: Workflow not triggering

**Note**: Cloudflare Workflows (`[[workflows]]` binding) requires a `WorkflowEntrypoint` class.  
This is not yet implemented. The webhook endpoint logs `workflow.not_available` gracefully.

To fully implement:
1. Create a class extending `WorkflowEntrypoint` in `worker/`
2. Uncomment `[[workflows]]` binding in `wrangler.toml`
3. The `sessionPipelineWorkflow` function in `lib/workflows/session-pipeline.ts` can be called from the class's `run()` method

---

### Issue: Templates not appearing in gallery

**Error:** `/api/templates` returns empty list

**Fix:**
1. Check if templates were manually seeded: `wrangler kv:key list --namespace-id {ID} --prefix template:`
2. Check indices: `wrangler kv:key get --namespace-id {ID} templates:index`
3. Try seeding a test template via the POST /api/templates endpoint (requires JWT_SECRET bearer token)

---

## Success Criteria (Sprint 1 Complete)

✅ Public session marked `is_public=true`, completed → webhook fires  
✅ Magic link flow: < 10 second response time  
✅ Gallery loads with filters (industry/theme/language)  
✅ All 5 languages render correctly  
✅ Mobile responsive (1/2/3 columns)  
✅ Accessibility audit passed (WCAG 2.1 AA)  
✅ Performance < 2s on load  
✅ Privacy: No PII in webhooks or KV storage  

---

## Next Steps (Sprint 2+)

- [ ] WorkflowEntrypoint class implementation for template generation pipeline
- [ ] Blog engine (scheduled content generation)
- [ ] SEO landing pages by industry/theme
- [ ] Email notifications (session completion → template published)
- [ ] Template popularity ranking
- [ ] Analytics dashboard for growth metrics
