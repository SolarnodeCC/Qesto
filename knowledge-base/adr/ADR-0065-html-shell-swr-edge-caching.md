---
id: ADR-0065
status: accepted
created: 2026-06-17
accepted: 2026-06-17
deciders: devops, architect, frontend
relates_to: BACKLOG_MASTER, SPEC_DEPLOYMENT, SPEC_FRONTEND
---

# ADR-0065: Short-TTL / Stale-While-Revalidate Edge Caching for the HTML Shell

## Status

Accepted (2026-06-17). Implements the deferred HTML-TTFB follow-up documented in
PR #554. Frontend/devops change only — touches `public/_headers`; no schema, no API,
no deploy-pipeline change.

## Context

PR #552 and PR #554 attacked the home-page LCP. DevTools Live Metrics field data on
`qesto.cc/?lang=nl` showed the LCP element (a hero sub-headline `<p>`, a text block —
both resource-load phases 0 ms) split as:

| Phase | Time | Share |
|---|---|---|
| Time to first byte | 1,382 ms | 36% |
| **Element render delay** | **2,506 ms** | **64%** |

PR #554 removed the 2.5s render-delay (blocking `await initI18n()` fetch waterfall) by
bundling English and rendering non-blocking. That leaves the **~1.4s TTFB** as the next
lever.

The TTFB cause: `public/_headers` served the HTML shell (`/*`) with
`Cache-Control: no-cache, no-store, must-revalidate`, so **every** shell request — for
every SPA route, all of which serve the same `index.html` — bypasses the Cloudflare edge
and hits the Pages Functions origin. Only the Vite content-hashed `/assets/*` and
`/chunks/*` were edge-cacheable (`immutable`).

PR #554 flagged a short-TTL / stale-while-revalidate (SWR) policy as the fix but noted it
"interacts with the deploy commit-parity check, so it needs a devops/architecture
decision." This ADR records that decision.

## Decision

Replace the HTML-shell `Cache-Control` (`/*` block in `public/_headers`) with:

```
Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=86400
```

- **`s-maxage=60`** — the Cloudflare edge serves `index.html` for up to 60s without an
  origin round-trip. This is the actual TTFB lever: warm edge hits return in single-digit
  ms instead of the ~1.4s origin path.
- **`max-age=0`** — browsers revalidate the shell on every load, so client-side staleness
  stays effectively zero. (The edge revalidation is the cache; the browser is not.)
- **`stale-while-revalidate=86400`** — the edge may serve a stale shell while revalidating
  in the background, bounding tail latency rather than blocking on a cold origin fetch.

All other `/*` security headers (HSTS, CSP, X-Frame-Options, COOP, Referrer-Policy,
Permissions-Policy) are unchanged. The `/display/*`, `/assets/*`, and `/chunks/*` rules
are unchanged (immutable asset caching already correct; later-rule-wins ordering
preserved).

## Why this is safe against the deploy commit-parity check

The deploy pipeline (`.github/workflows/ci.yml`): build → `wrangler pages deploy dist`
(with `COMMIT_SHA`) → `purge_everything` on the zone → `node scripts/verify-deploy.mjs`.
Two gates were the concern; both were traced and neither touches cached HTML:

1. **Commit-parity gate** (`verify-deploy.mjs` Step 1) fetches `/api/version` — a Hono
   **JSON API route** — and compares its `commit` (from `c.env.COMMIT_SHA`) against the
   local git SHA. It never requests the static HTML shell, so SWR on the shell cannot
   affect it.
2. **Asset-MIME gate** (Step 2) reads the **local** freshly-built `dist/index.html` on the
   CI runner to learn which hashed asset URLs to HEAD-check on production. It never fetches
   production's HTML either.

Edge vs. browser cache is the key distinction:

- The **edge** cache (what `s-maxage` populates) is **cleared by `purge_everything`** on
  every deploy, so the post-deploy edge-staleness window resets to ~empty and self-heals.
- The **browser** cache is never cleared by `purge_everything` — but `max-age=0` keeps the
  browser revalidating, so a user never holds a stale shell beyond one revalidation.

The only correctness hazard a stale shell could pose is referencing **old** content-hashed
asset filenames after a new deploy. This cannot 404: `index.html` is not itself
content-hashed, and Cloudflare Pages retains prior-deployment `/assets/*` and `/chunks/*`
(the premise of `immutable` caching), so an old shell's asset references keep resolving.

**No change is required** to `scripts/verify-deploy.mjs`, the `purge_everything` step, or
`.github/workflows/ci.yml`.

## Consequences

- **Positive:** warm edge hits eliminate the ~1.4s origin round-trip for the shell across
  all SPA routes; lower Pages Functions origin load.
- **Residual risk:** up to ~60s of edge staleness if traffic resumes immediately after a
  deploy (before the purged edge cache repopulates). Bounded, self-healing, and with no
  asset-404 failure mode given Pages' asset retention.
- **Verification:** post-deploy spot-check `curl -sI https://qesto.cc/ | grep -i
  cf-cache-status` for one release cycle to confirm the edge caches the shell (`HIT` after
  warm-up). Informational, non-blocking.

## Alternatives considered

- **`s-maxage=300`** — larger TTFB win / lower origin load, but a ~5min staleness window if
  a deploy's purge were ever skipped. Rejected as too aggressive for the shell.
- **`s-maxage=30` / `swr=3600`** — most conservative, smaller window but more origin
  revalidation and less TTFB benefit. Rejected in favour of the balanced 60s window.
- **Keep `no-store`** — status quo; leaves the 1.4s TTFB unaddressed. Rejected.
