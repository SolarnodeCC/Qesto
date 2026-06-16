#!/bin/bash
# ops/ci/check-migration-numbers.sh — Verify no duplicate migration numbers
# Called by: GitHub Actions (ci.yml)

set -e

echo "Checking for duplicate migration numbers..."

# A migration is identified by its base name (NNNN_name). Each migration may
# have companion files that share its NNNN prefix and base name:
#   0048_feature.sql          ← the migration
#   0048_feature.verify.sql   ← post-apply verification
#   0048_feature.meta.toml    ← metadata
# These companions are NOT separate migrations, so collapse to distinct base
# names BEFORE looking for duplicate numbers. A real collision is two DIFFERENT
# base names sharing one NNNN prefix (e.g. 0050_one + 0050_two). (#530)
duplicates=$(find migrations/ -maxdepth 1 -type f \( -name "[0-9][0-9][0-9][0-9]_*.sql" -o -name "[0-9][0-9][0-9][0-9]_*.meta.toml" \) | \
  xargs -n1 basename | \
  sed -E 's/\.verify\.sql$//; s/\.sql$//; s/\.meta\.toml$//' | \
  sort -u | \
  sed -E 's/_.*$//' | \
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
