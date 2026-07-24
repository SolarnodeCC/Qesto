#!/usr/bin/env bash
# Serve the Vite build + Worker API for Playwright fullstack E2E.
#
# `wrangler pages dev` cannot host Durable Object / Workflow classes declared in
# wrangler.toml (Pages Functions bundles only export onRequest handlers), so the
# local server fails with:
#   "Durable Objects ... are not exported in your entrypoint file: SessionRoom"
#
# Instead we run the Worker entrypoint (worker/index.ts), which already exports
# SessionRoom + TemplateGenerationWorkflow, and overlay Workers Assets so SPA
# routes like /login serve dist/index.html while /api/* hits Hono.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d dist ]]; then
  echo "error: dist/ missing — run npm run build first" >&2
  exit 1
fi

# Generate a throwaway config: production wrangler.toml + Assets SPA overlay.
# Renamed so an accidental deploy cannot target production "qesto-api".
{
  sed 's/^name = "qesto-api"/name = "qesto-api-e2e"/' wrangler.toml
  cat <<'EOF'

# --- injected by scripts/e2e-serve-fullstack.sh (do not hand-edit) ---
[assets]
directory = "./dist"
not_found_handling = "single-page-application"
# Only API (and scheduled probe) should hit the User Worker first; everything
# else is served by the Asset Worker with SPA fallback to index.html.
run_worker_first = [
  "/api/*",
  "/cdn-cgi/*",
  "/sitemap-index.xml",
  "/sitemap-templates.xml",
  "/.well-known/*",
  "/indexnow.txt",
]
EOF
} > wrangler.e2e.toml

exec npx wrangler dev \
  -c wrangler.e2e.toml \
  --port 8788 \
  --local \
  --var JWT_SECRET:dev-secret \
  --var ENVIRONMENT:development \
  --var APP_URL:http://localhost:8788 \
  --no-show-interactive-dev-session
