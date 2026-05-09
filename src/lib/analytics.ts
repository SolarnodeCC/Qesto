import * as amplitude from '@amplitude/analytics-browser'

const API_KEY = (import.meta.env.VITE_AMPLITUDE_API_KEY as string | undefined) ?? ''

export function initAnalytics() {
  if (!API_KEY) return
  amplitude.init(API_KEY, {
    autocapture: false,
  })
}

export function trackPageViewed(path: string) {
  if (!API_KEY) return
  amplitude.track('page_viewed', { path })
}

export function trackCtaClick(label: string, destination: string) {
  if (!API_KEY) return
  amplitude.track('cta_clicked', { label, destination })
}
