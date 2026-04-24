type LocaleMap = Record<string, Record<string, string>>

const NAMESPACES = ['admin', 'auth', 'common', 'components', 'dashboard', 'errors', 'home', 'insights', 'join', 'launchpad', 'login', 'not-found', 'present', 'results', 'session-config', 'sessions', 'solutions', 'vote', 'wizard']

let cachedLocales: LocaleMap = {}
let currentLanguage = 'en'
let initPromise: Promise<void> | null = null

export const SUPPORTED_LANGUAGES = ['en', 'nl', 'es', 'de', 'fr'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const LANG_STORAGE_KEY = 'qesto_lang'

export function detectLanguage(): string {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) return stored
  } catch {
    // Storage unavailable (private browsing, quota exceeded, disabled)
  }
  const browserLang = navigator.language.slice(0, 2)
  return SUPPORTED_LANGUAGES.includes(browserLang as SupportedLanguage) ? browserLang : 'en'
}

export function setLanguage(lang: SupportedLanguage): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // Storage unavailable; reload without persisting preference
    console.warn('[i18n] Failed to persist language preference')
  }
  window.location.reload()
}

async function fetchNamespace(language: string, namespace: string): Promise<[string, Record<string, string>]> {
  let localizedData: Record<string, string> | null = null
  try {
    const res = await fetch(`/locales/${language}/${namespace}.json`)
    if (res.ok) {
      const data = await res.json() as Record<string, string>
      // Guard against Pages returning index.html (SPA fallback) instead of JSON.
      if (typeof data === 'object' && data !== null) localizedData = data
    }
  } catch {
    // Network error or JSON parse failure (e.g. Pages served HTML fallback).
  }

  // Use English as baseline and overlay locale keys to prevent raw-key rendering
  // when locale files are incomplete.
  if (language !== 'en') {
    try {
      const enRes = await fetch(`/locales/en/${namespace}.json`)
      if (enRes.ok) {
        const enData = await enRes.json() as Record<string, string>
        if (typeof enData === 'object' && enData !== null) {
          return [namespace, localizedData ? { ...enData, ...localizedData } : enData]
        }
      }
    } catch {
      // Ignore fallback failure and continue to best effort below.
    }
  }

  if (localizedData) return [namespace, localizedData]

  console.warn(`[i18n] Failed to load namespace '${namespace}' for '${language}'`)
  return [namespace, {}]
}

// Call once before rendering the React app to avoid showing raw keys on first paint.
export async function initI18n(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    const language = detectLanguage()
    currentLanguage = language
    try {
      const entries = await Promise.all(NAMESPACES.map((ns) => fetchNamespace(language, ns)))
      cachedLocales = Object.fromEntries(entries)
    } catch (err) {
      console.error('[i18n] Failed to load translations, UI will show keys as fallback:', err)
    }
  })()
  return initPromise
}

function resolveDotPath(obj: Record<string, unknown>, key: string): string | undefined {
  if (key in obj) return obj[key] as string | undefined
  const parts = key.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

function translate(namespace: string, key: string, vars?: Record<string, string | number>): string {
  const ns = cachedLocales[namespace] as Record<string, unknown> | undefined
  if (!ns) {
    console.warn(`[i18n] Namespace '${namespace}' not loaded`)
    return key
  }
  const resolved = resolveDotPath(ns, key)
  if (!resolved) {
    console.warn(`[i18n] Missing key '${namespace}.${key}'`)
    return key
  }
  if (!vars) return resolved
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)).replace(`{${k}}`, String(v)),
    resolved,
  )
}

// Synchronous after initI18n() has resolved — no per-hook loading state needed.
export function useT(namespace: string) {
  return (key: string, vars?: Record<string, string | number>): string =>
    translate(namespace, key, vars)
}

export function getLoadedLocales(): LocaleMap {
  return cachedLocales
}

export function getCurrentLanguage(): string {
  return currentLanguage
}
