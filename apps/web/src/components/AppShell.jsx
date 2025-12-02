import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation as useRouteLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import TopBar from './TopBar'
import TabBar from './TabBar'
import { useAuth } from '../hooks/useAuth'
import { addCheckIn, getUser, updateUserLocation } from '../services/userService'
import { incrementCheckInCount } from '../services/statsService'
import { useLocation as useGeoLocation } from '../contexts/LocationContext'
import CheckInContext from '../contexts/CheckInContext'
import { useChannel } from '../hooks/useChannel'
import {
  areNotificationsEnabled,
  ensurePushSubscription,
  getNotificationPermission,
  hasShownPermissionPrompt,
  isPushSupported,
  markPermissionPromptShown,
  requestBrowserPermission
} from '../push'
import { DrinkLogProvider } from '../contexts/DrinkLogContext'
import { AchievementProvider, useAchievements } from '../contexts/AchievementContext'
import AchievementUnlockedOverlay from './AchievementUnlockedOverlay'
import { CATEGORIES } from '../constants/drinks'
import { APP_VERSION } from '../appVersion'

const CHECK_IN_STORAGE_KEY = 'sladesh:checkedIn'
const CHECK_IN_GATE_ACTIVATED_KEY = 'sladesh:checkInGateActivated'
const LAST_SEEN_APP_VERSION_KEY = 'sladesh:lastSeenAppVersion'

const PAGE_TITLES = {
  '/home': { title: null, subtitle: null }, // title and subtitle will be set dynamically
  '/leaderboard': { title: 'Topliste', subtitle: null },
  '/sladesh': { title: 'Sladesh', subtitle: null },
  '/map': { title: 'Kort', subtitle: null },
  '/more': { title: 'Mere', subtitle: null },
  '/manage-channels': { title: 'Administrer kanaler', subtitle: null },
  '/manage-profile': { title: 'Administrer profil', subtitle: null },
  '/notifications': { title: 'Notifikationer', subtitle: null },
  '/admin': { title: 'Adminportal', subtitle: null },
}

