import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

import AppShell from './components/AppShell'

import Splash from './pages/Splash'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import Sladesh from './pages/Sladesh'
import Map from './pages/Map'
import More from './pages/More'
import ManageChannels from './pages/ManageChannels'
import ManageProfile from './pages/ManageProfile'

/** Simple “guards” baseret på localStorage – KUN til skald/test */
const isSignedIn = () => localStorage.getItem('signedIn') === '1'
const isOnboarded = () => localStorage.getItem('onboarded') === '1'

function SplashRouter() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isSignedIn()) return navigate('/sign-in', { replace: true })
      if (!isOnboarded()) return navigate('/onboarding', { replace: true })
      return navigate('/home', { replace: true })
    }, 900)
    return () => clearTimeout(t)
  }, [navigate])
  return <Splash />
}

function GuardOnboard({ children }) {
  if (!isSignedIn()) return <Navigate to="/sign-in" replace />
  return children
}
function GuardApp({ children }) {
  if (!isSignedIn()) return <Navigate to="/sign-in" replace />
  if (!isOnboarded()) return <Navigate to="/onboarding" replace />
  return children
}

export default function RoutesView() {
  return (
    <Routes>
      <Route path="/" element={<SplashRouter />} />

      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/sign-up" element={<SignUp />} />

      <Route path="/onboarding" element={
        <GuardOnboard>
          <Onboarding />
        </GuardOnboard>
      } />

      {/* App-ruter i et fælles shell med bundnavigation */}
      <Route path="/" element={
        <GuardApp>
          <AppShell />
        </GuardApp>
      }>
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
