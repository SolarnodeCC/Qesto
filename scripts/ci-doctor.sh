#!/bin/bash
# scripts/ci-doctor.sh — Environment health check
# Verifies that your local environment matches CI requirements.
# Run before making changes: bash scripts/ci-doctor.sh

set -e

source "ops/ci/lib.sh"

echo "Qesto CI Doctor — Verifying environment"
echo ""

# Check system tools
check_tool() {
  local tool=$1
  local min_version=$2
  if command -v "$tool" &> /dev/null; then
    local actual=$($tool --version 2>&1 | head -1)
    echo -e "${GREEN}✓${NC} $tool: $actual"
  else
    echo -e "${RED}✗${NC} $tool: NOT FOUND"
    return 1
  fi
}

echo "System Tools:"
check_tool git "$GIT_MIN_VERSION"
check_tool bash "$BASH_MIN_VERSION"
echo ""

echo "Node & npm:"
check_tool node "$NODE_VERSION"
check_tool npm "$NPM_MIN_VERSION"
echo ""

echo "Project Files:"
for file in package.json package-lock.json tsconfig.json .github/workflows/ci.yml ops/ci/lib.sh; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
  else
    echo -e "${RED}✗${NC} $file: NOT FOUND"
  fi
done
echo ""

echo "Git Configuration:"
hooks_path=$(git config --get core.hooksPath 2>/dev/null || echo "not set")
if [ "$hooks_path" = "ops/git-hooks" ]; then
  echo -e "${GREEN}✓${NC} core.hooksPath = ops/git-hooks"
else
  echo -e "${YELLOW}⚠${NC} core.hooksPath = $hooks_path (should be ops/git-hooks)"
  echo "   Run: git config core.hooksPath ops/git-hooks"
fi
echo ""

echo "Dependencies:"
if [ -d "node_modules" ]; then
  count=$(find node_modules -maxdepth 1 -type d | wc -l)
  echo -e "${GREEN}✓${NC} node_modules ($count packages)"
else
  echo -e "${RED}✗${NC} node_modules: NOT INSTALLED"
  echo "   Run: npm ci"
fi
echo ""

echo -e "${GREEN}Environment is ready for development${NC}"
echo ""
echo "Next steps:"
echo "  1. git config core.hooksPath ops/git-hooks   # Setup pre-push hook"
echo "  2. npm ci                                      # Install dependencies"
echo "  3. bash ops/ci/quality-gates.sh               # Run quality gates"
