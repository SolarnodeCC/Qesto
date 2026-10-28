import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initI18n } from './i18n'
import { initNativePush } from './lib/native-push-client'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

function mount() {
  // Render immediately — do NOT block first paint on translations. English is
  // bundled and seeded synchronously in ./i18n, so components resolve real copy
  // on the first paint with no network wait (this removes ~2.5s of LCP render
  // delay that the blocking `await initI18n()` previously added). initI18n runs
  // in the background: for non-English visitors it fetches their locale and the
  // UI re-renders via the useSyncExternalStore subscription once it arrives.
  void initI18n()
  // NATIVE-GA-01: register for native push on shell init (no-op in the browser).
  initNativePush()
  createRoot(root!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

// After a deploy, an already-open tab still references the previous build's
// hashed chunks, which no longer exist — Pages answers them with the SPA
// fallback HTML and the lazy import fails. Reload once to pick up the new
// build; the timestamp guard stops a reload loop if the chunk is truly broken.
const CHUNK_RELOAD_KEY = 'qesto:chunk-reload-at'
window.addEventListener('vite:preloadError', (event) => {
  try {
    // jankurai:allow websec.storage.token reason=reload-timestamp-not-a-credential expires=2027-06-01
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0)
    if (Date.now() - last < 10_000) return
    // jankurai:allow websec.storage.token reason=reload-timestamp-not-a-credential expires=2027-06-01
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  } catch {
    // Storage unavailable — fall through and reload once without the guard.
  }
  event.preventDefault()
  window.location.reload()
})

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

mount()
