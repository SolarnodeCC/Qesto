import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '..')
const LOCALES_DIR = join(PROJECT_ROOT, 'public', 'locales')
const SRC_DIR = join(PROJECT_ROOT, 'src')
const SCOPE_PATH = join(PROJECT_ROOT, 'i18n.scope.json')
const REPORT_DIR = join(PROJECT_ROOT, 'docs', 'reports')
const REPORT_MD = join(REPORT_DIR, 'i18n-gap-inventory.md')
const REPORT_JSON = join(REPORT_DIR, 'i18n-gap-inventory.json')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function flattenObject(obj, prefix = '') {
  const result = {}
  if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, fullKey))
      } else if (typeof value === 'string') {
        result[fullKey] = value
      }
    }
  }
  return result
}

function loadNamespaceFlat(lang, namespace) {
  const path = join(LOCALES_DIR, lang, `${namespace}.json`)
  if (!existsSync(path)) return null
  const content = readJson(path)
  return flattenObject(content)
}

function loadLangNamespaces(lang) {
  const dir = join(LOCALES_DIR, lang)
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  return files.map((f) => f.replace('.json', ''))
}

function normalizePathForScope(path) {
  return path.replaceAll('\\', '/')
}

function shouldExcludeFile(filepath, scope) {
  const rel = normalizePathForScope(relative(PROJECT_ROOT, filepath))
  return scope.excludedSourceGlobs.some((pattern) => {
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3)
      return rel.startsWith(prefix)
    }
    return rel === pattern
  })
}

const NON_KEYED_PATTERNS = [
  />([A-ZÁÉÍÓÚÀÈÙÄÖÜ][a-záéíóúàèùäöüA-Z][^<>{}\n]{10,})</,
  /\{['"]([A-ZÁÉÍÓÚÀÈÙÄÖÜ][a-záéíóúàèùäöüA-Z ]{10,})['"]\}/,
]

const NON_KEYED_ALLOWLIST = [
  /^Qesto$/i,
  /^[A-Z][a-z]+:/,
  /^\d/,
  /^https?:\/\//,
  /^[A-Z_]+$/,
  /^←/, /^→/,
  /copyright/i,
  /^\//,
  /WCAG|ARIA|HTML|CSS|JSX|API|KV|DO|AI|QR/i,
  /^(true|false|null|undefined|NaN)$/,
  /^\+|\-\d/,
]

function shouldFlagString(str) {
  const trimmed = str.trim()
  if (trimmed.length < 12) return false
  if (trimmed.split(/\s+/).length < 2) return false
  if (NON_KEYED_ALLOWLIST.some((p) => p.test(trimmed))) return false
  return true
}

function scanFileForLiterals(filepath, scope) {
  if (shouldExcludeFile(filepath, scope)) return []
  const content = readFileSync(filepath, 'utf8')
  if (!content.includes('useT(') && !content.includes("from '../i18n'") && !content.includes('from "../i18n"')) return []

  const issues = []
  const lines = content.split('\n')
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('import ') ||
      trimmed.startsWith('type ') ||
      trimmed.startsWith('interface ') ||
      trimmed.startsWith('export type')
    ) return

    for (const pattern of NON_KEYED_PATTERNS) {
      const match = line.match(pattern)
      if (!match) continue
      const candidate = match[1]?.trim()
      if (candidate && shouldFlagString(candidate)) {
        issues.push({ line: idx + 1, text: candidate.slice(0, 100) })
      }
    }
  })

  return issues
}

function walkTsxFiles(dir, out = []) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkTsxFiles(full, out)
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

