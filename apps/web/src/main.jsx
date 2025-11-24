import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LocationProvider } from './contexts/LocationContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { UserDataProvider } from './contexts/UserDataContext'
import App from './App.jsx'
import './index.css'

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
