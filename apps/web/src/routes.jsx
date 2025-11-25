import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from './hooks/useAuth'
import { useUserData } from './contexts/UserDataContext'

import AppShell from './components/AppShell'
import InstallPwaGate from './components/InstallPwaGate'
import Splash from './pages/Splash'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import Sladesh from './pages/Sladesh'
import Map from './pages/Map'
import More from './pages/More'
import ManageChannels from './pages/ManageChannels'
import ManageProfile from './pages/ManageProfile'
import AdminPortal from './pages/AdminPortal'
import { isAdminUser } from './config/admin'
import useDisplayMode from './hooks/useDisplayMode'

/** Firebase Auth guards - check if user is authenticated */
function useAuthGuard() {
  const { currentUser, loading } = useAuth()
  return { isSignedIn: !!currentUser, loading }
}

function SplashRouter() {
  const navigate = useNavigate()
  const { isSignedIn, loading } = useAuthGuard()
  const { loading: userDataLoading } = useUserData()
  const [minDelayPassed, setMinDelayPassed] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)
  
  // Set minimum delay timer (3.5 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinDelayPassed(true)
    }, 3500)
    
    return () => clearTimeout(timer)
  }, [])
  
  // Navigate only when auth loading, user data loading, AND minimum delay have all completed
  useEffect(() => {
    // Wait for auth to load, user data to load, and minimum delay to pass
    if (loading || userDataLoading || !minDelayPassed) return
    
    // Trigger exit animation first
    setShouldExit(true)
    
    // Wait for exit animation to complete (0.4s) before navigating
    const navigateTimer = setTimeout(() => {
      // Check localStorage for onboarding status (can be updated later to use Firestore)
      const isOnboarded = localStorage.getItem('onboarded') === '1'
      
      if (!isSignedIn) return navigate('/auth?mode=signin', { replace: true })
      if (!isOnboarded) return navigate('/onboarding', { replace: true })
      return navigate('/home', { replace: true })
    }, 400) // Match exit animation duration
    
    return () => clearTimeout(navigateTimer)
  }, [navigate, isSignedIn, loading, userDataLoading, minDelayPassed])
  
  return (
    <AnimatePresence mode="wait" onExitComplete={() => {}}>
      {!shouldExit && <Splash key="splash" />}
    </AnimatePresence>
  )
}

function GuardOnboard({ children }) {
  const { isSignedIn, loading } = useAuthGuard()
  
  if (loading) return <div>Indlæser...</div> // Or a loading component
  if (!isSignedIn) return <Navigate to="/auth?mode=signin" replace />
  
  // Check localStorage for onboarding status (can be updated later to use Firestore)
  const isOnboarded = localStorage.getItem('onboarded') === '1'
  if (isOnboarded) return <Navigate to="/home" replace />
  
  return children
}

function GuardApp({ children }) {
  const { isSignedIn, loading } = useAuthGuard()
  
  if (loading) return <div>Indlæser...</div> // Or a loading component
  if (!isSignedIn) return <Navigate to="/auth?mode=signin" replace />
  
  // Check localStorage for onboarding status (can be updated later to use Firestore)
  const isOnboarded = localStorage.getItem('onboarded') === '1'
  if (!isOnboarded) return <Navigate to="/onboarding" replace />
  
  return children
}

function RequireAdmin({ children }) {
  const { currentUser, loading } = useAuth()

  if (loading) return <div>Indlæser...</div>
  if (!currentUser || !isAdminUser(currentUser)) {
    return <Navigate to="/more" replace />
  }

  return children
}

/** Legacy redirects så gamle links virker */
function RedirectToAuth({ mode = 'signin' }) {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    // Bevar evt. state fra tidligere navigation
    navigate(`/auth?mode=${mode}`, { replace: true, state: location.state })
  }, [navigate, location, mode])
  return null
}

export default function RoutesView() {
  const { isStandalone, canPromptInstall, handleInstallClick, isIos } = useDisplayMode()

  if (!isStandalone) {
    return (
      <InstallPwaGate
        canPromptInstall={canPromptInstall}
        handleInstallClick={handleInstallClick}
        isIos={isIos}
      />
    )
  }

  return (
    <Routes>
      {/* splash -> auth/onboarding/home afhængigt af guards */}
      <Route path="/" element={<SplashRouter />} />

      {/* Samlet auth-side med tabs */}
      <Route path="/auth" element={<Auth />} />

      {/* Legacy: omdiriger gamle ruter til auth med korrekt mode */}
      <Route path="/sign-in" element={<RedirectToAuth mode="signin" />} />
      <Route path="/sign-up" element={<RedirectToAuth mode="signup" />} />

      <Route
        path="/onboarding"
        element={
          <GuardOnboard>
            <Onboarding />
          </GuardOnboard>
        }
      />

      {/* App-ruter i et fælles shell med bundnavigation */}
      <Route
        path="/"
        element={
          <GuardApp>
            <AppShell />
          </GuardApp>
        }
      >
        <Route path="home" element={<Home />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="sladesh" element={<Sladesh />} />
        <Route path="map" element={<Map />} />
        <Route path="more" element={<More />} />
        <Route path="manage-channels" element={<ManageChannels />} />
        <Route path="manage-profile" element={<ManageProfile />} />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminPortal />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
