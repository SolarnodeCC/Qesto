import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as amplitude from '@amplitude/unified'
import App from './App'
import { initI18n } from './i18n'
import './styles.css'

amplitude.initAll(import.meta.env.VITE_AMPLITUDE_API_KEY as string, {
  analytics: {
    serverUrl: 'https://api.eu.amplitude.com/2/httpapi', // EU data residency endpoint
    remoteConfig: { fetchRemoteConfig: true }, // remote SDK config from Amplitude
    autocapture: {
      attribution: true,           // UTM / referrer attribution events
      pageViews: true,             // SPA route changes + initial load
      sessions: true,              // Session start / end events
      formInteractions: true,      // Form starts + submits
      fileDownloads: true,         // Downloads of common file types
      elementInteractions: true,   // Click + change on instrumented els
      frustrationInteractions: true, // Rage clicks, dead clicks
      pageUrlEnrichment: true,     // Adds path / search to event props
      networkTracking: true,       // XHR + fetch request events
      webVitals: true,             // CWV (LCP, INP, CLS) on page hide
    },
  },
  sessionReplay: { sampleRate: 1 }, // Record user sessions; comment out to disable
  engagement: {},                   // In-product Guides & Surveys; comment out to disable
})

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

async function mount() {
  // Pre-load translations before first paint so components never see raw i18n keys.
  // The try/catch inside initI18n ensures a fetch failure degrades to showing keys,
  // never a blank page.
  await initI18n()
  createRoot(root!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

void mount()
