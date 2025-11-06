import { Page } from '../components/Page'
export default function Home() {
  return (
    <Page title="Home">
      <p>Startskærm / feed / hurtige actions.</p>
    </Page>
  )
}

// lille shared helper (inline for simplicity)
function _Page({ title, children }) {
  return (
    <section className="page">
      <header className="page-header"><h1>{title}</h1></header>
      <div className="page-body">{children}</div>
    </section>
  )
}
export { _Page as Page }
