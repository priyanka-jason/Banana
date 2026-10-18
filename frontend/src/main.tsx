import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CatalogueProvider } from './data/CatalogueContext'
import { AuthProvider } from './data/AuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CatalogueProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </CatalogueProvider>
  </StrictMode>,
)

// Lets the installed app open offline (public/sw.js). Built site only, so the
// development server's live reload is never served from a stale copy.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => undefined)
  })
}
