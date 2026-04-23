import { readFileSync, readdirSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_ROOT = join(__dirname, '..')
const LOCALES_DIR = join(PROJECT_ROOT, 'public', 'locales')
const LANGUAGES = ['en', 'nl', 'es', 'de', 'fr']

/**
 * Recursively flatten a nested object into dot-notation keys
 */
function flattenObject(obj, prefix = '') {
  const result = {}

  if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(result, flattenObject(value, fullKey))
      } else if (typeof value === 'string') {
        result[fullKey] = value
      }
    }
  }

  return result
}

/**
 * Load all JSON files for a language
 */
function loadLanguageFiles(lang) {
  const langDir = join(LOCALES_DIR, lang)
  const flatMap = {}

  try {
    const files = readdirSync(langDir).filter((f) => f.endsWith('.json'))

    for (const file of files) {
      const namespace = file.replace('.json', '')
      try {
        const content = readFileSync(join(langDir, file), 'utf-8')
        const json = JSON.parse(content)
        const flattened = flattenObject(json)

        // Prefix each key with namespace
        for (const [key, value] of Object.entries(flattened)) {
          flatMap[`${namespace}.${key}`] = value
        }
      } catch (error) {
        console.error(`[i18n] Failed to parse ${lang}/${file}:`, error.message)
        process.exit(1)
      }
    }
  } catch (error) {
    console.error(`[i18n] Failed to read ${lang} locale directory:`, error.message)
    process.exit(1)
  }

  return flatMap
}

/**
 * Check Launchpad.tsx for hardcoded user-facing strings not wrapped in t()
 */
