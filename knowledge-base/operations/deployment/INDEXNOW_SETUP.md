# IndexNow Configuration Guide — Qesto SEO

**Your IndexNow Key:** `e8964e65669d47a69dd02b32bfe2a64e`

---

## Overview

IndexNow allows search engines (Bing, Yahoo, Yandex) to be notified instantly when you publish new content. Qesto automatically sends IndexNow pings when templates are created.

Two hosting options supported:

| Option | Location | Setup Difficulty | Recommended |
|--------|----------|------------------|-------------|
| **Option 1** | `https://qesto.cc/e8964e65669d47a69dd02b32bfe2a64e.txt` | ⭐ Easy (static file) | ✅ Yes |
| **Option 2** | `https://qesto.cc/indexnow.txt` (or `/.well-known/indexnow`) | ⭐⭐ Medium (API endpoint) | Fallback |

---

## Setup: Option 1 (Recommended)

**Status:** ✅ Already configured for you

### What's Done
1. ✅ Static key file created at `/public/e8964e65669d47a69dd02b32bfe2a64e.txt`
2. ✅ Cloudflare will serve it automatically
3. ✅ Workflow configured to use this location

### To Deploy

```bash
# 1. Set the IndexNow key secret
wrangler secret put INDEXNOW_KEY
# Paste: e8964e65669d47a69dd02b32bfe2a64e

# 2. Set the key filename (for Option 1)
wrangler secret put INDEXNOW_KEY_FILE
# Paste: e8964e65669d47a69dd02b32bfe2a64e.txt

# 3. Deploy (the static file is part of /public)
npm run build
wrangler pages deploy dist
```

### Verify It Works

```bash
# Test the endpoint
curl https://qesto.cc/e8964e65669d47a69dd02b32bfe2a64e.txt
# Should return: e8964e65669d47a69dd02b32bfe2a64e

# Check the static file exists in Cloudflare Pages
# After deployment, visit the URL in browser
```

---

## Setup: Option 2 (Fallback)

If you prefer not to use a static file, the API endpoint also serves the key:

```bash
# Configure just the secret (no key filename)
wrangler secret put INDEXNOW_KEY
# Paste: e8964e65669d47a69dd02b32bfe2a64e

# Don't set INDEXNOW_KEY_FILE — workflow will default to Option 2
```

**Key will be served from:**
- `https://qesto.cc/indexnow.txt` (recommended)
- `https://qesto.cc/.well-known/indexnow` (standard)

---

## How It Works

### When a Template is Published

1. **Session closes** → Webhook triggered
2. **Template created** → Workflow runs (8 steps)
3. **Step 8: IndexNow Ping**
   - Reads `INDEXNOW_KEY` from env
   - Determines `keyLocation`:
     - If `INDEXNOW_KEY_FILE` set → `https://qesto.cc/{filename}`
     - Else → `https://qesto.cc/indexnow.txt`
   - Sends POST to `https://api.indexnow.org/indexnow` with:
     - `host`: qesto.cc
     - `key`: e8964e65669d47a69dd02b32bfe2a64e
     - `keyLocation`: [see above]
     - `urlList`: [template URL]

4. **Search engines notified** ✅
   - Bing/Yahoo crawl the URL immediately
   - Faster than sitemap-only crawling

### Logs

```
[workflow] IndexNow ping sent for template tmpl_abc123 {
  keyLocation: "https://qesto.cc/e8964e65669d47a69dd02b32bfe2a64e.txt"
}
```

---

## Verification Checklist

### Before Deployment

- [ ] Key file at `/public/e8964e65669d47a69dd02b32bfe2a64e.txt` contains the key
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors: `tsc --noEmit`
- [ ] Tests pass: `npm test`

### After Deployment

**Test Option 1 (static file):**
```bash
# Should return plain text (just the key, no markup)
curl -i https://qesto.cc/e8964e65669d47a69dd02b32bfe2a64e.txt

# Expected response:
# HTTP/1.1 200 OK
# Content-Type: text/plain; charset=utf-8
# e8964e65669d47a69dd02b32bfe2a64e
```

**Test Option 2 (API endpoint):**
```bash
curl -i https://qesto.cc/indexnow.txt
# Same response as above
```

**Test workflow logging:**
1. Create a public session in the UI
2. Add some questions, close the session
3. Check Cloudflare Workers logs:
   ```
   Cloudflare Dashboard → Workers → Qesto Project → Logs
   ```
4. Look for: `[workflow] IndexNow ping sent`

---

## Troubleshooting

### Key File Returns 404

**Problem:** `curl https://qesto.cc/e8964e65669d47a69dd02b32bfe2a64e.txt` returns 404

**Causes:**
1. File not deployed (check `/public/` exists in dist/)
2. Cloudflare Pages cache (try incognito or different IP)
3. Wrong key filename in env var

**Fix:**
```bash
# Verify file in build output
ls dist/e8964e65669d47a69dd02b32bfe2a64e.txt

# Re-deploy explicitly
npm run build
wrangler pages deploy dist
```

### IndexNow Ping Fails

**Problem:** Workflow logs show `[workflow] IndexNow ping failed`

**Causes:**
1. `INDEXNOW_KEY` not set (workflow skips silently)
2. Key file not accessible (Bing can't read keyLocation URL)
3. Network issue (usually transient, non-blocking)

**Fix:**
```bash
# Verify secret is set
wrangler secret list | grep INDEXNOW

# Verify key file is accessible
curl https://qesto.cc/e8964e65669d47a69dd02b32bfe2a64e.txt
```

### "IndexNow key not configured" in Logs

**Problem:** Workflow always shows this warning

**Fix:**
```bash
# Ensure INDEXNOW_KEY is set
wrangler secret put INDEXNOW_KEY
# Paste: e8964e65669d47a69dd02b32bfe2a64e

# Verify
wrangler secret list
```

---

## Advanced: Custom Key Location

If you want to serve the key from a different path:

```bash
# Set custom filename (e.g., /indexnow-key.txt)
wrangler secret put INDEXNOW_KEY_FILE
# Paste: indexnow-key.txt

# Create the file
echo 'e8964e65669d47a69dd02b32bfe2a64e' > public/indexnow-key.txt

# Deploy
npm run build
wrangler pages deploy dist
```

---

## References

- **IndexNow Spec:** https://www.indexnow.org/
- **Bing Webmaster Tools:** https://www.bing.com/webmasters/
- **IndexNow FAQ:** https://www.indexnow.org/faq
- **Qesto Code:** 
  - Workflow: `worker/TemplateGenerationWorkflow.ts` (Step 8)
  - API Routes: `functions/api/routes/seo-sitemap.ts`

---

## Timeline

1. **Now:** Deploy with both secrets set
2. **Day 1:** Verify key file is accessible
3. **Day 1+:** Close a public session in UI
4. **Day 1+:** Check workflow logs for IndexNow ping
5. **1-7 days:** Templates should appear in Bing search results
6. **Monthly:** Monitor Bing Webmaster Tools for crawl stats

---

**Status:** ✅ Ready to deploy

All code is in place. Just set the secrets and deploy!
