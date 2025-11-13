import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './hooks/useAuth'

import AppShell from './components/AppShell'

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

/** Firebase Auth guards - check if user is authenticated */
function useAuthGuard() {
  const { currentUser, loading } = useAuth()
  return { isSignedIn: !!currentUser, loading }
}

function SplashRouter() {
  const navigate = useNavigate()
  const { isSignedIn, loading } = useAuthGuard()
  
  useEffect(() => {
    if (loading) return // Wait for auth to load
    
    const t = setTimeout(() => {
      // Check localStorage for onboarding status (can be updated later to use Firestore)
      const isOnboarded = localStorage.getItem('onboarded') === '1'
      
      if (!isSignedIn) return navigate('/auth?mode=signin', { replace: true })
      if (!isOnboarded) return navigate('/onboarding', { replace: true })
      return navigate('/home', { replace: true })
    }, 900)
    return () => clearTimeout(t)
  }, [navigate, isSignedIn, loading])
  return <Splash />
}

function GuardOnboard({ children }) {
  const { isSignedIn, loading } = useAuthGuard()
  
  if (loading) return <div>Loading...</div> // Or a loading component
  if (!isSignedIn) return <Navigate to="/auth?mode=signin" replace />
  return children
}

function GuardApp({ children }) {
  const { isSignedIn, loading } = useAuthGuard()
  
  if (loading) return <div>Loading...</div> // Or a loading component
  if (!isSignedIn) return <Navigate to="/auth?mode=signin" replace />
  
  // Check localStorage for onboarding status (can be updated later to use Firestore)
  const isOnboarded = localStorage.getItem('onboarded') === '1'
  if (!isOnboarded) return <Navigate to="/onboarding" replace />
  
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
