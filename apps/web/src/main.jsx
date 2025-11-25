import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LocationProvider } from './contexts/LocationContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { UserDataProvider } from './contexts/UserDataContext'
import App from './App.jsx'
import './index.css'
import { initServiceWorkerUpdates } from './utils/serviceWorkerUpdates'

/**
 * Try to lock orientation via Screen Orientation API when available.
 * Always fall back to a CSS-based blocker so landscape mode never exposes the UI.
 */
const orientationBlockClass = 'orientation-lock--landscape'

const updateLandscapeFallbackClass = () => {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  const isLandscape = window.matchMedia?.('(orientation: landscape)')?.matches

  if (isLandscape) {
    html.classList.add(orientationBlockClass)
  } else {
    html.classList.remove(orientationBlockClass)
  }
}

const lockOrientationToPortrait = async () => {
  try {
    if (window.screen?.orientation?.lock) {
      await window.screen.orientation.lock('portrait')
    }
  } catch {
    // ignored – we fall back to CSS overlay
  } finally {
    updateLandscapeFallbackClass()
  }
}

const bootstrapOrientationLock = () => {
  lockOrientationToPortrait()
  updateLandscapeFallbackClass()

  ;['orientationchange', 'resize'].forEach((eventName) => {
    window.addEventListener(eventName, updateLandscapeFallbackClass, { passive: true })
  })
}

if (typeof window !== 'undefined' && !window.__slaOrientationLockInitialized) {
  window.__slaOrientationLockInitialized = true
  bootstrapOrientationLock()
}

if (typeof window !== 'undefined') {
  initServiceWorkerUpdates()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LocationProvider>
          <UserDataProvider>
            <App />
          </UserDataProvider>
        </LocationProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
