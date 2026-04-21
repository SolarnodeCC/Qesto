import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_ROOT = join(__dirname, '..')
const LOCALES_DIR = join(PROJECT_ROOT, 'public', 'locales', 'en')
const SRC_DIR = join(PROJECT_ROOT, 'src')

/**
 * Recursively find all .ts and .tsx files
 */
function findSourceFiles(dir) {
  const files = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'i18n') {
        files.push(...findSourceFiles(fullPath))
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath)
      }
    }
  } catch (error) {
    console.warn(`Failed to read directory ${dir}:`, error.message)
  }
  return files
}

/**
 * Load all English locale files
 */
function loadLocales() {
  const locales = {}
  const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))

  for (const file of files) {
    const namespace = file.replace('.json', '')
    try {
      const content = readFileSync(join(LOCALES_DIR, file), 'utf-8')
      locales[namespace] = JSON.parse(content)
    } catch (error) {
      console.error(`Failed to load ${namespace}.json:`, error.message)
      process.exit(1)
    }
  }

  return locales
}

/**
 * Extract all i18n keys from source files using regex patterns:
 * - useT('namespace')('key')
 * - t('key') patterns inside a useT context
 */
function extractKeysFromSource() {
  const keys = new Map()
  const sourceFiles = findSourceFiles(SRC_DIR)

  for (const file of sourceFiles) {
    try {
      const content = readFileSync(file, 'utf-8')

      // Pattern: useT('namespace')('key') or useT('ns')(...).('key')
      const useTPat = /useT\(['"]([^'"]+)['"]\)\(['"]([^'"]+)['"]\)/g
      let match
      while ((match = useTPat.exec(content)) !== null) {
        const [, namespace, key] = match
        if (!keys.has(namespace)) {
          keys.set(namespace, new Set())
        }
        keys.get(namespace).add(key)
      }

      // Pattern: const t = useT(...) followed by t('key')
      // But skip if we're in a comment
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const constMatch = /const\s+t\s*=\s*useT\(['"]([^'"]+)['"]\)/g.exec(line)
        if (constMatch) {
          const namespace = constMatch[1]
          if (!keys.has(namespace)) {
            keys.set(namespace, new Set())
          }

          // Find all t('key') calls in subsequent lines (scope-limited search)
          for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
            const nextLine = lines[j]
            // Stop at function boundary or closing brace
            if (nextLine.trim().startsWith('}') && j > i + 1) break

            const tCalls = /t\(['"]([^'"]+)['"]\)/g
            let tMatch
            while ((tMatch = tCalls.exec(nextLine)) !== null) {
              keys.get(namespace).add(tMatch[1])
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read ${file}:`, error.message)
    }
  }

  return keys
}

/**
 * Flatten nested i18n objects to dot-notation paths
 */
function flattenKeys(obj, prefix = '') {
  const result = new Set()

  if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively flatten nested objects
        const nested = flattenKeys(value, fullKey)
        nested.forEach((k) => result.add(k))
      } else {
        result.add(fullKey)
      }
    }
  }

  return result
}

/**
 * Run validation
 */
function validate() {
  const locales = loadLocales()
  const codeKeys = extractKeysFromSource()
  const result = {
    missingKeys: new Set(),
    orphanedKeys: new Set(),
    success: true,
  }

  // Check for missing keys in locales
  for (const [namespace, keySet] of codeKeys) {
    if (!locales[namespace]) {
      console.error(`[i18n] Missing namespace: '${namespace}'`)
      result.success = false
      for (const key of keySet) {
        result.missingKeys.add(`${namespace}.${key}`)
      }
      continue
    }

    const localeKeys = flattenKeys(locales[namespace])

    for (const key of keySet) {
      if (!localeKeys.has(key)) {
        console.error(`[i18n] Missing key: '${namespace}.${key}'`)
        result.missingKeys.add(`${namespace}.${key}`)
        result.success = false
      }
    }
  }

  // Warn about orphaned keys (not used in source)
  for (const [namespace, locale] of Object.entries(locales)) {
    const localeKeys = flattenKeys(locale)
    const codeKeysForNs = codeKeys.get(namespace) || new Set()

    for (const key of localeKeys) {
      if (!codeKeysForNs.has(key) && !key.startsWith('pageTitle.')) {
        // Whitelist pageTitle prefix as it may be used elsewhere
        console.warn(`[i18n] Orphaned key not found in source: '${namespace}.${key}'`)
        result.orphanedKeys.add(`${namespace}.${key}`)
      }
    }
  }

  return result
}

const result = validate()

if (result.missingKeys.size > 0) {
  console.error(`\n[i18n] Found ${result.missingKeys.size} missing key(s)`)
  console.error('Missing keys:')
  Array.from(result.missingKeys)
    .sort()
    .forEach((key) => console.error(`  - ${key}`))
}

if (result.orphanedKeys.size > 0) {
  console.warn(`\n[i18n] Found ${result.orphanedKeys.size} orphaned key(s) not referenced in code`)
}

if (!result.success) {
  process.exit(1)
}

console.log('\n[i18n] Validation passed ✓')
process.exit(0)
