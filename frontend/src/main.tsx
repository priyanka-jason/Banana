import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CatalogueProvider } from './data/CatalogueContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CatalogueProvider>
      <App />
    </CatalogueProvider>
  </StrictMode>,
)
