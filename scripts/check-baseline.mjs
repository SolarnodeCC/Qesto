#!/usr/bin/env node
/**
 * check-baseline.mjs
 * Scans CSS files for px values in spacing/sizing properties and warns
 * if any value is not a multiple of 4 (violates 4px baseline grid).
 *
 * Scope: padding, margin, gap only — border-radius and font-size are
 * intentionally excluded to avoid false positives from design-token values
 * such as 6px (radius-sm) or 10px (radius-md).
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const SPACING_PROPS = [
  'padding',
  'margin',
  'gap',
]

const CSS_DIRS = ['src/styles', 'src']
const CSS_EXTENSIONS = ['.css']

let violations = 0
let filesChecked = 0

function walkDir(dir) {
  let files = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        files = files.concat(walkDir(full))
      } else if (CSS_EXTENSIONS.includes(extname(full))) {
        files.push(full)
      }
    }
  } catch {}
  return files
}

// Deduplicate: src/ walk would include src/styles/, so collect from both
// but deduplicate by absolute path.
const seen = new Set()
const cssFiles = CSS_DIRS.flatMap(walkDir).filter((f) => {
  if (seen.has(f)) return false
  seen.add(f)
  return true
})

for (const file of cssFiles) {
  const content = readFileSync(file, 'utf-8')
  filesChecked++
  let lineNo = 0
  for (const line of content.split('\n')) {
    lineNo++
    const propMatch = line.match(/^\s*([\w-]+)\s*:\s*(.+)$/)
    if (!propMatch) continue
    const prop = propMatch[1]
    if (!SPACING_PROPS.some((p) => prop === p || prop.startsWith(p + '-'))) continue
    // Find all px values
    const pxMatches = [...propMatch[2].matchAll(/(\d+(?:\.\d+)?)px/g)]
    for (const m of pxMatches) {
      const val = parseFloat(m[1])
      if (val > 0 && val % 4 !== 0) {
        console.warn(`  WARN  ${file}:${lineNo}  ${prop}: ${m[0]}  (not a multiple of 4)`)
        violations++
      }
    }
  }
}

console.log(`\nChecked ${filesChecked} CSS file(s).`)
if (violations > 0) {
  console.error(`FAIL  ${violations} baseline violation(s) found.`)
  process.exit(1)
} else {
  console.log('PASS  All spacing values are 4px-baseline compliant.')
}
