#!/usr/bin/env bash
# Install or refresh the pinned claude-seo vendor tree for Cursor / Cloud Agent SEO audits.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
LOCK="${ROOT}/vendor/claude-seo.lock.json"
TARGET="${ROOT}/vendor/claude-seo"
BIN="${TARGET}/bin/claude-seo"

if [[ ! -f "${LOCK}" ]]; then
  echo "Missing ${LOCK}" >&2
  exit 1
fi

REPO="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${LOCK}','utf8')).repository)")"
TAG="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${LOCK}','utf8')).tag)")"
COMMIT="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${LOCK}','utf8')).commit)")"

if [[ -d "${TARGET}/.git" ]]; then
  echo "→ Updating claude-seo at ${TARGET}"
  git -C "${TARGET}" fetch --depth 1 origin "refs/tags/${TAG}" 2>/dev/null || git -C "${TARGET}" fetch --depth 1 origin
  git -C "${TARGET}" checkout --detach "${COMMIT}" 2>/dev/null || git -C "${TARGET}" checkout --detach "${TAG}"
else
  echo "→ Cloning claude-seo ${TAG} into ${TARGET}"
  rm -rf "${TARGET}"
  git clone --depth 1 --branch "${TAG}" "${REPO}" "${TARGET}" 2>/dev/null || {
    git clone --depth 1 "${REPO}" "${TARGET}"
    git -C "${TARGET}" checkout --detach "${COMMIT}"
  }
fi

if [[ ! -x "${BIN}" ]]; then
  chmod +x "${BIN}" "${TARGET}/scripts/runtime.py" 2>/dev/null || true
fi

echo "→ Running claude-seo setup (isolated Python + Chromium)…"
"${BIN}" setup

echo "✓ claude-seo ready at ${TARGET} (${TAG} @ ${COMMIT:0:7})"