export default function AppShell() {
  const location = useRouteLocation()
  const { currentUser } = useAuth()
  const { updateLocation, userLocation } = useGeoLocation()
  const { isChannelSwitching, loading: channelsLoading, selectedChannel, switchChannel } = useChannel()
  const [username, setUsername] = useState(null)
  const [checkedIn, setCheckedIn] = useState(() => {
    try {
      return localStorage.getItem(CHECK_IN_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false)
  const [showCheckInGate, setShowCheckInGate] = useState(() => {
    // Check if gate was already activated in a previous session
    try {
      return localStorage.getItem(CHECK_IN_GATE_ACTIVATED_KEY) === '1'
    } catch {
      return false
    }
  })
  const successOverlayTimeout = useRef(null)
  const checkInGateTimer = useRef(null)
  const drinkMatch = location.pathname.match(/^\/drink\/([^/]+)/)
  const activeCategoryId = drinkMatch ? drinkMatch[1] : null
  const activeCategory = activeCategoryId
    ? CATEGORIES.find((category) => category.id === activeCategoryId)
    : null
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'Sladesh', subtitle: null }
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)
  const [isRequestingNotifications, setIsRequestingNotifications] = useState(false)
  const [notificationError, setNotificationError] = useState(null)
  const [showVersionPopup, setShowVersionPopup] = useState(false)
  const blockingOverlayVisible =
    (!checkedIn && showCheckInGate) || showSuccessOverlay || showNotificationPrompt || showVersionPopup
  const showChannelLoader = isChannelSwitching || (!selectedChannel && channelsLoading)

  // FIXED: Lock scroll region when blocking overlays are visible to prevent background scrolling
  useEffect(() => {
    if (!blockingOverlayVisible && !showChannelLoader) return undefined

    const scrollRegion = document.querySelector('.scroll-region')
    const originalOverflow = scrollRegion ? scrollRegion.style.overflow : null

    if (scrollRegion) {
      scrollRegion.style.overflow = 'hidden'
    }

    return () => {
      if (scrollRegion) {
        scrollRegion.style.overflow = originalOverflow || ''
      }
    }
  }, [blockingOverlayVisible, showChannelLoader])

  // Lurker mode: Show check-in gate after 20 seconds if not checked in
  useEffect(() => {
    if (currentUser && !checkedIn) {
      // If gate was already activated, show it immediately
      const wasActivated = localStorage.getItem(CHECK_IN_GATE_ACTIVATED_KEY) === '1'
      if (wasActivated) {
        setShowCheckInGate(true)
        return
      }

      // Otherwise, start the 20 second timer
      checkInGateTimer.current = setTimeout(() => {
        setShowCheckInGate(true)
        // Mark that gate has been activated (persists across app restarts)
        try {
          localStorage.setItem(CHECK_IN_GATE_ACTIVATED_KEY, '1')
        } catch {
          // ignore storage errors
        }
      }, 20000) // 20 seconds delay

      return () => {
        if (checkInGateTimer.current) {
          clearTimeout(checkInGateTimer.current)
        }
      }
    } else {
      setShowCheckInGate(false)
      // Clear the activation flag when checked in
      if (checkedIn) {
        try {
          localStorage.removeItem(CHECK_IN_GATE_ACTIVATED_KEY)
        } catch {
          // ignore storage errors
        }
      }
    }
  }, [currentUser, checkedIn])

  // Check for new app version on mount
  useEffect(() => {
    try {
      const lastSeenVersion = localStorage.getItem(LAST_SEEN_APP_VERSION_KEY)
      if (lastSeenVersion !== APP_VERSION) {
        setShowVersionPopup(true)
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    if (!currentUser || !isPushSupported()) {
      setShowNotificationPrompt(false)
      return
    }
    // Don't show notification prompt if notifications are disabled
    if (!areNotificationsEnabled()) {
      setShowNotificationPrompt(false)
      return
    }
    const permission = getNotificationPermission()
    if (permission === 'default' && !hasShownPermissionPrompt()) {
      setShowNotificationPrompt(true)
      markPermissionPromptShown()
    } else {
      setShowNotificationPrompt(false)
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser?.uid || !isPushSupported()) return
    if (getNotificationPermission() !== 'granted') return
    if (!areNotificationsEnabled()) return // Don't set up push subscription if notifications are disabled
    ensurePushSubscription({ currentUser }).catch((error) => {
      console.warn('[push] Unable to sync subscription', error)
    })
  }, [currentUser])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const channelFromQuery = params.get('channel')
    if (!channelFromQuery || !currentUser) return
    if (selectedChannel?.id === channelFromQuery || isChannelSwitching) return
    switchChannel(channelFromQuery)
  }, [location.search, currentUser, selectedChannel, switchChannel, isChannelSwitching])

  // Fetch username from Firestore when on home page
  useEffect(() => {
    if (location.pathname === '/home' && currentUser) {
      const loadUsername = async () => {
        try {
          const userData = await getUser(currentUser.uid)
          if (userData?.username) {
            setUsername(userData.username)
          } else {
            setUsername(null)
          }
        } catch (error) {
          console.error('Error loading username:', error)
          setUsername(null)
        }
      }
      loadUsername()
    } else {
      setUsername(null)
    }
  }, [location.pathname, currentUser])

  // For home page, set title to "Home" and subtitle to username
  const title = (() => {
    if (activeCategory) {
      return activeCategory.name
    }
    if (pageInfo.title === null && location.pathname === '/home') {
      return 'Hjem'
    }
    return pageInfo.title
  })()

  const subtitle = (() => {
    if (activeCategory) {
      return 'Variationer'
    }
    if (pageInfo.subtitle === null && location.pathname === '/home') {
      return username || 'Brugernavn'
    }
    return pageInfo.subtitle
  })()

  const persistCheckedIn = useCallback((nextValue) => {
    setCheckedIn(nextValue)
    try {
      localStorage.setItem(CHECK_IN_STORAGE_KEY, nextValue ? '1' : '0')
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [])

  useEffect(() => {
    const syncCheckInStatus = async () => {
      if (!currentUser) {
        persistCheckedIn(false)
        return
      }
      try {
        const userData = await getUser(currentUser.uid)
        persistCheckedIn(!!userData?.checkInStatus)
      } catch (error) {
        console.error('Error loading check-in status:', error)
      }
    }

    syncCheckInStatus()
  }, [currentUser, persistCheckedIn])

  useEffect(() => {
    return () => {
      if (successOverlayTimeout.current) {
        clearTimeout(successOverlayTimeout.current)
      }
    }
  }, [])

  const handleGlobalCheckIn = useCallback(async () => {
    if (!currentUser) {
      console.error('Cannot check in without an authenticated user')
      return false
    }

    try {
      setIsCheckingIn(true)
      updateLocation()
      const venue = 'Nuværende placering'
      const locationPayload = userLocation || {
        lat: 55.6761,
        lng: 12.5683,
      }

      await addCheckIn(currentUser.uid, {
        venue,
        location: {
          lat: locationPayload.lat,
          lng: locationPayload.lng,
        },
      })

      await updateUserLocation(currentUser.uid, {
        lat: locationPayload.lat,
        lng: locationPayload.lng,
        venue,
      })

      await incrementCheckInCount()
      persistCheckedIn(true)
      setShowSuccessOverlay(true)
      if (successOverlayTimeout.current) {
        clearTimeout(successOverlayTimeout.current)
      }
      successOverlayTimeout.current = setTimeout(() => {
        setShowSuccessOverlay(false)
      }, 2500)
      return true
    } catch (error) {
      console.error('Error saving check-in to Firestore:', error)
      return false
    } finally {
      setIsCheckingIn(false)
    }
  }, [currentUser, persistCheckedIn, updateLocation, userLocation])

  const handleGlobalCheckOut = useCallback(() => {
    persistCheckedIn(false)
    // Reset the gate activation flag when checking out, so user gets 20 seconds again
    try {
      localStorage.removeItem(CHECK_IN_GATE_ACTIVATED_KEY)
    } catch {
      // ignore storage errors
    }
    setShowCheckInGate(false)
  }, [persistCheckedIn])

  const checkInContextValue = {
    checkedIn,
    checkIn: handleGlobalCheckIn,
    checkOut: handleGlobalCheckOut,
    isCheckingIn,
  }

  const handleEnableNotifications = useCallback(async () => {
    setIsRequestingNotifications(true)
    setNotificationError(null)
    try {
      const permission = await requestBrowserPermission()
      if (permission === 'granted' && currentUser) {
        const result = await ensurePushSubscription({ currentUser, forceRefresh: true })
        if (!result.ok) {
          throw new Error('Kunne ikke oprette abonnement. Prøv igen fra debug-skærmen.')
        }
        setShowNotificationPrompt(false)
      } else if (permission !== 'granted') {
        setShowNotificationPrompt(false)
      }
    } catch (error) {
      console.error('[push] Permission flow failed', error)
      setNotificationError(error.message || 'Ukendt fejl')
    } finally {
      setIsRequestingNotifications(false)
    }
  }, [currentUser])

  const handleSkipNotifications = useCallback(() => {
    setShowNotificationPrompt(false)
  }, [])

  const handleCloseVersionPopup = useCallback(() => {
    setShowVersionPopup(false)
    try {
      localStorage.setItem(LAST_SEEN_APP_VERSION_KEY, APP_VERSION)
    } catch {
      // ignore storage errors
    }
  }, [])

  return (
    <CheckInContext.Provider value={checkInContextValue}>
      <DrinkLogProvider>
        <AchievementProvider>
          <div
            className={`app-shell bg-[var(--bg)] text-[color:var(--text)] ${blockingOverlayVisible ? 'pointer-events-none select-none' : ''
              }`}
          >
            <header className="topbar">
              <div className="max-w-[480px] mx-auto px-4 h-full">
                <TopBar
                  title={title}
                  subtitle={subtitle}
                />
              </div>
            </header>

            <main className="scroll-region">
              <div className="mx-auto max-w-[480px] px-4 py-3">
                {/* Avoid rendering two full pages at once (popLayout kept both mounted) */}
                <Outlet key={location.pathname} />
              </div>
            </main>

            <nav className="bottombar">
              <TabBar />
            </nav>
          </div>

          {currentUser && !checkedIn && showCheckInGate && (
            <div className="pointer-events-auto fixed inset-0 z-[1000] flex items-center justify-center bg-black/10 backdrop-blur-md px-6 text-center">
              <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-2xl">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--brand,#FF385C)]/10 text-3xl">
                  📍
                </div>
                <h2 className="mt-6 text-xl font-semibold" style={{ color: 'var(--ink)' }}>
                  Hov hov du, check lige ind!
                </h2>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Du skal checke ind for at bruge Sladesh, dukke op på kortet og komme på toplisten.
                </p>
                <button
                  type="button"
                  onClick={handleGlobalCheckIn}
                  disabled={isCheckingIn}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-ink)' }}
                >
                  {isCheckingIn ? 'Checker ind...' : 'Check ind'}
                </button>
              </div>
            </div>
          )}

          {showSuccessOverlay && (
            <div className="pointer-events-auto fixed inset-0 z-[1100] flex items-center justify-center bg-black/20 backdrop-blur-md px-6 text-center">
              <div className="w-full max-w-sm rounded-3xl border border-emerald-200/60 bg-white/90 p-6 text-center shadow-2xl dark:border-emerald-400/40 dark:bg-slate-900/90">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-3xl text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                  ✅
                </div>
                <h3 className="mt-4 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                  Du er checket ind!
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Velkommen til spillet. Dine stats og din placering er nu live.
                </p>
              </div>
            </div>
          )}

          {showChannelLoader && (
            <div className="pointer-events-auto fixed inset-0 z-[1150] flex items-center justify-center bg-[color:var(--bg,#FFFFFF)]/85 backdrop-blur-sm px-6 text-center transition-opacity">
              <div className="flex flex-col items-center gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-8 py-6 shadow-2xl">
                <div
                  className="h-12 w-12 rounded-full border-4 border-[var(--line)] border-t-[color:var(--brand,#FF385C)] animate-spin"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  Henter kanaldata...
                </p>
              </div>
            </div>
          )}

          {currentUser && showNotificationPrompt && (
            <div className="pointer-events-auto fixed inset-0 z-[1200] flex items-center justify-center bg-black/20 backdrop-blur-md px-6 text-center">
              <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 shadow-2xl">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--brand,#FF385C)]/15 text-2xl">
                  🔔
                </div>
                <h2 className="mt-5 text-xl font-semibold" style={{ color: 'var(--ink)' }}>
                  Aktiver notifikationer
                </h2>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Vi giver kun lyd når der sker noget i dine kanaler. Du kan altid ændre det senere under
                  "Mere" → "Notifikationer".
                </p>
                {notificationError && (
                  <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2 text-xs font-medium text-red-600">
                    {notificationError}
                  </p>
                )}
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleEnableNotifications}
                    disabled={isRequestingNotifications}
                    className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:opacity-60"
                    style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-ink)' }}
                  >
                    {isRequestingNotifications ? 'Aktiverer...' : 'Tænd notifikationer'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipNotifications}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[color:var(--ink)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
                  >
                    Ikke nu
                  </button>
                </div>
              </div>
            </div>
          )}

          {showVersionPopup && (
            <div className="pointer-events-auto fixed inset-0 z-[1250] flex items-center justify-center bg-black/20 backdrop-blur-md px-6 text-center">
              <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 shadow-2xl">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--brand,#FF385C)]/15 text-2xl">
                  🎉
                </div>
                <h2 className="mt-5 text-xl font-semibold" style={{ color: 'var(--ink)' }}>
                  Ny version af Sladesh 🎉
                </h2>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Vi har lige opdateret appen. Hvis bundmenuen (tabbaren) ser lidt mærkelig ud, kan du prøve at trække siden en enkelt gang ned, eller lukke og åbne appen igen – så falder den på plads.
                </p>
                <button
                  type="button"
                  onClick={handleCloseVersionPopup}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
                  style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-ink)' }}
                >
                  Forstået
                </button>
              </div>
            </div>
          )}

          <AchievementOverlayPortal />
        </AchievementProvider>
      </DrinkLogProvider>
    </CheckInContext.Provider>
  )
}

function AchievementOverlayPortal() {
  const { currentUnlockedAchievement, isAchievementOverlayOpen, closeAchievementOverlay } = useAchievements()

  if (!currentUnlockedAchievement || !isAchievementOverlayOpen) {
    return null
  }

  return (
    <AchievementUnlockedOverlay
      achievement={currentUnlockedAchievement}
      onClose={closeAchievementOverlay}
    />
  )
}
