#!/usr/bin/env node
/**
 * DS Day 1–30 — layouts must not ship inline <svg> icons (ADR-0071 Hard Rule 9).
 * Use lucide-react. Comments mentioning `<svg>` are ignored.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const LAYOUTS = join(ROOT, 'src', 'layouts')

const SVG_TAG = /<svg\b/i

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(full)
  }
  return out
}

const violations = []
for (const file of walk(LAYOUTS)) {
  const rel = relative(ROOT, file).replaceAll('\\', '/')
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    if (SVG_TAG.test(line)) {
      violations.push({ file: rel, line: idx + 1, text: trimmed.slice(0, 120) })
    }
  })
}

if (violations.length) {
  console.error(`[check-lucide-layouts] ❌ ${violations.length} inline <svg> in layouts:`)
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.text}`)
  process.exit(1)
}
console.log('check-lucide-layouts: ok')
