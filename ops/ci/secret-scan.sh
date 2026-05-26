#!/bin/bash
# ops/ci/secret-scan.sh — Fast secret pattern scan (HLT-010)

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "secret-scan"

mkdir -p target/security

PATTERNS=(
  'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'
  'sk_live_[a-zA-Z0-9]+'
  'sk_test_[a-zA-Z0-9]+'
  'ANTHROPIC_AUTH_TOKEN='
  'CLAUDE_CODE_OAUTH_TOKEN='
  'RESEND_API_KEY=sk_'
  'JWT_SECRET=[^$]'
)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
  if git grep -nE "$pattern" -- \
    ':!.gitignore' \
    ':!target/' \
    ':!node_modules/' \
    ':!dist/' \
    ':!ops/ci/secret-scan.sh' \
    ':!knowledge-base/' \
    ':!tests/' \
    ':!docs/' \
    ':!.dev.vars.example' \
    ':!package.json' \
    ':!.claude/settings.local.json.example' \
    ':!REMEDIATION_SUMMARY.md' \
    ':!SECURITY_AUDIT_FINDINGS.md' 2>/dev/null; then
    FOUND=1
  fi
done

if [ "$FOUND" -ne 0 ]; then
  report_error "Secret-like patterns detected — rotate credentials and remove from tree"
  exit 1
fi

report_success "No secret patterns in tracked sources"
echo '{"ok":true}' > target/security/secret-scan.json
exit 0
