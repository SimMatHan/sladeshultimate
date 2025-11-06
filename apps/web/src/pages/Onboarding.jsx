import { useNavigate } from 'react-router-dom'

export default function Onboarding() {
  const nav = useNavigate()
  const done = () => {
    localStorage.setItem('onboarded', '1')
    nav('/home', { replace: true })
  }
  return (
    <div className="onboarding">
      <h2>Onboarding</h2>
      <ol className="bullets">
        <li>Vælg kanal</li>
        <li>Aktivér push (hvis ikke gjort)</li>
        <li>Invitér venner</li>
      </ol>
      <button onClick={done}>Færdig</button>
    </div>
  )
}
