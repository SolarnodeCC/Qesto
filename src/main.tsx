import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initI18n } from './i18n'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

// Pre-load all translation namespaces in parallel before first paint so
// components never see raw i18n keys.
initI18n().then(() => {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
})
