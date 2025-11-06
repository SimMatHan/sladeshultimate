import { NavLink } from 'react-router-dom'

const Item = ({ to, label }) => (
  <NavLink
    to={to}
    aria-label={label}
    className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}
  >
    {label}
  </NavLink>
)

export default function TabBar() {
  return (
    <nav className="tabbar">
      <Item to="/home" label="Home" />
      <Item to="/leaderboard" label="Score" />
      <Item to="/sladesh" label="Sladesh" />
      <Item to="/map" label="Map" />
      <Item to="/more" label="More" />
    </nav>
  )
}
