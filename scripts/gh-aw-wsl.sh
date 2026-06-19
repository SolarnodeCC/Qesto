#!/bin/bash
# scripts/gh-aw-wsl.sh — Run gh aw via WSL (native Windows gh-aw.exe may hang)
#
# Usage: bash scripts/gh-aw-wsl.sh aw <subcommand> [args...]
# Example: bash scripts/gh-aw-wsl.sh aw run daily-repo-status

set -euo pipefail

if ! command -v wsl.exe >/dev/null 2>&1; then
  echo "error: wsl.exe not found — install WSL or run gh aw from Linux/macOS" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Git Bash → WSL path
WSL_ROOT="$(wsl.exe wslpath -a "$ROOT" | tr -d '\r')"

TOKEN=""
if command -v gh >/dev/null 2>&1; then
  TOKEN="$(gh auth token 2>/dev/null || true)"
fi

wsl.exe bash -lc "
  set -euo pipefail
  export PATH=/tmp/gh_2.93.0_linux_amd64/bin:\$HOME/.local/share/gh/extensions/gh-aw:\$PATH
  ${TOKEN:+export GH_TOKEN='$TOKEN'}
  cd '$WSL_ROOT'
  if ! command -v gh >/dev/null 2>&1; then
    echo '→ Installing gh to /tmp (one-time)...'
    curl -fsSL -o /tmp/gh.tgz https://github.com/cli/cli/releases/download/v2.93.0/gh_2.93.0_linux_amd64.tar.gz
    tar xzf /tmp/gh.tgz -C /tmp
    export PATH=/tmp/gh_2.93.0_linux_amd64/bin:\$PATH
    gh extension install github/gh-aw 2>/dev/null || true
  fi
  gh \"\$@\"
" gh "$@"
