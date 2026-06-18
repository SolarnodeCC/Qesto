import { useSyncExternalStore } from 'react'

type LocaleMap = Record<string, Record<string, string>>
type Listener = () => void

const NAMESPACES = ['admin', 'auth', 'canvas', 'captions', 'common', 'components', 'connect', 'consent', 'dashboard', 'deliberate', 'embed', 'errors', 'home', 'ideate', 'insights', 'join', 'launchpad', 'learn', 'login', 'not-found', 'present', 'results', 'retro', 'session-config', 'sessions', 'settings', 'solutions', 'sovereign', 'stage', 'studio', 'team', 'townhall', 'vote', 'wizard', 'xr']

// English locales are bundled at build time and seeded synchronously below. This
// is the foundation of the non-blocking init: the app can render correct English
// copy on the very first paint without any network round-trip, so first paint
// (and the LCP text element) is never gated on fetching translations. Non-English
// languages still load over the network and overlay onto this English baseline,
// which doubles as the missing-key fallback. (LCP render-delay fix.)
const EN_LOCALES: LocaleMap = (() => {
  const modules = import.meta.glob('../../public/locales/en/*.json', {
    eager: true,
    import: 'default',
  }) as Record<string, Record<string, string>>
  const out: LocaleMap = {}
  for (const [filePath, data] of Object.entries(modules)) {
    const ns = filePath.slice(filePath.lastIndexOf('/') + 1).replace(/\.json$/, '')
    out[ns] = data
  }
  return out
})()

// Seeded with English so `useT` resolves real strings (never raw keys) before any
// async load completes. A non-English load replaces this map and bumps currentLanguage.
let cachedLocales: LocaleMap = { ...EN_LOCALES }
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
  // English needs no network: it is bundled and already seeded into cachedLocales.
  if (lang === 'en') {
    cachedLocales = { ...EN_LOCALES }
    currentLanguage = 'en'
    notifyI18nChanged()
    return
  }
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
  // English is the baseline (bundled) — overlaying locale keys onto it prevents
  // raw-key rendering when a locale file is incomplete, with no extra en fetch.
  const base = EN_LOCALES[namespace] ?? {}
  if (language === 'en') return [namespace, base]

  try {
    const res = await fetch(`/locales/${language}/${namespace}.json`)
    if (res.ok) {
      const data = await res.json() as Record<string, string>
      if (typeof data === 'object' && data !== null) return [namespace, { ...base, ...data }]
    }
  } catch {
    // Network failure — fall through to the bundled English baseline below.
  }

  // Locale missing/unreadable: serve bundled English so the UI never shows raw keys.
  if (Object.keys(base).length === 0) {
    console.warn(`[i18n] Failed to load namespace '${namespace}' for '${language}'`)
  }
  return [namespace, base]
}

// Kick off language detection + load. Safe to call WITHOUT awaiting before render:
// English is bundled and seeded, so the first paint is correct English with no
// network wait (LCP is not gated on translations). For a non-English visitor the
// shell paints in English immediately, then re-renders in their language once the
// locale files arrive — far better than a blank page blocked on ~30–60 fetches.
export async function initI18n(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    const language = detectLanguage() as SupportedLanguage
    updateUrlLanguageParam(language)
    applyDocumentLanguage(language)
    // English is already seeded — nothing to fetch, avoid a redundant store churn.
    if (language === 'en') return
    try {
      await loadLanguage(language)
    } catch (err) {
      console.error('[i18n] Failed to load translations, falling back to English:', err)
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
