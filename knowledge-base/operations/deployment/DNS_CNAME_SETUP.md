# DNS CNAME Setup for Bing Webmaster Tools

**Domain:** qesto.cc  
**CNAME Name:** `2ed0cfe3bbef666e8427b895cc4859ce`  
**CNAME Value:** `verify.bing.com`  
**Purpose:** Bing Webmaster Tools domain verification

---

## Overview

You can verify your domain with Bing using one of three methods:

| Method | Difficulty | Speed | Notes |
|--------|-----------|-------|-------|
| **Meta Tag** (HTML) | ⭐ Easy | Instant | Already added to index.html ✅ |
| **CNAME Record** (DNS) | ⭐⭐ Medium | Instant | You are here → |
| **File Upload** (HTTP) | ⭐⭐⭐ Hard | Slow | Not recommended |

**We recommend using the Meta Tag (already done).** The CNAME is optional but provides an additional verification method.

---

## Add CNAME Record to Your DNS

### Step 1: Access Your DNS Provider

Choose your domain registrar/DNS provider:

<details>
<summary><b>Cloudflare</b> (if using Cloudflare DNS)</summary>

1. Log in to https://dash.cloudflare.com
2. Select your domain: **qesto.cc**
3. Go to **DNS** → **Records**
4. Click **+ Add Record**
5. Fill in:
   - **Type:** CNAME
   - **Name:** `2ed0cfe3bbef666e8427b895cc4859ce`
   - **Content (Target):** `verify.bing.com`
   - **TTL:** Auto (or 300)
   - **Proxy status:** DNS only (gray cloud)
6. Click **Save**
7. Wait 1-5 minutes for DNS propagation

</details>

<details>
<summary><b>GoDaddy</b></summary>

1. Log in to https://www.godaddy.com/
2. Go to **My Products** → **Domains**
3. Click on **qesto.cc** → **DNS**
4. Find the DNS records table
5. Click **Add** → **CNAME**
6. Fill in:
   - **Name:** `2ed0cfe3bbef666e8427b895cc4859ce`
   - **Value:** `verify.bing.com`
7. Click **Save**
8. Wait 1-48 hours for propagation

</details>

<details>
<summary><b>Namecheap</b></summary>

1. Log in to https://www.namecheap.com/
2. Go to **Domain List** → **qesto.cc** → **Manage**
3. Go to **Advanced DNS**
4. Click **+ Add New Record**
5. Fill in:
   - **Type:** CNAME Record
   - **Host:** `2ed0cfe3bbef666e8427b895cc4859ce`
   - **Value:** `verify.bing.com`
   - **TTL:** 30 min (or Auto)
6. Click **Save All Changes**
7. Wait 1-5 minutes

</details>

<details>
<summary><b>AWS Route 53</b></summary>

1. Log in to https://console.aws.amazon.com/route53/
2. Go to **Hosted Zones** → **qesto.cc**
3. Click **Create Record**
4. Fill in:
   - **Record name:** `2ed0cfe3bbef666e8427b895cc4859ce.qesto.cc`
   - **Record type:** CNAME
   - **Value:** `verify.bing.com`
   - **TTL:** 300
5. Click **Create Records**
6. Wait 1-5 minutes

</details>

<details>
<summary><b>Google Domains</b></summary>

1. Log in to https://domains.google.com/
2. Go to **qesto.cc** → **DNS**
3. Scroll to **Custom records**
4. Click **Create New Record**
5. Fill in:
   - **DNS record type:** CNAME
   - **DNS name:** `2ed0cfe3bbef666e8427b895cc4859ce`
   - **TTL:** 300
   - **Data:** `verify.bing.com`
6. Click **Create**
7. Wait 1-5 minutes

</details>

<details>
<summary><b>Other Registrars</b> (general instructions)</summary>

