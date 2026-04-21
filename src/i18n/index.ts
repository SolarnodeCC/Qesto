type LocaleMap = Record<string, Record<string, string>>

const NAMESPACES = ['common', 'home', 'login', 'auth', 'dashboard', 'session-config', 'present', 'join', 'results', 'not-found', 'wizard']

let cachedLocales: LocaleMap = {}
let currentLanguage = 'en'
let initPromise: Promise<void> | null = null

export function detectLanguage(): string {
  const browserLang = navigator.language.slice(0, 2)
  const available = ['en', 'nl', 'es', 'de', 'fr']
  return available.includes(browserLang) ? browserLang : 'en'
}

async function fetchNamespace(language: string, namespace: string): Promise<[string, Record<string, string>]> {
  const res = await fetch(`/locales/${language}/${namespace}.json`)
  if (res.ok) return [namespace, await res.json() as Record<string, string>]
  // Fallback to English
  if (language !== 'en') {
    const enRes = await fetch(`/locales/en/${namespace}.json`)
    if (enRes.ok) return [namespace, await enRes.json() as Record<string, string>]
  }
  console.warn(`[i18n] Failed to load ${namespace} for ${language}`)
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

function translate(namespace: string, key: string, vars?: Record<string, string | number>): string {
  const ns = cachedLocales[namespace]
  if (!ns) {
    console.warn(`[i18n] Namespace '${namespace}' not loaded`)
    return key
  }
  let value = ns[key]
  if (!value) {
    console.warn(`[i18n] Missing key '${namespace}.${key}'`)
    return key
  }
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      value = value.replace(`{{${k}}}`, String(v)).replace(`{${k}}`, String(v))
    })
  }
  return value
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
