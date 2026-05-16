import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Register service worker with update and offline-ready callbacks
const updateSW = registerSW({
  onNeedRefresh() {
    // Dispatch event for UpdatePrompt component to show
    window.dispatchEvent(new CustomEvent('sw:update-available'))
  },
  onOfflineReady() {
    console.log('App ready for offline use')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
