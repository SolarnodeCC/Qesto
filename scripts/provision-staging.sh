#!/bin/bash

# Qesto Staging Provisioning Automation Script
# Usage: bash scripts/provision-staging.sh
#
# This script automates Cloudflare D1 + KV provisioning for staging.
# Prerequisites:
#   - wrangler CLI installed and authenticated
#   - Stripe test API keys ready
#   - Resend test API key ready
#   - Git repository cloned
#
# See docs/STAGING-PROVISIONING-GUIDE.md for manual steps and troubleshooting.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."

  if ! command -v wrangler &> /dev/null; then
    log_error "wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
  fi

  if ! wrangler whoami &> /dev/null; then
    log_error "wrangler not authenticated. Run: wrangler login"
    exit 1
  fi

  log_success "Prerequisites met"
}

# Phase 1: Create D1 Database
provision_d1() {
  log_info "Phase 1: Creating D1 Database..."

  # Check if database already exists
  if wrangler d1 list 2>/dev/null | grep -q "qesto-staging"; then
    log_warning "Database qesto-staging already exists, skipping creation"
    DB_ID=$(wrangler d1 list 2>/dev/null | grep "qesto-staging" | awk '{print $NF}')
  else
    log_info "Creating D1 database qesto-staging..."
    wrangler d1 create qesto-staging --use-remote

    # Extract database ID from output
    DB_ID=$(wrangler d1 list 2>/dev/null | grep "qesto-staging" | awk '{print $NF}')
  fi

  if [ -z "$DB_ID" ]; then
    log_error "Failed to get database ID"
    exit 1
  fi

  log_success "D1 database created/found: $DB_ID"
  echo "$DB_ID" > /tmp/qesto_staging_db_id.txt
}

# Phase 1b: Apply migrations
apply_migrations() {
  log_info "Phase 1b: Applying database migrations..."

  # Get the database ID (already in the variable from provision_d1)
  local MIGRATIONS_DIR="migrations"

  # Apply each migration file in order (all numbered migrations, sorted numerically)
  for migration_file in $(find "$MIGRATIONS_DIR" -maxdepth 1 -name '[0-9]*.sql' | sort -V); do
    if [ -f "$migration_file" ]; then
      local filename=$(basename "$migration_file")
      log_info "Applying $filename..."
      wrangler d1 execute qesto-staging --remote --file "$migration_file"
      if [ $? -ne 0 ]; then
        log_error "Failed to apply $filename"
        return 1
      fi
    fi
  done

  log_success "Migrations applied"
}

# Phase 2: Create KV Namespaces
provision_kv() {
  log_info "Phase 2: Creating KV namespaces..."

  declare -a NAMESPACES=(
    "SESSIONS_KV"
    "USERS_KV"
    "TEAMS_KV"
    "TEMPLATES_KV"
    "DECISIONS_KV"
    "AUDIT_KV"
    "CIRCUIT_BREAKER_KV"
    "INTEGRATIONS_KV"
    "METRICS_KV"
  )

  > /tmp/qesto_staging_kv_ids.txt

  for ns in "${NAMESPACES[@]}"; do
    log_info "Creating ${ns}_STAGING..."

    if wrangler kv:namespace list 2>/dev/null | grep -q "${ns}_STAGING"; then
      log_warning "${ns}_STAGING already exists, skipping"
      KV_ID=$(wrangler kv:namespace list 2>/dev/null | grep "${ns}_STAGING" | awk '{print $NF}')
    else
      # Create and capture the ID from output
      OUTPUT=$(wrangler kv:namespace create "${ns}_STAGING" --preview 2>&1)
      KV_ID=$(echo "$OUTPUT" | grep -oP "(?<='id': ')[^']*" || echo "$OUTPUT" | grep -oP '\[\d{32}\]' | tr -d '[]')
    fi

    if [ -z "$KV_ID" ]; then
      log_warning "Could not auto-extract KV ID for ${ns}, you'll need to paste manually"
      KV_ID="MANUAL_PASTE"
    fi

    echo "${ns}_STAGING_ID=${KV_ID}" >> /tmp/qesto_staging_kv_ids.txt
    log_success "${ns}: $KV_ID"
  done

  log_success "KV namespaces created"
}

