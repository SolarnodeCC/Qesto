import { useEffect, useState } from 'react'

type LocaleMap = Record<string, Record<string, string>>

let cachedLocales: LocaleMap = {}
let currentLanguage = 'en'

/**
 * Detect user language preference
 * Matches navigator.language against available languages
 * Falls back to 'en' if no match found
 */
export function detectLanguage(): string {
  const browserLang = navigator.language.slice(0, 2)
  const availableLanguages = ['en', 'nl', 'es', 'de', 'fr']
  return availableLanguages.includes(browserLang) ? browserLang : 'en'
}

/**
 * Load all translation files for a given language
 */
async function loadLocales(language: string): Promise<LocaleMap> {
  const locales: LocaleMap = {}
  const namespaces = ['common', 'home', 'login', 'auth', 'dashboard', 'session-config', 'present', 'join', 'results', 'not-found', 'wizard']

  try {
    for (const namespace of namespaces) {
      const url = `/locales/${language}/${namespace}.json`
      const response = await fetch(url)
      if (response.ok) {
        locales[namespace] = await response.json()
      } else {
        console.warn(`[i18n] Failed to load ${namespace} for ${language}`)
        // Fallback to English if translation missing
        if (language !== 'en') {
          const enResponse = await fetch(`/locales/en/${namespace}.json`)
          if (enResponse.ok) {
            locales[namespace] = await enResponse.json()
          }
        }
      }
    }
  } catch (error) {
    console.error('[i18n] Error loading locales:', error)
  }

  return locales
}

/**
 * Translate a key with optional variable interpolation
 * Variables are replaced in format: {varName}
 * Falls back to key itself if not found (surfaces missing translations in dev)
 */
function translate(
  namespace: string,
  key: string,
  vars?: Record<string, string | number>
): string {
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

  // Variable interpolation: supports both {var} and {{var}} formats
  if (vars) {
    Object.entries(vars).forEach(([varKey, varValue]) => {
      value = value.replace(`{{${varKey}}}`, String(varValue))
      value = value.replace(`{${varKey}}`, String(varValue))
    })
  }

  return value
}

/**
 * Hook to get translation function for a namespace
 * Loads translations on mount
 * Usage:
 *   const t = useT('home')
 *   t('title') // returns translated string
 *   t('welcome', { name: 'John' }) // with variables
 */
export function useT(namespace: string) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    async function init() {
      if (Object.keys(cachedLocales).length === 0) {
        const detected = detectLanguage()
        currentLanguage = detected
        cachedLocales = await loadLocales(detected)
      }
      setIsLoaded(true)
    }

    init()
  }, [])

  return (key: string, vars?: Record<string, string | number>): string => {
    if (!isLoaded) {
      // Avoid console-noise during initial render before locale bundles resolve.
      return key
    }
    return translate(namespace, key, vars)
  }
}

/**
 * Get all currently loaded locales (for testing/debugging)
 */
export function getLoadedLocales(): LocaleMap {
  return cachedLocales
}

/**
 * Get current language
 */
export function getCurrentLanguage(): string {
  return currentLanguage
}
