import { useSyncExternalStore } from 'react'

type LocaleMap = Record<string, Record<string, string>>
type Listener = () => void

const NAMESPACES = ['admin', 'auth', 'canvas', 'captions', 'common', 'components', 'consent', 'dashboard', 'deliberate', 'embed', 'errors', 'home', 'ideate', 'insights', 'join', 'launchpad', 'login', 'not-found', 'present', 'results', 'retro', 'session-config', 'sessions', 'settings', 'solutions', 'stage', 'team', 'townhall', 'vote', 'wizard']

let cachedLocales: LocaleMap = {}
let currentLanguage = 'en'
let initPromise: Promise<void> | null = null
const listeners = new Set<Listener>()
const warnedMissingKeys = new Set<string>()
const warnedMissingVars = new Set<string>()

export const SUPPORTED_LANGUAGES = ['en', 'nl', 'es', 'de', 'fr'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const LANG_STORAGE_KEY = 'qesto_lang'

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return !!value && SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
}

function getLanguageFromUrl(): SupportedLanguage | null {
  try {
    const lang = new URLSearchParams(window.location.search).get('lang')
    return isSupportedLanguage(lang) ? lang : null
  } catch {
    return null
  }
}

function updateUrlLanguageParam(lang: SupportedLanguage): void {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('lang', lang)
    window.history.replaceState(null, '', url.toString())
  } catch {
    // Ignore URL mutation failures.
  }
}

function applyDocumentLanguage(lang: string): void {
  if (typeof document !== 'undefined' && document.documentElement.lang !== lang) {
    document.documentElement.lang = lang
  }
}

function notifyI18nChanged(): void {
  applyDocumentLanguage(currentLanguage)
  for (const listener of listeners) listener()
}

export function detectLanguage(): string {
  const fromUrl = getLanguageFromUrl()
  if (fromUrl) return fromUrl
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    if (isSupportedLanguage(stored)) return stored
  } catch {
    // Storage unavailable (private browsing, quota exceeded, disabled)
  }
  const browserLang = navigator.language.slice(0, 2)
  return isSupportedLanguage(browserLang) ? browserLang : 'en'
}

async function loadLanguage(lang: SupportedLanguage): Promise<void> {
  const entries = await Promise.all(NAMESPACES.map((ns) => fetchNamespace(lang, ns)))
  cachedLocales = Object.fromEntries(entries)
  currentLanguage = lang
  notifyI18nChanged()
}

export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // Storage unavailable; continue with in-memory language switch.
    console.warn('[i18n] Failed to persist language preference')
  }
  updateUrlLanguageParam(lang)
  await loadLanguage(lang)
}

async function fetchNamespace(language: string, namespace: string): Promise<[string, Record<string, string>]> {
  let localizedData: Record<string, string> | null = null
  try {
    const res = await fetch(`/locales/${language}/${namespace}.json`)
    if (res.ok) {
      const data = await res.json() as Record<string, string>
      
      if (typeof data === 'object' && data !== null) localizedData = data
    }
  } catch {
    
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
    const language = detectLanguage() as SupportedLanguage
    updateUrlLanguageParam(language)
    try {
      await loadLanguage(language)
    } catch (err) {
      console.error('[i18n] Failed to load translations, UI will show keys as recovery:', err)
      notifyI18nChanged()
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
  let resolved = resolveDotPath(ns, key)
  if (vars && typeof vars.count === 'number') {
    const category = new Intl.PluralRules(currentLanguage).select(vars.count)
    resolved = resolveDotPath(ns, `${key}_${category}`) ?? resolveDotPath(ns, `${key}_other`) ?? resolved
  }
  if (!resolved) {
    const missingId = `${namespace}.${key}`
    if (!warnedMissingKeys.has(missingId)) {
      warnedMissingKeys.add(missingId)
      console.warn(`[i18n] Missing key '${missingId}'`)
    }
    return key
  }
  if (!vars) return resolved
  let missingVarDetected = false
  const out = resolved.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (full, p1, p2) => {
    const varName = p1 ?? p2
    if (!(varName in vars)) {
      missingVarDetected = true
      return full
    }
    return String(vars[varName]!)
  })
  if (missingVarDetected) {
    const missingVarId = `${namespace}.${key}`
    if (!warnedMissingVars.has(missingVarId)) {
      warnedMissingVars.add(missingVarId)
      console.warn(`[i18n] Missing interpolation vars for '${missingVarId}'`)
    }
  }
  return out
}

// Synchronous after initI18n() has resolved — no per-hook loading state needed.
export function useT(namespace: string) {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => currentLanguage,
    () => currentLanguage,
  )
  return (key: string, vars?: Record<string, string | number>): string =>
    translate(namespace, key, vars)
}

export function getLoadedLocales(): LocaleMap {
  return cachedLocales
}

export function getCurrentLanguage(): string {
  return currentLanguage
}

export function getLanguageHeader(): string {
  return currentLanguage
}