# Phase 3: Inject secrets (interactive)
inject_secrets() {
  log_info "Phase 3: Injecting secrets..."

  log_warning "You will be prompted to paste secrets. Have these ready:"
  echo "  1. Stripe Secret Key (sk_test_...)"
  echo "  2. Stripe Publishable Key (pk_test_...)"
  echo "  3. Stripe Starter Monthly Price ID (price_...)"
  echo "  4. Resend API Key (re_...)"
  echo ""

  read -p "Ready to enter secrets? (y/n) " -n 1 -r
  echo

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    wrangler pages secret put STRIPE_SECRET_KEY --env staging
    log_success "STRIPE_SECRET_KEY injected"

    wrangler pages secret put STRIPE_PUBLISHABLE_KEY --env staging
    log_success "STRIPE_PUBLISHABLE_KEY injected"

    wrangler pages secret put STRIPE_STARTER_MONTHLY_PRICE_ID --env staging
    log_success "STRIPE_STARTER_MONTHLY_PRICE_ID injected"

    wrangler pages secret put RESEND_API_KEY --env staging
    log_success "RESEND_API_KEY injected"
  else
    log_warning "Secrets not injected. You can do this manually:"
    echo "  wrangler pages secret put STRIPE_SECRET_KEY --env staging"
    echo "  wrangler pages secret put STRIPE_PUBLISHABLE_KEY --env staging"
    echo "  wrangler pages secret put STRIPE_STARTER_MONTHLY_PRICE_ID --env staging"
    echo "  wrangler pages secret put RESEND_API_KEY --env staging"
  fi
}

# Phase 4-5: Dry run and verification
verify_staging() {
  log_info "Phase 5: Verifying staging configuration..."

  log_info "Running dry-run deployment..."
  if wrangler deploy --env staging --dry-run 2>&1 | grep -q "Ready to deploy"; then
    log_success "Staging configuration is valid"
  else
    log_error "Staging configuration has issues. Check wrangler output above."
    return 1
  fi

  log_info "Testing D1 connectivity..."
  if wrangler d1 execute qesto-staging --remote --command "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'" 2>/dev/null | grep -q "table_count"; then
    log_success "D1 database is accessible"
  else
    log_error "D1 database connection failed"
    return 1
  fi

  log_success "Staging verification complete"
}

# Output summary
summary() {
  log_info "Provisioning Summary"
  echo ""

  if [ -f /tmp/qesto_staging_db_id.txt ]; then
    DB_ID=$(cat /tmp/qesto_staging_db_id.txt)
    echo "  D1 Database ID: $DB_ID"
  fi

  if [ -f /tmp/qesto_staging_kv_ids.txt ]; then
    echo ""
    echo "  KV Namespace IDs:"
    cat /tmp/qesto_staging_kv_ids.txt | sed 's/^/    /'
  fi

  echo ""
  log_info "Next Steps:"
  echo "  1. Review the IDs above and paste them into wrangler.toml [env.staging] section"
  echo "  2. Run: wrangler deploy --env staging (to deploy to staging)"
  echo "  3. See docs/STAGING-PROVISIONING-GUIDE.md for manual steps and troubleshooting"
  echo ""
}

# Main execution
main() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  Qesto Staging Environment Provisioning Automation    ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
  echo ""

  check_prerequisites
  echo ""

  provision_d1
  echo ""

  apply_migrations
  echo ""

  provision_kv
  echo ""

  inject_secrets
  echo ""

  verify_staging
  echo ""

  summary

  log_success "Provisioning complete!"
}

main "$@"
