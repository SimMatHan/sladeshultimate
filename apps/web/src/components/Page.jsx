import AppShell from "./AppShell";

export default function Page({ title, children, TopRight }) {
  // Note: AppShell is already used in routes.jsx, so this component
  // is kept for backward compatibility and just renders children.
  // The title is handled by AppShell via route configuration.
  return <>{children}</>;
}
