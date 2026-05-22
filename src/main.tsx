import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initI18n } from './i18n'
import './styles.css'

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

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

void mount()
