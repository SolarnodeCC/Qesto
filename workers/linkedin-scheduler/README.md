# Qesto LinkedIn Auto-Posting

Cloudflare-native LinkedIn posting for the Qesto company page. No external tools.

| Piece | Location |
|---|---|
| One-time OAuth connect page | `functions/linkedin-auth.ts` → `https://qesto.cc/linkedin-auth` |
| Cron Worker (Tue + Thu 09:00 UTC) | `workers/linkedin-scheduler/` |
| Shared helpers | `functions/api/lib/linkedin.ts` |
| Encrypted token storage | `functions/api/lib/integrations/token-store.ts` (`getStoredToken`) |
| Post log table | `migrations/0064_linkedin_posts.sql` (`linkedin_posts`) |

Tokens are stored **encrypted** (AES-GCM via `OAUTH_TOKEN_MEK`) under
`integration:token:qesto-org:linkedin`. Non-secret config lives as plain
`LINKEDIN_KV` keys: `linkedin:org_urn`, `linkedin:person_urn`,
`linkedin:topics` (JSON array), `linkedin:topic_index`, `linkedin:language`.

Posts are generated in **English by default**; change the language at any time
without redeploying by setting `linkedin:language` (`en`, `nl`, `es`, `de`, `fr`).

---

## Setup (one time)

### 1. Create the LinkedIn app
1. Go to <https://www.linkedin.com/developers/apps> → **Create app**.
2. Associate it with the **Qesto company page**, then **verify** the app
   (Settings tab → a Page admin approves) — required before org products unlock.
3. Under **Products**, request:
   - **Sign In with LinkedIn using OpenID Connect** — grants `openid profile email`
     (authentication + person id). Self-serve.
   - **Community Management API** — grants `w_organization_social`,
     `r_organization_social`, `rw_organization_admin` (post to / read the company
     page). **Not self-serve**: requires app verification and an access request /
     approval. This is the product that enables company-page posting — without it
     you can sign in but cannot post as the organization.
   - Do **not** use "Share on LinkedIn" — it only grants `w_member_social`
     (personal-feed posts), not company-page posts.
4. Copy the **Client ID** and **Client Secret** from the **Auth** tab.

Effective scopes requested by the connect page:
`w_organization_social r_organization_social rw_organization_admin openid profile`.

### 2. Redirect URI
On the app's **Auth** tab, add an **Authorized redirect URL**:
```
https://qesto.cc/linkedin-auth
```
Use this exact value for `LINKEDIN_REDIRECT_URI`.

### 3. Provision Cloudflare resources
The KV namespaces already exist (wired into `wrangler.toml`):

| Namespace | ID | Used by |
|---|---|---|
| `Linkedin_KV_Prod` | `2385a9ede5974147bb15716dcc3b27a9` | production (default) |
| `Linkedin_KV_Staging` | `8c394153bb6f41e89990424209282dae` | `--env staging` |

Bind the **same** namespace to the `qesto` **Pages** project under the binding
name `LINKEDIN_KV` (dashboard → Settings → Functions → KV namespace bindings —
use `Linkedin_KV_Prod` for production).

```bash
# D1 migration (creates linkedin_posts)
wrangler d1 migrations apply qesto_3_db        # remote (add --local for dev)
```

### 4. Secrets
Set on **both** the Pages project and the cron Worker. `OAUTH_TOKEN_MEK` **must
be identical** in both places (the page encrypts the token; the Worker decrypts it).

```bash
# Pages project "qesto"
wrangler pages secret put LINKEDIN_CLIENT_ID     --project-name qesto
wrangler pages secret put LINKEDIN_CLIENT_SECRET --project-name qesto
wrangler pages secret put LINKEDIN_REDIRECT_URI  --project-name qesto   # https://qesto.cc/linkedin-auth
wrangler pages secret put OAUTH_TOKEN_MEK        --project-name qesto   # if not already set
# (optional) wrangler pages secret put LINKEDIN_ORG_URN --project-name qesto

# Cron Worker (run inside workers/linkedin-scheduler/)
wrangler secret put LINKEDIN_CLIENT_ID
wrangler secret put LINKEDIN_CLIENT_SECRET
wrangler secret put OAUTH_TOKEN_MEK              # same value as Pages
```

### 5. Seed topics (optional — defaults to a built-in list)
```bash
wrangler kv key put --binding LINKEDIN_KV linkedin:topics \
  '["team engagement","remote meetings","quiz tools for HR"]'
# Optional: switch language later
wrangler kv key put --binding LINKEDIN_KV linkedin:language en
```

### 6. Run the OAuth flow once
1. Deploy the frontend so `/linkedin-auth` is live (`npm run deploy:frontend`).
2. Visit <https://qesto.cc/linkedin-auth> → **Connect LinkedIn** → approve.
3. The success page confirms the stored Person/Org URNs.
   - If the Org URN couldn't be read automatically (the two requested scopes can
     *post* but reading the org ACL list needs a broader org-admin scope), set it
     manually:
     ```bash
     wrangler kv key put --binding LINKEDIN_KV linkedin:org_urn urn:li:organization:<ID>
     ```

### 7. Deploy the cron Worker
```bash
cd workers/linkedin-scheduler
wrangler deploy
```

---

## Operating

- **Schedule:** Tue & Thu 09:00 UTC (`crons` in `wrangler.toml`).
- **Token refresh:** automatic when the access token is within 7 days of expiry.
  Re-run the OAuth flow only when the **refresh token** expires (~365 days).
- **Inspect logs:**
  ```bash
  wrangler d1 execute qesto_3_db --command \
    "SELECT posted_at, status, substr(content,1,80) FROM linkedin_posts ORDER BY posted_at DESC LIMIT 10"
  ```
- **Health check (read-only, no post):** `GET` the Worker URL → JSON with
  `connected`, `org_urn`, `token_expires_at`.
- **Manual cron test (dev):** `wrangler dev --test-scheduled` then hit
  `http://localhost:8787/__scheduled?cron=0+9+*+*+2`.

## Error handling
Any non-2xx from LinkedIn (or a failed refresh / AI generation) writes one
`linkedin_posts` row with `status='error'` and the detail in `content`. There is
**no in-run retry** — the next scheduled cron tries again. The topic index only
advances after a successful publish.