function buildReport() {
  const scope = readJson(SCOPE_PATH)
  const langs = scope.supportedLanguages
  const includedNamespaces = scope.namespaces.filter((ns) => !scope.excludedNamespaces.includes(ns))

  const namespaceSetByLang = Object.fromEntries(langs.map((lang) => [lang, loadLangNamespaces(lang)]))

  const missingByLang = {}
  const todoByLang = {}

  for (const lang of langs) {
    if (lang === 'en') continue
    missingByLang[lang] = {}
    todoByLang[lang] = {}

    for (const ns of includedNamespaces) {
      const enFlat = loadNamespaceFlat('en', ns) ?? {}
      const langFlat = loadNamespaceFlat(lang, ns) ?? {}

      const missing = Object.keys(enFlat).filter((k) => !(k in langFlat))
      const todo = Object.entries(langFlat)
        .filter(([, value]) => typeof value === 'string' && value.startsWith('[TODO]'))
        .map(([k]) => k)

      if (missing.length > 0) missingByLang[lang][ns] = missing
      if (todo.length > 0) todoByLang[lang][ns] = todo
    }
  }

  const tsxFiles = walkTsxFiles(SRC_DIR)
  const literals = []
  for (const file of tsxFiles) {
    const issues = scanFileForLiterals(file, scope)
    if (issues.length > 0) {
      literals.push({
        file: normalizePathForScope(relative(PROJECT_ROOT, file)),
        issues,
      })
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scope,
    namespaceFilesByLanguage: namespaceSetByLang,
    missingByLang,
    todoByLang,
    nonKeyedLiteralFindings: literals,
  }

  return report
}

function toMarkdown(report) {
  const lines = []
  lines.push('# i18n Gap Inventory')
  lines.push('')
  lines.push(`Generated: ${report.generatedAt}`)
  lines.push('')
  lines.push('## Scope')
  lines.push('')
  lines.push(`- Excluded namespaces: ${report.scope.excludedNamespaces.join(', ') || '(none)'}`)
  lines.push(`- Excluded source globs: ${report.scope.excludedSourceGlobs.join(', ') || '(none)'}`)
  lines.push('')

  lines.push('## Namespace file parity')
  lines.push('')
  for (const [lang, list] of Object.entries(report.namespaceFilesByLanguage)) {
    lines.push(`- ${lang}: ${list.length} files`)
  }
  lines.push('')

  lines.push('## Missing keys by language (non-EN, non-marketing namespaces)')
  lines.push('')
  for (const [lang, byNs] of Object.entries(report.missingByLang)) {
    const ns = Object.keys(byNs)
    if (ns.length === 0) {
      lines.push(`- ${lang}: none`)
      continue
    }
    lines.push(`- ${lang}:`)
    for (const name of ns) {
      lines.push(`  - ${name}: ${byNs[name].length}`)
    }
  }
  lines.push('')

  lines.push('## [TODO] placeholders by language (non-marketing namespaces)')
  lines.push('')
  for (const [lang, byNs] of Object.entries(report.todoByLang)) {
    const ns = Object.keys(byNs)
    if (ns.length === 0) {
      lines.push(`- ${lang}: none`)
      continue
    }
    lines.push(`- ${lang}:`)
    for (const name of ns) {
      lines.push(`  - ${name}: ${byNs[name].length}`)
    }
  }
  lines.push('')

  lines.push('## Non-keyed literal findings (in-scope source only)')
  lines.push('')
  if (report.nonKeyedLiteralFindings.length === 0) {
    lines.push('- none')
  } else {
    for (const finding of report.nonKeyedLiteralFindings) {
      lines.push(`- ${finding.file}`)
      for (const issue of finding.issues) {
        lines.push(`  - line ${issue.line}: "${issue.text}"`)
      }
    }
  }
  lines.push('')

  return `${lines.join('\n')}\n`
}

const report = buildReport()
mkdirSync(REPORT_DIR, { recursive: true })
writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2))
writeFileSync(REPORT_MD, toMarkdown(report))

console.log(`[i18n] Gap report written:`)
console.log(`  - ${relative(PROJECT_ROOT, REPORT_MD)}`)
console.log(`  - ${relative(PROJECT_ROOT, REPORT_JSON)}`)
