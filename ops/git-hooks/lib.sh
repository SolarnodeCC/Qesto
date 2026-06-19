#!/bin/bash
# ops/git-hooks/lib.sh — Shared helpers for git hooks (source from pre-push, etc.)

# ─── Repo root (hooksPath runs with cwd = repo root on Git ≥2.36; guard older Git) ───

hook_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

hook_cd_repo_root() {
  local root
  root="$(hook_repo_root)" || {
    echo "pre-push: not inside a git repository" >&2
    return 1
  }
  cd "$root" || return 1
}

# ─── Pre-push stdin: collect changed file paths for outgoing pack ───────────────────

hook_collect_pushed_files() {
  # Usage: hook_collect_pushed_files >file_list.tmp
  # Writes one path per line (deduplicated) to stdout.
  local local_ref local_sha remote_ref remote_sha
  local -A seen=()
  local default_branch
  default_branch="$(git symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo main)"

  while read -r local_ref local_sha remote_ref remote_sha; do
    # Skip branch deletes
    if [ "$local_sha" = "0000000000000000000000000000000000000000" ]; then
      continue
    fi

    local range=""
    if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
      # New branch on remote — diff from merge-base with default branch
      local base
      base="$(git merge-base "origin/${default_branch}" "$local_sha" 2>/dev/null || true)"
      if [ -z "$base" ]; then
        base="$(git merge-base "${default_branch}" "$local_sha" 2>/dev/null || true)"
      fi
      if [ -z "$base" ]; then
        base="$(git hash-object -t tree /dev/null)"
      fi
      range="${base}..${local_sha}"
    else
      range="${remote_sha}..${local_sha}"
    fi

    local path
    while IFS= read -r path; do
      [ -n "$path" ] || continue
      if [ -z "${seen[$path]+x}" ]; then
        seen[$path]=1
        printf '%s\n' "$path"
      fi
    done < <(git diff --name-only "$range" 2>/dev/null || true)
  done
}

# True if any pushed ref targets refs/heads/main or refs/heads/master
hook_push_targets_protected_branch() {
  local local_ref local_sha remote_ref remote_sha
  while read -r local_ref local_sha remote_ref remote_sha; do
    case "$remote_ref" in
      refs/heads/main|refs/heads/master) return 0 ;;
    esac
  done
  return 1
}

# ─── Lane selection ─────────────────────────────────────────────────────────────────
# Modes (QESTO_PREPUSH_MODE):
#   auto   — docs-only → skip; trust/AI/main → full; else fast (default)
#   fast   — tsc + unit tests
#   full   — ops/ci/quality-gates.sh (CI parity)
#   ci     — alias for full

hook_trust_boundary_pattern='^(functions/api/|worker/|migrations/|schema\.sql|wrangler\.toml|ops/ci/|\.github/workflows/)'

hook_ai_eval_pattern='^(functions/api/.*ai|functions/api/lib/(copilot|studio|help-rag|pulse)|tests/eval/)'

hook_docs_only_pattern='^(\.md$|\.mdx$|knowledge-base/|docs/|\.claude/|agent/.*\.md$)'

hook_files_are_docs_only() {
  local file
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if ! [[ "$file" =~ $hook_docs_only_pattern ]]; then
      return 1
    fi
  done
  return 0
}

hook_files_need_full_gates() {
  local file
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if [[ "$file" =~ $hook_trust_boundary_pattern ]] || [[ "$file" =~ $hook_ai_eval_pattern ]]; then
      return 0
    fi
  done
  return 1
}

# Prints: skip | fast | full
hook_select_lane() {
  local mode="${QESTO_PREPUSH_MODE:-auto}"
  local files="${1:-}"

  case "$mode" in
    full|ci) echo full; return ;;
    fast) echo fast; return ;;
    auto) ;;
    *)
      echo "pre-push: unknown QESTO_PREPUSH_MODE=$mode (use auto|fast|full|ci)" >&2
      return 1
      ;;
  esac

  if [ -z "$files" ]; then
    echo fast
    return
  fi

  if hook_files_are_docs_only <<< "$files"; then
    echo skip
    return
  fi

  if printf '%s\n' "${HOOK_STDIN_REPLAY:-}" | hook_push_targets_protected_branch; then
    echo full
    return
  fi

  if hook_files_need_full_gates <<< "$files"; then
    echo full
    return
  fi

  echo fast
}

hook_print_banner() {
  local lane="$1"
  echo ""
  echo "══════════════════════════════════════════════════════════════"
  echo " Qesto pre-push gate — lane: $lane"
  echo " Skip once (emergency): QESTO_SKIP_PREPUSH=1 git push …"
  echo " Force lane: QESTO_PREPUSH_MODE=fast|full|ci"
  echo "══════════════════════════════════════════════════════════════"
  echo ""
}

# ─── Safety checks ──────────────────────────────────────────────────────────

hook_get_current_branch() {
  git rev-parse --abbrev-ref HEAD 2>/dev/null || echo ""
}

hook_check_bypass_safety() {
  # Warns if QESTO_SKIP_PREPUSH=1 is used on main/master branch (incident-response only)
  if [ "${QESTO_SKIP_PREPUSH:-0}" = "1" ]; then
    local branch
    branch="$(hook_get_current_branch)"
    case "$branch" in
      main|master)
        echo ""
        echo "⚠️  WARNING: Pre-push gates bypassed on protected branch '$branch'" >&2
        echo "   This should only be used during incident response." >&2
        echo "   Re-run full quality gates after push: QESTO_PREPUSH_MODE=full git push --force-with-lease" >&2
        echo ""
        ;;
    esac
  fi
}
