import { NavLink, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/home', label: 'Home', Icon: HomeIcon, end: true, additionalActivePaths: [(pathname) => pathname.startsWith('/drink/')] },
  { to: '/leaderboard', label: 'Score', Icon: TrophyIcon },
  { to: '/sladesh', label: 'Sladesh', Icon: SparkIcon },
  { to: '/map', label: 'Map', Icon: MapIcon },
  { to: '/more', label: 'More', Icon: MenuIcon, additionalActivePaths: ['/manage-channels', '/manage-profile', '/admin'] },
]

function Item({ to, label, Icon, end, additionalActivePaths = [] }) {
  const location = useLocation()
  
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className={({ isActive }) => {
        const isAdditionalActive = additionalActivePaths.some((extra) => {
          if (typeof extra === 'function') {
            return extra(location.pathname)
          }
          return location.pathname === extra
        })
        const shouldBeActive = isActive || isAdditionalActive
        return `flex flex-col items-center justify-center text-xs transition-colors ${
          shouldBeActive 
            ? 'text-[color:var(--brand,#FF385C)]' 
            : 'text-[color:var(--muted,#717171)]'
        }`
      }}
    >
      <span className="leading-none mb-1" aria-hidden="true">
        <Icon className="w-6 h-6" focusable="false" />
      </span>
      <span className="leading-none text-[11px] font-medium">{label}</span>
    </NavLink>
  )
}

export default function TabBar() {
  return (
    <nav className="h-16 grid grid-cols-5" aria-label="Primary navigation">
      {tabs.map((tab) => (
        <Item key={tab.to} {...tab} />
      ))}
    </nav>
  )
}

function HomeIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M6.5 12.5v7a1.5 1.5 0 0 0 1.5 1.5H11v-4.5h2V21h3a1.5 1.5 0 0 0 1.5-1.5v-7" />
    </svg>
  )
}

function TrophyIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7 4h10v2.2a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V4Z" />
      <path d="M5 6a3 3 0 0 0 3 3" />
      <path d="M19 6a3 3 0 0 1-3 3" />
      <path d="M12 10v4.5" />
      <path d="M9.5 14.5h5" />
      <path d="M9 19h6" />
    </svg>
  )
}

function SparkIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 5.2 13.4 9l4.1 1.2-4.1 1.2L12 15.2 10.6 11.4 6.5 10.2l4.1-1.2Z" />
      <path d="m7.5 18.5 1.8-1.6" />
      <path d="m16.5 18.5-1.8-1.6" />
      <path d="m5.8 6.2 1.6 1.5" />
      <path d="m18.2 6.2-1.6 1.5" />
    </svg>
  )
}

function MapIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m9 4.5-5.5 2.5v12.5l5.5-2.5L15 19.5l5.5-2.5V4.5L15 7Z" />
      <path d="M9 4.5v12.5" />
      <path d="M15 7v12.5" />
      <path d="m9 9.5 6-2.5" />
    </svg>
  )
}

function MenuIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <circle cx="5.5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18.5" cy="12" r="1.4" />
    </svg>
  )
}
