// apps/web/src/components/Card.jsx

export default function Card({
  as: Component = "div",
  bare = false,
  className = "",
  children,
  ...props
}) {
  const baseClasses = bare
    ? "rounded-[28px] border"
    : "rounded-[28px] border shadow-[0_20px_40px_rgba(15,23,42,0.05)]";

  const baseStyles = {
    borderColor: 'var(--line)',
    backgroundColor: 'var(--surface)',
  };

  return (
    <Component 
      className={`${baseClasses} ${className}`} 
      style={{ ...baseStyles, ...props.style }}
      {...props}
    >
      {children}
    </Component>
  );
}

