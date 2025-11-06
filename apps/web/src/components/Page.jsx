// apps/web/src/components/Page.jsx
export function Page({ title, children, actions }) {
  return (
    <section className="page">
      <header className="page-header">
        <h1>{title}</h1>
        <div className="actions">{actions}</div>
      </header>
      <div className="page-body">{children}</div>
    </section>
  );
}
