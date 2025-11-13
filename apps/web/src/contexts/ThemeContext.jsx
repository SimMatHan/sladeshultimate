import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'sladesh:theme'

export function ThemeProvider({ children }) {
  // Initialize from localStorage or default to light mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) {
      return saved === 'dark'
    }
    // If no saved preference, check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement
    if (isDarkMode) {
      root.setAttribute('data-theme', 'dark')
      root.style.colorScheme = 'dark'
    } else {
      root.removeAttribute('data-theme')
      root.style.colorScheme = 'light'
    }
  }, [isDarkMode])

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev)
  }

  const value = {
    isDarkMode,
    toggleDarkMode,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

