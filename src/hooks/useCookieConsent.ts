import { useCallback, useEffect, useState } from 'react'
import { loadClarity } from '../lib/clarity'
import { readConsent, writeConsent, type ConsentValue } from '../lib/cookie-consent'

/**
 * Manages the analytics cookie-consent decision and loads Microsoft Clarity only
 * once consent is granted (including for returning visitors who accepted earlier).
 */
export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentValue | null>(() => readConsent())

  useEffect(() => {
    if (consent === 'accepted') loadClarity()
  }, [consent])

  const accept = useCallback(() => {
    writeConsent('accepted')
    setConsent('accepted')
  }, [])

  const reject = useCallback(() => {
    writeConsent('rejected')
    setConsent('rejected')
  }, [])

  return { consent, accept, reject }
}
