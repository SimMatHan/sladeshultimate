import { Outlet } from 'react-router-dom'
import TabBar from './TabBar'

export default function AppShell() {
  return (
    <div className="app">
      <main className="content">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
