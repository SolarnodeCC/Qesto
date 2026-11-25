# SEO Wave 0 — DevOps checklist (outside-repo)

Companion to the Wave 0/1 code PR. These items cannot be completed from the
repository alone; they require Cloudflare Dashboard / secrets / Search Console.

| ID | Action | Where | Done when |
|---|---|---|---|
| **A1** | Allowlist verified **Googlebot** and **Bingbot** so Managed Challenge / Bot Fight does **not** serve the JS challenge (or `noindex` interstitial) to search crawlers | Cloudflare → Security → Bots / WAF | GSC URL Inspection “View crawled page” for `/` and `/sitemap.xml` shows real HTML/XML |
| **A1** | Optional WAF skip rule for `/sitemap.xml`, `/sitemap-templates.xml`, `/sitemap-index.xml`, `/robots.txt` | Cloudflare → WAF custom rules | `curl` from a non-browser client (or GSC) gets `Content-Type: application/xml` for sitemaps |
| **A6** | Set Pages secret `INDEXNOW_KEY` (and optional `INDEXNOW_KEY_FILE`) | `wrangler pages secret put INDEXNOW_KEY` | `GET https://qesto.cc/.well-known/indexnow` → `200` plaintext key |
| **A7** | Finish Google Search Console property verification (DNS or HTML meta token in `index.html`) | GSC + DNS / deploy | Property shows Verified |
| **G2** | Ensure Cloudflare AI Crawl Control injects **at most one** Managed robots block (live was duplicated) | Cloudflare → AI Crawl Control / robots | `curl https://qesto.cc/robots.txt` shows a single Managed section + custom rules |
| **G1** | Product/legal GEO decision: keep AI-bot Disallow **or** allow `Google-Extended` (and optionally GPTBot/ClaudeBot) on marketing paths | Product + Legal → then CF | Decision recorded; Wave 3 can proceed |
| **S1** | Publish ≥1 public marketing template (gallery is empty in prod → client `noindex` until populated) | Marketing ops + `POST /api/gallery/:id/publish` | `/templates` shows cards; `/sitemap-templates.xml` has `<url>` rows |

## Related code (this PR)

- Expanded `public/sitemap.xml` + `Sitemap:` → `sitemap-index.xml` in `public/robots.txt`
- HTML 404 (not JSON) for unknown paths via `injectNotFoundSeo`
- Edge JSON-LD / robots parity in `functions/seo-meta.ts`
- `/compare` + `/vs/{mentimeter,slido,parabol}` comparison pages + nav/footer links
- `public/llms.txt` for answer-engine citation hints
- Organization + WebSite JSON-LD graph in `index.html`

## Score path to “9/10”

Code in this PR can get classic SEO to ~8–8.5. Reaching **9** still requires the dashboard row for **A1** (search bots must fetch real HTML/XML) plus either publishing templates (**S1**) or accepting gallery noindex, and ideally allowing `Google-Extended` if GEO citations matter (**G1**).
