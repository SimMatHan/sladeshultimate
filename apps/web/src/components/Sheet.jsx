import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Reusable Sheet/Overlay component for top and bottom sheets
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether the sheet is open
 * @param {Function} props.onClose - Callback when sheet should close
 * @param {React.ReactNode} props.children - Content to render inside the sheet
 * @param {'top'|'bottom'} props.position - Position of the sheet (default: 'top')
 * @param {string} props.title - Optional title for the sheet
 * @param {string} props.description - Optional description/subtitle
 * @param {string} props.className - Additional classes for the sheet content
 * @param {string|number} props.height - Height of the sheet (default: 'min(50vh, 460px)')
 * @param {number} props.zIndex - Z-index for the overlay (default: 100)
 * @param {number} props.animationDuration - Animation duration in ms (default: 300)
 */
export default function Sheet({
  open,
  onClose,
  children,
  position = "top",
  title,
  description,
  className = "",
  height = "min(50vh, 460px)",
  zIndex = 100,
  animationDuration = 300,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle mount/unmount with animation timing
  useEffect(() => {
    if (open) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready before starting animation
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    } else {
      setIsVisible(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => setShouldRender(false), animationDuration);
      return () => clearTimeout(timer);
    }
  }, [open, animationDuration]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!shouldRender) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [shouldRender]);

  if (!shouldRender || typeof document === "undefined") return null;

  const isTop = position === "top";
  const backdropOpacity = isVisible ? "opacity-100" : "opacity-0";
  const sheetTransform = isTop
    ? isVisible
      ? "translate-y-0 opacity-100"
      : "-translate-y-full opacity-0"
    : isVisible
    ? "translate-y-0 opacity-100"
    : "translate-y-full opacity-0";

  const borderRadius = isTop
    ? {
        borderBottomLeftRadius: "32px",
        borderBottomRightRadius: "32px",
      }
    : {
        borderTopLeftRadius: "32px",
        borderTopRightRadius: "32px",
      };

  const justifyContent = isTop ? "justify-start" : "justify-end";

  const overlayContent = (
    <div
      className={`fixed inset-0 flex flex-col ${justifyContent}`}
      style={{ zIndex, pointerEvents: 'none' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "sheet-title" : undefined}
      aria-describedby={description ? "sheet-description" : undefined}
    >
      {/* Backdrop - positioned to not cover navigation bars */}
      <div
        className={`absolute bg-black/60 transition-opacity ease-out ${backdropOpacity}`}
        style={{ 
          top: 'var(--topbar-height, 48px)',
          bottom: 'var(--tabbar-height, 57px)',
          left: 0,
          right: 0,
          transitionDuration: `${animationDuration}ms`,
          pointerEvents: 'auto'
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <div
        className={`relative z-10 w-full bg-white transition-all ease-out ${sheetTransform} ${className}`}
        style={{
          ...borderRadius,
          height: typeof height === "string" ? height : `${height}px`,
          transitionDuration: `${animationDuration}ms`,
          pointerEvents: 'auto'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header (if title or description provided) */}
        {(title || description) && (
          <div
            className="px-6 pb-4"
            style={{
              paddingTop: isTop
                ? `calc(env(safe-area-inset-top, 0px) + 24px)`
                : "24px",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                {title && (
                  <div
                    id="sheet-title"
                    className="text-lg font-semibold text-neutral-900"
                  >
                    {title}
                  </div>
                )}
                {description && (
                  <p
                    id="sheet-description"
                    className="mt-1 text-xs text-neutral-500"
                  >
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-xl text-neutral-400 transition-colors hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2"
                aria-label="Close sheet"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div
          className={`${
            title || description
              ? "h-[calc(100%-66px)] overflow-y-auto px-6"
              : "h-full overflow-y-auto px-6"
          } pb-[calc(env(safe-area-inset-bottom,0px)+16px)]`}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(overlayContent, document.body);
}