function checkLaunchpadHardcoded() {
  const launchpadPath = join(PROJECT_ROOT, 'src', 'pages', 'Launchpad.tsx')
  let content
  try {
    content = readFileSync(launchpadPath, 'utf-8')
  } catch {
    // If file doesn't exist or can't be read, skip check
    return true
  }

  // Pattern to find string literals that look like user-facing text
  // This regex finds quoted strings that start with a capital letter and are longer than 3 chars
  // but are NOT preceded by t( and are NOT in className, URLs, or aria- attributes
  const suspiciousPatterns = [
    // Find strings like "Generate questions with AI" that aren't inside t()
    /(?<!t\(\s*['"])["']([A-Z][a-z\s]{4,}(?:[A-Z][a-z\s]*)*)['"]\)/g,
    // Also catch template literals with similar patterns
    /`([A-Z][a-z\s]{4,}[^`]*)`/g,
  ]

  // More specific: look for literal strings in JSX that aren't wrapped in t()
  // Pattern: find string literals that are not preceded by t(
  const lines = content.split('\n')
  const hardcodedLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip lines with className, URLs, aria-values (likely constants)
    if (
      line.includes('className') ||
      line.includes('http') ||
      line.includes('aria-') ||
      line.includes('svg') ||
      line.includes('path d=')
    ) {
      continue
    }

    // Look for user-facing strings: "Generate..." "Generating..." etc
    // that are NOT inside a t( call
    if (
      (line.includes('"Generate questions') ||
       line.includes('"Generating') ||
       line.includes('"Topic or goal') ||
       line.includes('✨ Generate')) &&
      !line.includes('t(')
    ) {
      hardcodedLines.push({ line: i + 1, text: line.trim() })
    }
  }

  if (hardcodedLines.length > 0) {
    console.error('[i18n] ❌ Launchpad.tsx contains hardcoded user-facing strings:')
    for (const item of hardcodedLines) {
      console.error(`       Line ${item.line}: ${item.text}`)
    }
    return false
  }

  return true
}

/**
 * Validate translation completeness using English as reference
 */
function validate() {
  console.log('[i18n] Starting translation validation...')

  const enKeys = loadLanguageFiles('en')
  const enKeysList = Object.keys(enKeys).sort()

  if (enKeysList.length === 0) {
    console.error('[i18n] Error: No English translations found')
    return false
  }

  console.log(`[i18n] Found ${enKeysList.length} English keys as reference`)

  let hasErrors = false

  // Check for hardcoded strings in Launchpad.tsx
  console.log('[i18n] Checking Launchpad.tsx for hardcoded strings...')
  if (!checkLaunchpadHardcoded()) {
    hasErrors = true
  }

  // Check each other language
  for (const lang of LANGUAGES) {
    if (lang === 'en') continue

    const langKeys = loadLanguageFiles(lang)
    const langKeysList = Object.keys(langKeys)
    const missing = []

    // Find keys in English but missing in this language
    for (const enKey of enKeysList) {
      if (!(enKey in langKeys)) {
        missing.push(enKey)
      }
    }

    if (missing.length > 0) {
      console.error(
        `[i18n] ❌ ${lang} missing ${missing.length} keys: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`,
      )
      hasErrors = true

      // Note about filling missing keys
      console.log(`[i18n] Note: Missing keys in ${lang} should be added with [TODO] prefix (e.g., "[TODO] Create session")`)
    } else {
      console.log(`[i18n] ✓ ${lang} is complete`)
    }
  }

  return !hasErrors
}

// ─────────────────────────────────────────────────────────────────────────────
// I18N-BUG-02: Detect non-keyed literals in JSX components.
//
// Flags user-visible text strings in .tsx/.ts files that are rendered directly
// in JSX without going through the `t('...')` translation function.
//
// Heuristic: Looks for JSX text content patterns that appear to be natural-
// language sentences/phrases (≥ 3 words, not a technical identifier, not a
// URL, not a number/code). Short single-word labels and technical strings are
// excluded by allowlisting.
// ─────────────────────────────────────────────────────────────────────────────

const SRC_DIR = join(PROJECT_ROOT, 'src')

/**
 * Patterns that indicate a non-keyed literal in JSX.
 * Each pattern captures the raw string content that is rendered directly.
 */
const NON_KEYED_PATTERNS = [
  // JSX text node between tags: <p>Hard coded text here</p>
  // Must be ≥ 3 words and contain a space (sentences, not identifiers)
  />([A-ZÁÉÍÓÚÀÈÙÄÖÜ][a-záéíóúàèùäöüA-Z][^<>{}\n]{10,})</,
  // Explicit string in JSX expression: {'Hard coded text'}
  /\{['"]([A-ZÁÉÍÓÚÀÈÙÄÖÜ][a-záéíóúàèùäöüA-Z ]{10,})['"]\}/,
]

// Known-good strings that don't need i18n (technical labels, brand names, etc.)
const NON_KEYED_ALLOWLIST = [
  /^Qesto$/i,
  /^[A-Z][a-z]+:/, // "Label: value" patterns in code comments
  /^\d/,           // Starts with number
  /^https?:\/\//,  // URLs
  /^[A-Z_]+$/,     // ALL_CAPS constants
  /^←/, /^→/,      // Arrows already i18n'd separately
  /copyright/i,
  /^\//, // Paths
  /WCAG|ARIA|HTML|CSS|JSX|API|KV|DO|AI|QR/i, // Tech abbreviations
  // Short phrases that are intentionally hard-coded (structural, not UX copy)
  /^(true|false|null|undefined|NaN)$/,
  /^\+|\-\d/,
]

function shouldFlagString(str) {
  const trimmed = str.trim()
  if (trimmed.length < 12) return false
  if (trimmed.split(/\s+/).length < 2) return false // single word
  if (NON_KEYED_ALLOWLIST.some((p) => p.test(trimmed))) return false
  return true
}

function scanFileForNonKeyedLiterals(filepath) {
  const content = readFileSync(filepath, 'utf8')
  const issues = []
  const lines = content.split('\n')

  // Only scan .tsx files that use the `t()` hook (are i18n-aware)
  if (!filepath.endsWith('.tsx')) return []
  if (!content.includes('useT(') && !content.includes("from '../i18n'")) return []

  lines.forEach((line, idx) => {
    // Skip comment lines, import lines, type definitions
    const trimmedLine = line.trim()
    if (
      trimmedLine.startsWith('//') ||
      trimmedLine.startsWith('*') ||
      trimmedLine.startsWith('import ') ||
      trimmedLine.startsWith('type ') ||
      trimmedLine.startsWith('interface ') ||
      trimmedLine.startsWith('export type')
    ) return

    for (const pattern of NON_KEYED_PATTERNS) {
      const match = line.match(pattern)
      if (match) {
        const candidate = match[1]?.trim()
        if (candidate && shouldFlagString(candidate)) {
          issues.push({
            line: idx + 1,
            text: candidate.slice(0, 60),
          })
        }
      }
    }
  })

  return issues
}

function walkSrcDir(dir) {
  const results = []
  let entries

  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    if (['.', 'node_modules', 'dist', '.git'].includes(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkSrcDir(full))
    } else if (entry.name.endsWith('.tsx')) {
      const issues = scanFileForNonKeyedLiterals(full)
      if (issues.length > 0) {
        results.push({ file: relative(PROJECT_ROOT, full), issues })
      }
    }
  }

  return results
}

function validateNonKeyedLiterals() {
  console.log('[i18n] Scanning for non-keyed literals in i18n-aware components…')
  const findings = walkSrcDir(SRC_DIR)

  if (findings.length === 0) {
    console.log('[i18n] ✓ No non-keyed literals detected')
    return true
  }

  console.error('[i18n] ❌ Non-keyed literals found (use t() for all user-visible strings):')
  for (const { file, issues } of findings) {
    for (const issue of issues) {
      console.error(`  ${file}:${issue.line}  →  "${issue.text}"`)
    }
  }
  return false
}

const success = validate()
const noLiterals = validateNonKeyedLiterals()

if (success && noLiterals) {
  console.log('\n[i18n] Validation passed - all languages are complete ✓')
  process.exit(0)
} else {
  console.error('\n[i18n] Validation failed - some translations are incomplete')
  process.exit(1)
}
