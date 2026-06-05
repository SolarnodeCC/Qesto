---
id: VECTORIZE-DIM-FIX-2026-06
type: runbook
domain: infrastructure
status: accepted
version: 1.0
owner: DevOps / Knowledge Lead
title: Vectorize dimension fix — qesto-help & qesto-decisions (768 → 1024)
tags: [vectorize, embeddings, bge-m3, help, insights, runbook]
relates_to: [KB_SYNC_PHASE5_ENHANCEMENTS, AGENT_SYSTEM_OVERVIEW]
---

# Vectorize dimension fix — qesto-help & qesto-decisions (768 → 1024)

## Problem
`qesto-help` and `qesto-decisions` were created as **768-dim** indexes, and their
code declared `HELP_EMBED_DIM = 768` / `DECISIONS_EMBED_DIM = 768`. But both embed
with **`@cf/baai/bge-m3`, which outputs 1024-dim vectors**. Effects:

- `firstVector()` / `firstEmbedding()` reject every embedding (`length !== 768`),
  so help-assistant and decision-similarity search **silently returned zero
  results** (fail-closed — no error surfaced).
- `scripts/sync-help-docs.ts` asserted `!== 768`, so a re-seed would throw
  `Expected 768-dim vector, got 1024` — the help index could never be seeded.

`qesto-kb-production` was already correct (1024, bge-m3) and is unaffected.

## Decision
Standardise on **bge-m3 / 1024** across all three indexes (multilingual — Qesto
supports EN/NL/ES/DE/FR — and consistent with the KB index).

## Code changes (already landed on the branch)
- `functions/api/lib/help-vectorize.ts` — `HELP_EMBED_DIM = 1024`
- `functions/api/lib/insights-vectorize.ts` — `DECISIONS_EMBED_DIM = 1024`
- `scripts/sync-help-docs.ts` — assert 1024
- `scripts/kb-health.ts` — assert 1024 for all three indexes (catches this class of bug)
- Docs/skills updated to 1024d

## Operator runbook (destructive — do in this order)
Vectorize indexes cannot be re-dimensioned in place; they must be recreated.
Run **before/at deploy** of the code above. Between recreation and re-seed the
features return empty results (same as today), so there is no regression window.

```bash
# 1. Recreate qesto-help at 1024 dims
wrangler vectorize delete qesto-help
wrangler vectorize create qesto-help --dimensions=1024 --metric=cosine

# 2. Recreate qesto-decisions at 1024 dims
wrangler vectorize delete qesto-decisions
wrangler vectorize create qesto-decisions --dimensions=1024 --metric=cosine

# 3. Deploy the code (HELP_EMBED_DIM / DECISIONS_EMBED_DIM = 1024)

# 4. Re-seed help docs (embeds with bge-m3 → 1024, upserts to the new index)
export CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=...
npm run help:sync

# 5. Verify
export CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=...
npm run kb:health   # qesto-help & qesto-decisions should now report 1024 dims, non-empty
```

Notes:
- **qesto-decisions** repopulates from live session insights (the insights pipeline
  upserts on session close). If a historical backfill is required, run the decisions
  reindex path; otherwise it fills forward.
- If `qesto-decisions` does not exist in the account yet, step 2's `delete` will no-op —
  just run the `create`.
- `npm run kb:health` now hard-fails on any index whose dimensions ≠ 1024, so this
  bug cannot silently return.

## Change log
- 2026-06-04: v1.0 — documented the 768→1024 fix and recreation runbook.
