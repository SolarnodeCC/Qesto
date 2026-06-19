#!/bin/bash
# ops/git-hooks/env.sh — Normalize PATH so hooks find node/npm (Git Bash + WSL)

hook_win_path_to_unix() {
  # C:\Program Files\nodejs\node.exe -> /c/Program Files/nodejs (Git Bash)
  # or /mnt/c/Program Files/nodejs (WSL)
  local win_path="${1//$'\r'/}"
  win_path="${win_path//\\/\/}"
  if [[ "$win_path" =~ ^([A-Za-z]):/(.*)$ ]]; then
    local drive="${BASH_REMATCH[1],,}"
    local rest="${BASH_REMATCH[2]}"
    if [ -d "/mnt/${drive}" ]; then
      echo "/mnt/${drive}/${rest}"
    else
      echo "/${drive}/${rest}"
    fi
  fi
}

hook_prepend_path_dir() {
  local dir="$1"
  [ -n "$dir" ] || return 1
  dir="${dir%/}"
  if [ -f "$dir/node.exe" ] || [ -f "$dir/node" ] || [ -x "$dir/node" ]; then
    PATH="$dir:$PATH"
    export PATH
    return 0
  fi
  return 1
}

hook_ensure_toolchain_path() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

  local candidate unix_dir win_line
  for candidate in \
    "/c/Program Files/nodejs" \
    "/c/Program Files (x86)/nodejs" \
    "/mnt/c/Program Files/nodejs" \
    "/mnt/c/Program Files (x86)/nodejs" \
    "$HOME/.volta/bin" \
    "$HOME/AppData/Roaming/fnm" \
    "$HOME/.local/share/fnm"
  do
    hook_prepend_path_dir "$candidate" && break
  done

  if ! command -v node >/dev/null 2>&1; then
    if command -v cmd.exe >/dev/null 2>&1; then
      win_line="$(cmd.exe /c "where node" 2>/dev/null | head -1 | tr -d '\r')"
      if [ -n "$win_line" ]; then
        unix_dir="$(hook_win_path_to_unix "$(dirname "$win_line")")"
        hook_prepend_path_dir "$unix_dir" || true
      fi
    fi
  fi

  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

  echo "pre-push: node/npm not found on PATH." >&2
  echo "  Install Node 24+ and ensure 'node -v' works in the same shell as 'git push'." >&2
  echo "  Tip (Git Bash): export PATH=\"/c/Program Files/nodejs:\$PATH\"" >&2
  return 1
}
