import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import TopBar from './TopBar'
import TabBar from './TabBar'
import { useAuth } from '../hooks/useAuth'
import { getUser } from '../services/userService'

const PAGE_TITLES = {
  '/home': { title: null, subtitle: null }, // title and subtitle will be set dynamically
  '/leaderboard': { title: 'Leaderboard', subtitle: null },
  '/sladesh': { title: 'Sladesh', subtitle: null },
  '/map': { title: 'Map', subtitle: null },
  '/more': { title: 'More', subtitle: null },
  '/manage-channels': { title: 'Manage Channels', subtitle: null },
  '/manage-profile': { title: 'Manage Profile', subtitle: null },
}

export default function AppShell() {
  const location = useLocation()
  const { currentUser } = useAuth()
  const [username, setUsername] = useState(null)
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'Sladesh', subtitle: null }
  
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
  const title = pageInfo.title === null && location.pathname === '/home'
    ? 'Home'
    : pageInfo.title
  
  const subtitle = pageInfo.subtitle === null && location.pathname === '/home'
    ? (username || 'UserName')
    : pageInfo.subtitle

  return (
    <div className="app-shell bg-[var(--bg)] text-[color:var(--text)]">
      <header className="topbar bg-[var(--bg)]/90 backdrop-blur">
        <div className="max-w-[480px] mx-auto px-4 h-full">
          <TopBar 
            title={title} 
            subtitle={subtitle}
          />
        </div>
      </header>

      <main className="scroll-region">
        <div className="mx-auto max-w-[480px] px-4 py-3">
          <Outlet />
        </div>
      </main>

      <nav className="bottombar bg-[var(--bg)]/90 backdrop-blur">
        <TabBar />
      </nav>
    </div>
  )
}
