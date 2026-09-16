#!/usr/bin/env node
/**
 * DS Days 31–60 — high-traffic surfaces must not ship Day-30-mapped dark hex
 * literals. Prefer semantic CSS vars (`var(--text-primary)`, etc.).
 *
 * Scope is intentionally narrow (adoption wave). Grow SCOPED_PREFIXES as more
 * pages migrate; do not broaden to all of src/ until Days 61+.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/** Paths (relative to repo root) that must be hex-clean after Day 60. */
const SCOPED_PREFIXES = [
  'src/pages/join/',
  'src/pages/JoinPage.tsx',
  'src/pages/ConnectJoinPage.tsx',
  'src/pages/dashboard/RecentSessionsSection.tsx',
  'src/pages/dashboard/HeroSection.tsx',
  'src/pages/Present.tsx',
  'src/pages/Display.tsx',
  'src/pages/EventStagePresent.tsx',
  'src/components/launchpad/JoinCodePanel.tsx',
  'src/components/launchpad/QuestionList.tsx',
  'src/components/studio/PromptForm.tsx',
  'src/components/session-wizard/SessionWizardFooter.tsx',
  'src/ui/FormField.tsx',
  'src/layouts/ParticipantShell.tsx',
  'src/layouts/BigScreenShell.tsx',
  'src/layouts/HostConsoleShell.tsx',
]

/**
 * Hex → semantic token map from DS Day 30. Matching is case-insensitive.
 * Brand/signal exceptions (Google logo fills, canvas accents) live outside scope
 * or use non-mapped hex and are ignored here.
 */
const FORBIDDEN_HEX = [
  'F0F2F8', // --text-primary
  'A8B3CC', // --text-secondary
  '8A96B0', // --text-muted
  '8893AD', // --text-muted (legacy)
  '9AA8C7', // near --text-muted / secondary
  '0A0F1E', // --color-bg / --surface-stage
  '0F1525', // --color-bg-subtle
  '0F1628', // --color-bg-subtle
  '151C2E', // --color-surface
  '1C2540', // --color-surface-elevated
  '1E2A45', // --color-border
  '2A3858', // --color-border-strong
]

const HEX_RE = new RegExp(
  `#(?:${FORBIDDEN_HEX.join('|')})\\b`,
  'gi',
)

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(full)
  }
  return out
}

function collectScopedFiles() {
  const files = []
  for (const prefix of SCOPED_PREFIXES) {
    const abs = join(ROOT, prefix)
    try {
      if (statSync(abs).isDirectory()) walk(abs, files)
      else files.push(abs)
    } catch {
      // missing path — skip (new files land later)
    }
  }
  return [...new Set(files)]
}

const violations = []
for (const file of collectScopedFiles()) {
  const rel = relative(ROOT, file).replaceAll('\\', '/')
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    // Allow documented token map comments in this script's sibling docs only —
    // source files should not keep mapped hex even in JSX strings.
    if (HEX_RE.test(line)) {
      HEX_RE.lastIndex = 0
      const matches = line.match(HEX_RE) ?? []
      for (const m of matches) {
        violations.push({ file: rel, line: idx + 1, hex: m, text: trimmed.slice(0, 120) })
      }
    }
  })
}

if (violations.length) {
  console.error(`[check-hex-tokens] ❌ ${violations.length} mapped hex literal(s) in Day-60 scope:`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.hex}  ${v.text}`)
  }
  console.error('Replace with var(--text-*) / var(--color-*) / var(--surface-stage). See DS_DAY60_ADOPTION.')
  process.exit(1)
}
console.log('check-hex-tokens: ok')
