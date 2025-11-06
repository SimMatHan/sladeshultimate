import { Link, useNavigate } from 'react-router-dom'

function Page({ title, children }) {
  return <div className="auth">{children}</div>
}

export default function SignIn() {
  const nav = useNavigate()
  const submit = (e) => {
    e.preventDefault()
    localStorage.setItem('signedIn', '1')
    nav('/onboarding', { replace: true })
  }
  return (
    <Page>
      <h2>Sign In</h2>
      <form onSubmit={submit} className="form">
        <input placeholder="Email" required />
        <input placeholder="Password" type="password" required />
        <button type="submit">Continue</button>
      </form>
      <p>Ny bruger? <Link to="/sign-up">Sign Up</Link></p>
    </Page>
  )
}
