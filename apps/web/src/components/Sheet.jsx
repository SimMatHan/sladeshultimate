import { useEffect, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

const DEFAULT_TOPBAR_OFFSET = "var(--topbar-height, 48px)";
const TABBAR_OFFSET = "var(--tabbar-height, 57px)";

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
  const [topOffset, setTopOffset] = useState(DEFAULT_TOPBAR_OFFSET);

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

  useLayoutEffect(() => {
    if (!shouldRender || position !== "top" || typeof window === "undefined") return undefined;

    const updateTopOffset = () => {
      const topbar = document.querySelector(".topbar");
      if (topbar) {
        const { bottom } = topbar.getBoundingClientRect();
        setTopOffset(`${bottom}px`);
      } else {
        setTopOffset(DEFAULT_TOPBAR_OFFSET);
      }
    };

    updateTopOffset();

    window.addEventListener("resize", updateTopOffset);
    window.addEventListener("orientationchange", updateTopOffset);

    return () => {
      window.removeEventListener("resize", updateTopOffset);
      window.removeEventListener("orientationchange", updateTopOffset);
    };
  }, [position, shouldRender]);

  if (!shouldRender || typeof document === "undefined") return null;

  const isTop = position === "top";
  const isCenter = position === "center";
  const backdropOpacity = isVisible ? "opacity-100" : "opacity-0";

  let sheetTransform = "";
  if (isCenter) {
    sheetTransform = isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0";
  } else if (isTop) {
    sheetTransform = isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0";
  } else {
    sheetTransform = isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0";
  }

  let borderRadius = {};
  if (isCenter) {
    borderRadius = { borderRadius: "24px" };
  } else if (isTop) {
    borderRadius = {
      borderBottomLeftRadius: "32px",
      borderBottomRightRadius: "32px",
    };
  } else {
    borderRadius = {
      borderTopLeftRadius: "32px",
      borderTopRightRadius: "32px",
    };
  }

  const justifyContent = isCenter ? "justify-center items-center p-4" : (isTop ? "justify-start" : "justify-end");

  const topInset = isTop ? topOffset : 0;
  const bottomInset = isTop ? 0 : TABBAR_OFFSET;

  const overlayContent = (
    <div
      className={`fixed inset-0 flex flex-col ${justifyContent}`}
      style={{
        zIndex,
        pointerEvents: "none",
        left: 0,
        right: 0,
        top: isCenter ? 0 : topInset,
        bottom: isCenter ? 0 : bottomInset,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "sheet-title" : undefined}
      aria-describedby={description ? "sheet-description" : undefined}
    >
      {/* Backdrop - positioned to not cover navigation bars */}
      <div
        className={`sheet-backdrop absolute transition-opacity ease-out ${backdropOpacity}`}
        style={{
          top: isCenter ? 0 : topInset,
          bottom: isCenter ? 0 : TABBAR_OFFSET,
          left: 0,
          right: 0,
          transitionDuration: `${animationDuration}ms`,
          pointerEvents: "auto",
          backgroundColor: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <div
        className={`sheet-panel relative z-10 w-full flex flex-col transition-all ease-out ${sheetTransform} ${className}`}
        style={{
          ...borderRadius,
          height: isCenter ? (typeof height === "string" ? height : `${height}px`) : (typeof height === "string" ? height : `${height}px`),
          maxHeight: isCenter ? "85vh" : undefined,
          maxWidth: isCenter ? "400px" : undefined,
          transitionDuration: `${animationDuration}ms`,
          pointerEvents: 'auto'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header (if title or description provided) */}
        {(title || description) && (
          <div
            className="px-6 pb-4 flex-none"
            style={{
              paddingTop: isTop ? "10px" : "24px",
            }}
          >
            <div>
              {title && (
                <div
                  id="sheet-title"
                  className="text-lg font-semibold"
                  style={{ color: 'var(--ink)' }}
                >
                  {title}
                </div>
              )}
              {description && (
                <p
                  id="sheet-description"
                  className="mt-1 text-xs"
                  style={{ color: 'var(--muted)' }}
                >
                  {description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-6 overscroll-y-contain pb-[calc(env(safe-area-inset-bottom,0px)+16px)]"
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(overlayContent, document.body);
}

