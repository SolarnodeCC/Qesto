#!/usr/bin/env node
// scripts/check-contrast-tokens.mjs
// A11Y-CONTRAST-01 (GH #591): `text-pulse-400` (2.52:1) and `text-pulse-300`
// (1.48:1) fail WCAG AA (4.5:1) for readable text on the light/white surfaces
// used across most of the app. Both tokens remain legal for:
//   - non-text usages (`border-pulse-*`, `bg-pulse-*`, `ring-pulse-*`, …)
//   - `dark:`-scoped text usages (and `dark:hover:`/`dark:focus:` etc.), since
//     on the app's dark surfaces (pulse-800/900) these tokens read at 6:1–13:1
//   - a short allowlist of components that render exclusively on a permanent
//     dark surface (e.g. the presenter control bar, bg-pulse-900), where the
//     class is never toggled by the `dark:` media/class variant because the
//     surface itself is hard-coded dark.
//
// This is a regression guard, not a one-time sweep: it fails CI if a new
// `text-pulse-400`/`text-pulse-300` usage is introduced on a (presumed) light
// surface without going through this allowlist or a `dark:` prefix.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC_DIR = join(ROOT, 'src')

// Files that render only on a permanently dark surface (no `dark:` variant
// needed because there is no light counterpart). Each entry is reviewed by
// hand — see PresenterControls.tsx (bg-pulse-900 toolbar) for the canonical
// example. Keep this list short; prefer fixing the surface to use `dark:`
// variants over growing this allowlist.
const DARK_SURFACE_ALLOWLIST = new Set([
  'src/pages/present/PresenterControls.tsx',
])

// Matches `text-pulse-400` / `text-pulse-300` as a standalone Tailwind class
// (word boundary on both ends) so we don't also match `text-pulse-4000` etc.
const CLASS_RE = /(?:^|[\s"'`])((?:[\w-]+:)*?)(text-pulse-(?:300|400))\b/g

function isDarkScoped(modifierChain) {
  // modifierChain looks like "dark:hover:" or "" — any chain that begins
  // with `dark:` (the first modifier) means this is conditioned on dark mode.
  return /^dark:/.test(modifierChain)
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

const violations = []

for (const file of walk(SRC_DIR)) {
  const relPath = relative(ROOT, file).replaceAll('\\', '/')
  if (DARK_SURFACE_ALLOWLIST.has(relPath)) continue

  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')

  lines.forEach((line, idx) => {
    let match
    const re = new RegExp(CLASS_RE)
    while ((match = re.exec(line))) {
      const [, modifierChain, token] = match
      if (isDarkScoped(modifierChain)) continue
      violations.push({ file: relPath, line: idx + 1, token, text: line.trim().slice(0, 100) })
    }
  })
}

if (violations.length > 0) {
  console.error(`[check-contrast-tokens] ❌ Found ${violations.length} low-contrast text usage(s):`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  →  ${v.token}  (${v.text})`)
  }
  console.error('\n[check-contrast-tokens] Use text-pulse-500 (4.73:1) or darker for readable text.')
  console.error('[check-contrast-tokens] If this usage sits on a permanent dark surface, scope it with')
  console.error('[check-contrast-tokens] `dark:` or add the file to DARK_SURFACE_ALLOWLIST with a comment.')
  process.exit(1)
}

console.log('[check-contrast-tokens] ✓ No low-contrast text-pulse-400/300 usages found')
process.exit(0)
