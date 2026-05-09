import * as amplitude from '@amplitude/unified'

const API_KEY = (import.meta.env.VITE_AMPLITUDE_API_KEY as string | undefined) ?? ''

export function initAnalytics() {
  if (!API_KEY) return
  // initAll() in main.tsx handles SDK initialization
}

export function trackPageViewed(path: string) {
  if (!API_KEY) return
  amplitude.track('page_viewed', { path })
}

export function trackCtaClick(label: string, destination: string) {
  if (!API_KEY) return
  amplitude.track('cta_clicked', { label, destination })
}
