import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LocationProvider } from './contexts/LocationContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { UserDataProvider } from './contexts/UserDataContext'
import App from './App.jsx'
import './index.css'

// Lock screen orientation to portrait mode
if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
  window.screen.orientation.lock('portrait').catch(() => {
    // Orientation lock not supported or failed, CSS will handle it
  })
}

// Prevent orientation change on mobile devices
const handleOrientationChange = () => {
  if (window.orientation !== undefined) {
    // If device is in landscape, show message or rotate back
    if (Math.abs(window.orientation) === 90) {
      // Device is in landscape mode
      // The CSS will handle the visual rotation
    }
  }
}

// Listen for orientation changes
window.addEventListener('orientationchange', handleOrientationChange)
window.addEventListener('resize', handleOrientationChange)

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
