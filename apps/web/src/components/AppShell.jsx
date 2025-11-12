import { Outlet, useLocation } from 'react-router-dom'
import TabBar from './TabBar'
import TopBar from './TopBar'

const PAGE_TITLES = {
  '/home': { title: 'Name', subtitle: 'Profile' },
  '/leaderboard': { title: 'Leaderboard', subtitle: null },
  '/sladesh': { title: 'Sladesh', subtitle: null },
  '/map': { title: 'Map', subtitle: null },
  '/more': { title: 'More', subtitle: null },
  '/manage-channels': { title: 'Manage Channels', subtitle: null },
  '/manage-profile': { title: 'Manage Profile', subtitle: null },
}

export default function AppShell() {
  const location = useLocation()
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'Sladesh', subtitle: null }

  return (
    <div className="app">
      <TopBar 
        title={pageInfo.title} 
        subtitle={pageInfo.subtitle}
        className="topbar-fixed"
      />
      <main className="content">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
