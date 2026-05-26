#!/usr/bin/env bash
# L3 Hook: PreToolUse(Bash) — Safety gate for shell commands
# Blocks destructive and dangerous commands before execution.

CMD="$1"

# ── Blocked patterns ──────────────────────────────────────────────────────────

# Block force-push to main/master
if echo "$CMD" | grep -qE "git push.*(--force|-f).*(main|master)"; then
  echo "BLOCKED: Force-push to main/master is not allowed." >&2
  exit 1
fi

# Block wrangler secret put with inline value (secrets must come from stdin or CI)
if echo "$CMD" | grep -qE "wrangler.*secret.*put.*="; then
  echo "BLOCKED: Do not pass secret values inline. Use: echo \$SECRET | wrangler pages secret put KEY" >&2
  exit 1
fi

# Block wrangler.toml edits that add API keys inline
if echo "$CMD" | grep -qE "(ANTHROPIC_API_KEY|OPENAI_API_KEY|RESEND_API_KEY|STRIPE_SECRET).*=.*sk-"; then
  echo "BLOCKED: Secret key detected in command. Use 'wrangler pages secret put' instead." >&2
  exit 1
fi

# Block direct D1 prod DB drops/truncates without explicit confirmation
if echo "$CMD" | grep -qiE "wrangler d1 execute.*(DROP TABLE|TRUNCATE|DELETE FROM)"; then
  echo "BLOCKED: Destructive D1 operation requires explicit user approval. Ask user first." >&2
  exit 1
fi

# Block rm -rf on source directories (including variants like rm -rf -- src/)
if echo "$CMD" | grep -qE "rm\s+-rf(\s+--)?\s+.*\b(src|functions|worker|tests|\.claude)(/|\b)"; then
  echo "BLOCKED: Cannot rm -rf source directories." >&2
  exit 1
fi

# Block skipping git hooks — explicit pattern only
if echo "$CMD" | grep -qE "git\s+(commit|rebase|push).*--no-verify"; then
  echo "BLOCKED: Do not skip git hooks (--no-verify). Fix the underlying issue instead." >&2
  exit 1
fi

# Block git reset --hard completely — use safer alternatives
if echo "$CMD" | grep -qE "git reset --hard"; then
  echo "BLOCKED: git reset --hard is destructive. Use safer alternatives:" >&2
  echo "  • To discard all changes: git stash" >&2
  echo "  • To restore specific files: git checkout HEAD -- path/to/file" >&2
  echo "  • To undo commits: git revert <commit>" >&2
  exit 1
fi

# Block git clean -f (deletes untracked files)
if echo "$CMD" | grep -qE "git clean -[a-z]*f"; then
  echo "BLOCKED: git clean -f permanently deletes untracked files. Use git status first." >&2
  exit 1
fi

# Block force-push to any branch (non-main) without warning context
if echo "$CMD" | grep -qE "git push.*(--force-with-lease|--force|-f)" && ! echo "$CMD" | grep -qE "(main|master)"; then
  echo "BLOCKED: Force-push detected. Confirm branch name and that no colleagues share this branch." >&2
  exit 1
fi

# Block wrangler secret put without piping (avoids accidental overwrite prompt)
if echo "$CMD" | grep -qE "wrangler pages secret put [A-Z_]+" && ! echo "$CMD" | grep -q "|"; then
  echo "WARNING: wrangler pages secret put without piping a value — this will overwrite interactively. Use: echo \$VALUE | wrangler pages secret put KEY" >&2
fi

# ── Pre-commit validation gates ──────────────────────────────────────────────

# Block commit if tests are skipped
if echo "$CMD" | grep -q "git commit"; then
  if grep -r "it\.skip\|test\.skip\|describe\.skip" tests/ 2>/dev/null | grep -v node_modules; then
    echo "BLOCKED: Found skipped tests (it.skip, test.skip). Remove before commit." >&2
    exit 1
  fi
fi

# Block commit if console.log found in production code
if echo "$CMD" | grep -q "git commit"; then
  if grep -r "console\.log" src/ functions/api/ worker/ 2>/dev/null | grep -v "console\.error" | grep -v node_modules; then
    echo "WARNING: Found console.log in production code. Consider removing debug logs." >&2
  fi
fi

# ── Warnings (non-blocking) ───────────────────────────────────────────────────

# Warn on wrangler deploy without build
if echo "$CMD" | grep -q "wrangler pages deploy" && ! echo "$CMD" | grep -q "npm run build"; then
  echo "WARNING: Running wrangler deploy without npm run build. Ensure dist/ is up to date." >&2
fi

# Warn on npm install of new packages (may affect lock file)
if echo "$CMD" | grep -qE "npm install [^-]"; then
  echo "WARNING: Adding new dependency. Ensure it's compatible with Cloudflare Workers (no Node.js-only APIs)." >&2
fi

exit 0
