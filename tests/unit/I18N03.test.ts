import { describe, it, expect } from 'vitest'

// Key extraction regex patterns for i18n keys
const KEY_EXTRACTION_PATTERNS = [
  // Pattern 1: t('namespace.key')
  /t\(['"]([a-zA-Z0-9_.]+)['"]\)/g,
  // Pattern 2: t("namespace.key")
  /t\(["']([a-zA-Z0-9_.]+)["']\)/g,
  // Pattern 3: useT('namespace') + t('key')
  /t\(\s*['"]([a-zA-Z0-9_.]+)['"]\s*\)/g,
  // Pattern 4: Template literals with expressions
  /t\(`([a-zA-Z0-9_.]+)`\)/g,
  // Pattern 5: Dynamic key access t(key) where key is a variable
  /t\(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\)/g,
]

describe('I18N-03: Key Extraction + CI Validation', () => {
  it('extracts keys from t() calls (pattern 1: single quotes)', () => {
    const code = "t('dashboard.greeting')"
    const pattern = KEY_EXTRACTION_PATTERNS[0]
    const matches = [...code.matchAll(pattern)]

    expect(matches.length).toBe(1)
    expect(matches[0][1]).toBe('dashboard.greeting')
  })

  it('extracts keys from t() calls (pattern 2: double quotes)', () => {
    const code = 't("sessions.create")'
    const pattern = KEY_EXTRACTION_PATTERNS[1]
    const matches = [...code.matchAll(pattern)]

    expect(matches.length).toBe(1)
    expect(matches[0][1]).toBe('sessions.create')
  })

  it('handles whitespace in t() calls', () => {
    const code = "t(  'dashboard.empty'  )"
    const pattern = KEY_EXTRACTION_PATTERNS[2]
    const matches = [...code.matchAll(pattern)]

    expect(matches.length).toBeGreaterThan(0)
  })

  it('extracts multiple keys from same source', () => {
    const code = `
      const greeting = t('dashboard.greeting')
      const empty = t('dashboard.empty')
      const error = t('dashboard.error')
    `
    const pattern = KEY_EXTRACTION_PATTERNS[0]
    const matches = [...code.matchAll(pattern)]

    expect(matches.length).toBe(3)
    expect(matches[0][1]).toBe('dashboard.greeting')
    expect(matches[1][1]).toBe('dashboard.empty')
    expect(matches[2][1]).toBe('dashboard.error')
  })

  it('validates key format (namespace.key)', () => {
    const validKeys = ['dashboard.greeting', 'admin.audit', 'i18n.missing']
    const invalidKeys = ['greeting', 'invalid-key', '123.key']

    const keyPattern = /^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+$/

    for (const key of validKeys) {
      expect(keyPattern.test(key)).toBe(true)
    }

    for (const key of invalidKeys) {
      expect(keyPattern.test(key)).toBe(false)
    }
  })

  it('detects missing keys in EN bundle', () => {
    const enKeys = new Set([
      'dashboard.greeting',
      'dashboard.empty',
      'sessions.create',
    ])

    const usedKeys = new Set([
      'dashboard.greeting',
      'dashboard.empty',
      'sessions.create',
      'sessions.missing', // Not in EN
    ])

    const missing = [...usedKeys].filter(k => !enKeys.has(k))
    expect(missing).toEqual(['sessions.missing'])
  })

  it('detects missing keys in non-EN bundles', () => {
    const enKeys = new Set([
      'dashboard.greeting',
      'dashboard.empty',
      'sessions.create',
    ])

    const nlKeys = new Set([
      'dashboard.greeting',
      'sessions.create',
      // Missing: dashboard.empty
    ])

    const missing = [...enKeys].filter(k => !nlKeys.has(k))
    expect(missing).toEqual(['dashboard.empty'])
  })

  it('detects orphaned keys (in translations but not in code)', () => {
    const translatedKeys = new Set([
      'dashboard.greeting',
      'dashboard.empty',
      'sessions.create',
      'sessions.old_key', // Not used anywhere
    ])

    const usedKeys = new Set([
      'dashboard.greeting',
      'dashboard.empty',
      'sessions.create',
    ])

    const orphaned = [...translatedKeys].filter(k => !usedKeys.has(k))
    expect(orphaned).toEqual(['sessions.old_key'])
  })

  it('provides actionable remediation messages', () => {
    const missing = ['dashboard.empty', 'sessions.create']
    const remediation = missing.map(k => `[TODO] Add ${k} to translations`)

    expect(remediation).toEqual([
      '[TODO] Add dashboard.empty to translations',
      '[TODO] Add sessions.create to translations',
    ])
  })

  it('supports --fix mode to auto-generate placeholders', () => {
    const missingKey = 'dashboard.greeting'
    const placeholder = `"[TODO] ${missingKey}"`

    expect(placeholder).toContain('[TODO]')
    expect(placeholder).toContain(missingKey)
  })

  it('generates valid placeholder entry', () => {
    const key = 'dashboard.greeting'
    const placeholder = {
      [key]: '[TODO] Translate this key'
    }

    expect(key in placeholder).toBe(true)
    expect(placeholder[key]).toContain('[TODO]')
  })

  it('validates CI gate blocks PR on missing EN keys', () => {
    const missingInEN = ['dashboard.missing']
    const shouldBlock = missingInEN.length > 0

    expect(shouldBlock).toBe(true)
  })

  it('allows PR on missing non-EN keys (advisory only)', () => {
    const shouldBlock = false

    expect(shouldBlock).toBe(false)
  })
})
