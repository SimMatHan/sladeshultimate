import { Link, useNavigate } from 'react-router-dom'

export default function SignUp() {
  const nav = useNavigate()
  const submit = (e) => {
    e.preventDefault()
    localStorage.setItem('signedIn', '1')
    nav('/onboarding', { replace: true })
  }
  return (
    <div className="auth">
      <h2>Sign Up</h2>
      <form onSubmit={submit} className="form">
        <input placeholder="Name" required />
        <input placeholder="Email" required />
        <input placeholder="Password" type="password" required />
        <button type="submit">Create account</button>
      </form>
      <p>Har du en konto? <Link to="/sign-in">Sign In</Link></p>
    </div>
  )
}
