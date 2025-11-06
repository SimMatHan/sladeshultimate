import { Link } from 'react-router-dom'
import { Page } from './Home'

export default function More() {
  return (
    <Page title="More">
      <ul className="list">
        <li><Link to="/manage-channels">Manage Channels</Link></li>
        <li><Link to="/manage-profile">Manage Profile</Link></li>
        <li><button onClick={() => {
          localStorage.removeItem('signedIn')
          localStorage.removeItem('onboarded')
          location.href = '/'
        }}>Sign out</button></li>
      </ul>
    </Page>
  )
}
