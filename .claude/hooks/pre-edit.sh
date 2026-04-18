#!/usr/bin/env bash
# L3 Hook: PreToolUse(Write|Edit) — Safety gate for file edits
# Blocks edits to protected files and detects secret patterns.

FILE="$1"

# ── Protected files ───────────────────────────────────────────────────────────

# Block edits to wrangler.toml that might add secrets
if [[ "$FILE" == *"wrangler.toml" ]] || [[ "$FILE" == *"wrangler.jsonc" ]]; then
  echo "WARNING: Editing wrangler config. Secrets must use 'wrangler pages secret put', not vars." >&2
  # Non-blocking — just warn
fi

# Block edits to CI/CD workflow files without notice
if [[ "$FILE" == *".github/workflows/"* ]]; then
  echo "WARNING: Editing CI/CD workflow. Verify this doesn't bypass test gates or deploy to wrong env." >&2
fi

# ── Secret pattern detection ──────────────────────────────────────────────────
# Will be checked on the file content via post-edit for written content.
# Pre-edit: check if path looks like an env file being created
if [[ "$FILE" == *".env"* ]] && [[ "$FILE" != *".env.example"* ]]; then
  echo "BLOCKED: Do not write .env files to the repository. Use 'wrangler pages secret put' for secrets." >&2
  exit 1
fi

# Block writing directly to node_modules
if [[ "$FILE" == *"node_modules/"* ]]; then
  echo "BLOCKED: Cannot edit files inside node_modules." >&2
  exit 1
fi

exit 0
