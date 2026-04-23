#!/usr/bin/env node
// scripts/check-baseline.mjs
// LAYOUT-GRID-01: 4px baseline lint rule.
// Scans TSX/CSS source files for inline pixel values that are not multiples of 4px.
// Exempt: 1px (hairline borders), 2px (border widths), 3px (radius/ring widths),
//         odd values in box-shadow x/y offsets, and the spacing token scale itself.

import { readdirSync, readFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SCAN_DIRS = [resolve(ROOT, 'src'), resolve(ROOT, 'src/styles')]

// Values that are explicitly allowed outside the 4px grid
const EXEMPT_VALUES = new Set([1, 2, 3])

// Patterns that produce a match group of the numeric px value
const PX_PATTERNS = [
  // Inline style: style={{ marginTop: '10px' }} or style={{ height: '22px' }}
  /style=\{[^}]*?['"`](\d+)px['"`]/g,
  // Tailwind arbitrary: h-[22px], mt-[10px], py-[3px] — vertical only properties
  /(?:^|\s)(?:h|min-h|max-h|mt|mb|my|pt|pb|py|top|bottom|gap|space-y|row-gap)-\[(\d+)px\]/g,
  // CSS property values in .css files: height: 22px; padding-top: 10px;
  /(?:height|min-height|max-height|margin-top|margin-bottom|padding-top|padding-bottom|gap|row-gap|top|bottom)\s*:\s*(\d+)px\b/g,
]

function isMultipleOf4(n) {
  return n % 4 === 0
}

function scanFile(filepath) {
  const content = readFileSync(filepath, 'utf8')
  const violations = []
  const lines = content.split('\n')

  for (const pattern of PX_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0
    let match

    while ((match = pattern.exec(content)) !== null) {
      const value = parseInt(match[1], 10)
      if (EXEMPT_VALUES.has(value) || isMultipleOf4(value)) continue

      const lineNumber = content.substring(0, match.index).split('\n').length
      violations.push({
        line: lineNumber,
        value,
        context: lines[lineNumber - 1]?.trim().slice(0, 80),
      })
    }
  }

  return violations
}

function walkDir(dir) {
  const results = []
  let entries

  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    if (['.', 'node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) continue

    const full = resolve(dir, entry.name)

    if (entry.isDirectory()) {
      results.push(...walkDir(full))
    } else if (
      entry.name.endsWith('.tsx') ||
      entry.name.endsWith('.ts') ||
      entry.name.endsWith('.css')
    ) {
      const violations = scanFile(full)
      if (violations.length > 0) {
        results.push({ file: relative(ROOT, full), violations })
      }
    }
  }

  return results
}

const allViolations = []
for (const dir of SCAN_DIRS) {
  allViolations.push(...walkDir(dir))
}

if (allViolations.length === 0) {
  console.log('✅ 4px baseline check passed — all vertical measurements are multiples of 4px.')
  process.exit(0)
} else {
  console.error('\n❌ 4px Baseline Violations\n')
  for (const { file, violations } of allViolations) {
    for (const v of violations) {
      console.error(`  ${file}:${v.line}  →  ${v.value}px is not a multiple of 4`)
      console.error(`    ${v.context}`)
    }
  }
  const total = allViolations.reduce((s, f) => s + f.violations.length, 0)
  console.error(`\nFound ${total} baseline violation(s). Use spacing tokens (4, 8, 12, 16, 24, 32, 48, 64, 96px).\n`)
  process.exit(1)
}
