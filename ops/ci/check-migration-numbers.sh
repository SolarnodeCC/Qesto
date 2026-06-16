#!/bin/bash
# ops/ci/check-migration-numbers.sh — Verify no duplicate migration numbers
# Called by: GitHub Actions (ci.yml)

set -e

echo "Checking for duplicate migration numbers..."

# Extract migration number from filename (e.g., 0048_something.sql → 0048)
duplicates=$(find migrations/ -name "[0-9][0-9][0-9][0-9]*.sql" -o -name "[0-9][0-9][0-9][0-9]*.meta.toml" | \
  sed 's/.*\([0-9]\{4\}\)_.*/\1/' | \
  sort | uniq -d)

if [ -n "$duplicates" ]; then
  echo "ERROR: Found duplicate migration numbers:"
  echo "$duplicates"
  echo ""
  echo "Migration filenames must have unique 4-digit prefixes:"
  echo "  ✓ 0048_feature_name.sql"
  echo "  ✓ 0049_another_feature.sql"
  echo "  ✗ 0050_feature_one.sql + 0050_feature_two.sql (collision!)"
  echo ""
  exit 1
fi

echo "✓ No duplicate migration numbers found"
