# Help Assistant Vectorize Index Setup

## Issue
PR #220 deployment fails because the `qesto-help` Vectorize index doesn't exist in the Cloudflare account yet.

**Error:**
```
Vectorize binding 'HELP_VECTORIZE' references index 'qesto-help' which was not found.
```

## Solution

### Step 1: Create the Vectorize Index

Use the Cloudflare API to create the `qesto-help` index:

```bash
# Create the Vectorize index for help documents
curl -X POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/vectorize/indexes \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "qesto-help",
    "description": "Help assistant knowledge base documents",
    "config": {
      "dimensions": 768,
      "metric": "cosine"
    }
  }'
```

**Parameters:**
- `{ACCOUNT_ID}`: Your Cloudflare account ID (from wrangler.toml: `5546763229b35df670e33d9316d7f2e0`)
- `{API_TOKEN}`: Your Cloudflare API token (from dashboard)
- `dimensions`: 768 (matches bge-m3 embedding model)
- `metric`: cosine (similarity metric for vector search)

**Expected Response:**
```json
{
  "success": true,
  "result": {
    "id": "abc123def456...",
    "name": "qesto-help",
    "created_on": "2026-05-13T19:30:00Z",
    "description": "Help assistant knowledge base documents"
  }
}
```

### Step 2: Uncomment the Binding in wrangler.toml

Once the index exists, uncomment the binding:

```toml
[[vectorize]]
binding = "HELP_VECTORIZE"
index_name = "qesto-help"
```

### Step 3: Make HELP_VECTORIZE Required Again

Update `functions/api/types.ts` to mark HELP_VECTORIZE as required:

```typescript
HELP_VECTORIZE: VectorizeIndex  // Remove the ? optional marker
```

### Step 4: Deploy

Deploy the worker:

```bash
npm run deploy:api
```

### Step 5: Seed the Knowledge Base

Populate the index with help documents:

```bash
# Run once per deployment
node scripts/seed-help-docs.mjs
```

This will:
1. Read 15 help documents from `functions/api/seed/help-documents.json`
2. Embed each with bge-m3 (768d vectors)
3. Insert documents into D1 `help_documents` table
4. Upsert vectors into `qesto-help` Vectorize index

---

## Current Workaround

For now, PR #220 has:
- ✅ Commented out the `HELP_VECTORIZE` binding in `wrangler.toml`
- ✅ Made `HELP_VECTORIZE` optional in `functions/api/types.ts` (marked with `?`)
- ✅ Updated help routes to check for binding before use

This allows deployment to succeed without the index existing.

**To complete deployment:**
1. Create the `qesto-help` index via Cloudflare API
2. Uncomment the binding
3. Make the type required again
4. Re-deploy

---

## Verification

Once deployed and seeded, verify the index:

```bash
# Test embedding and search
curl -X POST https://qesto.cc/api/help/ask \
  -H "Authorization: Bearer <token>" \
  -d '{"question": "How do I create a session?"}'

# Expected: 200 OK with answer + sources from knowledge base
```

---

## References

- [Cloudflare Vectorize API Docs](https://developers.cloudflare.com/vectorize/get-started/)
- [bge-m3 Model Specs](https://huggingface.co/BAAI/bge-m3) (768 dimensions)
- [Seed Script](../functions/api/lib/seed-help.ts)
