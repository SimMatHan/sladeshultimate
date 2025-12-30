import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LocationProvider } from './contexts/LocationContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { UserDataProvider } from './contexts/UserDataContext'
import { SladeshProvider } from './contexts/SladeshContext'
import App from './App.jsx'
import './index.css'
import { initServiceWorkerUpdates } from './utils/serviceWorkerUpdates'
import { IS_DEVELOPMENT } from './config/env'

/**
 * Try to lock orientation via Screen Orientation API when available.
 * Always fall back to a CSS-based blocker so landscape mode never exposes the UI.
 *
 * Dev bypass: simonmathiashansen@gmail.com is exempt from orientation lock in dev mode
 */
const orientationBlockClass = 'orientation-lock--landscape'

const shouldBypassOrientationLock = () => {
  if (!IS_DEVELOPMENT) return false

  try {
    const userDataStr = localStorage.getItem('sladesh:userData')
    if (!userDataStr) return false

    const userData = JSON.parse(userDataStr)
    return userData?.email === 'simonmathiashansen@gmail.com'
  } catch {
    return false
  }
}

const updateLandscapeFallbackClass = () => {
  if (typeof document === 'undefined') return

  // Dev bypass - skip orientation lock for test user
  if (shouldBypassOrientationLock()) {
    document.documentElement.classList.remove(orientationBlockClass)
    return
  }

  const html = document.documentElement
  const isLandscape = window.matchMedia?.('(orientation: landscape)')?.matches

  if (isLandscape) {
    html.classList.add(orientationBlockClass)
  } else {
    html.classList.remove(orientationBlockClass)
  }
}

const lockOrientationToPortrait = async () => {
  // Dev bypass - skip orientation lock for test user
  if (shouldBypassOrientationLock()) {
    updateLandscapeFallbackClass()
    return
  }

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
        <UserDataProvider>
          <LocationProvider>
            <SladeshProvider>
              <App />
            </SladeshProvider>
          </LocationProvider>
        </UserDataProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