1. Log in to your registrar's control panel
2. Find **DNS Management** or **Name Server Management**
3. Look for **DNS Records** or **Zone File**
4. Click **Add Record** or **New Record**
5. Select **Type:** CNAME
6. Enter:
   - **Name/Host:** `2ed0cfe3bbef666e8427b895cc4859ce`
   - **Value/Target/Alias:** `verify.bing.com`
   - **TTL:** 300 or Auto (if available)
7. Save and wait for propagation (5 minutes to 48 hours)

</details>

---

## Step 2: Verify CNAME Record

After adding the record, verify it was added correctly:

```bash
# Using nslookup (Windows, macOS, Linux)
nslookup 2ed0cfe3bbef666e8427b895cc4859ce.qesto.cc

# Expected output:
# Server:  8.8.8.8
# Address: 8.8.8.8
# Name:    2ed0cfe3bbef666e8427b895cc4859ce.qesto.cc
# Aliases: verify.bing.com
```

Or use an online DNS checker:
- https://mxtoolbox.com/mxlookup.aspx
- https://www.nslookup.io/
- https://dnschecker.org/

**Search for:** `2ed0cfe3bbef666e8427b895cc4859ce.qesto.cc`

**Expected result:**
```
CNAME: verify.bing.com
```

---

## Step 3: Verify in Bing Webmaster Tools

1. Log in to https://www.bing.com/webmasters/
2. Go to your domain: **qesto.cc**
3. Go to **Settings** → **Verify your site**
4. Click **Verify with CNAME**
5. Bing will check for the CNAME record
6. If found → ✅ **Domain verified!**

---

## Troubleshooting

### CNAME Not Found

**Problem:** `nslookup` returns "can't find" error

**Causes:**
1. Record not yet saved (wait 5-15 minutes)
2. Wrong CNAME name (check spelling exactly)
3. Wrong CNAME value (should be `verify.bing.com` with period at end)
4. Cached DNS (try flushing DNS cache)

**Fixes:**
```bash
# Flush DNS cache (varies by OS)

# macOS
sudo dscacheutil -flushcache

# Windows (PowerShell as Admin)
ipconfig /flushdns

# Linux (if using systemd-resolved)
sudo systemctl restart systemd-resolved
```

### Still Not Working After 24 Hours

1. **Double-check the record:**
   - Name: `2ed0cfe3bbef666e8427b895cc4859ce` (no .qesto.cc at end)
   - Value: `verify.bing.com` (exact match)
   - Type: CNAME (not A, AAAA, or other)

2. **Check for conflicting records:**
   - Make sure no A, AAAA, or other record exists with the same name
   - Some registrars don't allow CNAME at subdomain if A record exists at root

3. **Contact your registrar:**
   - DNS changes can take up to 48 hours
   - Your registrar's support can force propagation

---

## Complete Domain Verification

You now have **two verification methods** active:

| Method | Status | Location |
|--------|--------|----------|
| **Meta Tag** | ✅ Done | `index.html` line 13 |
| **CNAME Record** | ⏳ Pending | DNS (you're setting this up) |

Once CNAME is verified, you can proceed to:
1. ✅ Submit sitemap to Bing
2. ✅ Monitor crawl stats
3. ✅ Check indexing status

---

## Reference

- **Bing Webmaster Tools:** https://www.bing.com/webmasters/
- **CNAME Record Spec:** https://en.wikipedia.org/wiki/CNAME_record
- **DNS Propagation Checker:** https://www.whatsmydns.net/

---

## Timeline

1. **Now:** Add CNAME record to your DNS provider
2. **5-30 minutes:** DNS propagates globally
3. **After propagation:** Verify with `nslookup` command
4. **Then:** Verify in Bing Webmaster Tools
5. **Finally:** Submit sitemap & monitor indexing

---

**Status:** ⏳ Awaiting manual DNS configuration  
**Next Step:** Add the CNAME record via your domain registrar

Once done, reply with confirmation and I can help verify!
