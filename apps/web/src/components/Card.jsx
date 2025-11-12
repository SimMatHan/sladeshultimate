// apps/web/src/components/Card.jsx

export default function Card({
  as: Component = "div",
  bare = false,
  className = "",
  children,
  ...props
}) {
  const baseClasses = bare
    ? "rounded-[28px] border border-neutral-200 bg-white"
    : "rounded-[28px] border border-neutral-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.05)]";

  return (
    <Component className={`${baseClasses} ${className}`} {...props}>
      {children}
    </Component>
  );
}

