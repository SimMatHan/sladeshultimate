import { useCallback, useEffect, useMemo, useState } from 'react'

function detectStandalone() {
  if (typeof window === 'undefined') return false

  try {
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) {
      return true
    }

    if (window.navigator?.standalone === true) {
      return true
    }
  } catch {
    // ignore detection issues (older browsers)
  }

  return false
}

export default function useDisplayMode() {
  const [isStandalone, setIsStandalone] = useState(() => detectStandalone())
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  const isIos = useMemo(() => {
    if (typeof window === 'undefined') return false
    return /iphone|ipad|ipod/i.test(window.navigator?.userAgent || '')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia?.('(display-mode: standalone)')

    const handleChange = () => setIsStandalone(detectStandalone())
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setIsStandalone(detectStandalone())
      }
    }
    const handleAppInstalled = () => setIsStandalone(true)

    mediaQuery?.addEventListener?.('change', handleChange)
    mediaQuery?.addListener?.(handleChange) // Safari <15
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      mediaQuery?.removeEventListener?.('change', handleChange)
      mediaQuery?.removeListener?.(handleChange)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return null

    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return result
  }, [deferredPrompt])

  return {
    isStandalone,
    canPromptInstall: !!deferredPrompt,
    handleInstallClick,
    isIos,
  }
}

