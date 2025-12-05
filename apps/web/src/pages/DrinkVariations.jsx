import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CATEGORIES } from "../constants/drinks";
import { useDrinkVariants } from "../hooks/useDrinkVariants";
import { useDrinkLog } from "../contexts/DrinkLogContext";

export default function DrinkVariations() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const { variantsByCategory } = useDrinkVariants();
  const { variantCounts, adjustVariantCount } = useDrinkLog();
  const touchDataRef = useRef({
    startX: 0,
    startY: 0,
    deltaX: 0,
    deltaY: 0,
    direction: null,
    active: false,
  });
  const categoryRailRef = useRef(null);

  const category = useMemo(
    () => CATEGORIES.find((cat) => cat.id === categoryId),
    [categoryId]
  );
  const categoryIndex = useMemo(
    () => CATEGORIES.findIndex((cat) => cat.id === categoryId),
    [categoryId]
  );

  const items = variantsByCategory?.[categoryId] ?? [];

  const resetScrollPosition = useCallback(() => {
    const scrollRegion = document.querySelector(".scroll-region");
    if (scrollRegion) {
      scrollRegion.scrollTop = 0;
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);

  const navigateToCategory = useCallback(
    (nextCategoryId) => {
      if (!nextCategoryId || nextCategoryId === categoryId) {
        return;
      }
      navigate(`/drink/${nextCategoryId}`);
    },
    [categoryId, navigate]
  );

  const navigateByOffset = useCallback(
    (offset) => {
      if (categoryIndex === -1) {
        return;
      }
      const nextCategory = CATEGORIES[categoryIndex + offset];
      if (nextCategory) {
        navigateToCategory(nextCategory.id);
      }
    },
    [categoryIndex, navigateToCategory]
  );

  const handleTouchStart = useCallback((event) => {
    const touch = event.touches[0];
    touchDataRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      deltaY: 0,
      direction: null,
      active: true,
    };
  }, []);

  const handleTouchMove = useCallback((event) => {
    const touch = event.touches[0];
    const data = touchDataRef.current;
    if (!data.active) {
      return;
    }
    data.deltaX = touch.clientX - data.startX;
    data.deltaY = touch.clientY - data.startY;

    if (!data.direction) {
      const absX = Math.abs(data.deltaX);
      const absY = Math.abs(data.deltaY);
      if (absX > 10 || absY > 10) {
        data.direction = absX > absY ? "horizontal" : "vertical";
      }
    }
    
    // FIXED: Never prevent default or interfere with vertical scrolling.
    // Only handle horizontal swipes for category navigation.
    // Vertical scrolling is handled by the native .scroll-region container.
  }, []);

  const handleTouchEnd = useCallback(() => {
    const data = touchDataRef.current;
    if (!data.active) {
      return;
    }
    data.active = false;

    const SWIPE_THRESHOLD = 60;
    const { deltaX, direction } = data;
    if (direction !== "horizontal" || Math.abs(deltaX) < SWIPE_THRESHOLD) {
      return;
    }

    if (deltaX < 0) {
      navigateByOffset(1);
    } else {
      navigateByOffset(-1);
    }
  }, [navigateByOffset]);

  useEffect(() => {
    if (!category) {
      navigate("/home", { replace: true });
    }
  }, [category, navigate]);

  useLayoutEffect(() => {
    // Reset immediately on mount/category change to avoid rendering at previous offset
    resetScrollPosition();
  }, [categoryId, resetScrollPosition]);

  useEffect(() => {
    // Run again on next frame in case layout shifts after initial paint
    const raf = requestAnimationFrame(resetScrollPosition);
    return () => cancelAnimationFrame(raf);
  }, [categoryId, resetScrollPosition]);

  useEffect(() => {
    const rail = categoryRailRef.current;
    if (!rail) {
      return;
    }

    const activeChip = rail.querySelector(`[data-category-id='${categoryId}']`);
    if (activeChip) {
      const railRect = rail.getBoundingClientRect();
      const chipRect = activeChip.getBoundingClientRect();
      const offset =
        chipRect.left -
        railRect.left -
        (railRect.width / 2 - chipRect.width / 2);

      rail.scrollTo({
        left: rail.scrollLeft + offset,
        behavior: "smooth",
      });
    }
  }, [categoryId]);

  if (!category) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, translateY: 24 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col -mt-3"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="sticky top-0 z-10 -mx-4 space-y-6 px-4 pb-4 py-4"
        style={{
          backgroundColor: "var(--background, var(--surface,#ffffff))",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="px-1">
          <div className="flex items-center gap-3">
            <div
              className="grid h-12 w-12 place-items-center rounded-2xl border text-2xl"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
            >
              {category.icon}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Vælg variation
              </p>
              <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                {category.name}
              </h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Log hver drinkvariation præcis som i overlayet. Tryk på plus og minus for at justere dit nuværende løb.
          </p>
        </div>
        <div className="mt-3 px-1">
          <div className="relative -mx-4 px-4">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-10"
              style={{
                background:
                  "linear-gradient(90deg, var(--background, var(--surface,#ffffff)) 0%, rgba(255,255,255,0) 100%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-10"
              style={{
                background:
                  "linear-gradient(270deg, var(--background, var(--surface,#ffffff)) 0%, rgba(255,255,255,0) 100%)",
              }}
            />

            <div
              ref={categoryRailRef}
              className="flex gap-4 overflow-x-auto py-1 scroll-smooth snap-x snap-mandatory"
              style={{
                scrollbarWidth: "none",
                WebkitOverflowScrolling: "touch",
                maskImage:
                  "linear-gradient(90deg, transparent, black 32px, black calc(100% - 32px), transparent)",
                WebkitMaskImage:
                  "linear-gradient(90deg, transparent, black 32px, black calc(100% - 32px), transparent)",
                paddingInline: "clamp(0.75rem, 6vw, 2rem)",
              }}
            >
              {CATEGORIES.map((cat) => {
                const isActive = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    data-category-id={cat.id}
                    onClick={() => {
                      const rail = categoryRailRef.current;
                      const chip = rail?.querySelector(
                        `[data-category-id='${cat.id}']`
                      );
                      if (rail && chip) {
                        const railRect = rail.getBoundingClientRect();
                        const chipRect = chip.getBoundingClientRect();
                        const offset =
                          chipRect.left -
                          railRect.left -
                          (railRect.width / 2 - chipRect.width / 2);

                        rail.scrollTo({
                          left: rail.scrollLeft + offset,
                          behavior: "smooth",
                        });
                      }
                      navigateToCategory(cat.id);
                    }}
                    aria-pressed={isActive}
                    className="flex min-w-[88px] flex-shrink-0 flex-col items-center gap-2 scroll-snap-align-center transition-transform duration-200 ease-out"
                    style={{ color: "var(--muted)" }}
                  >
                    <div
                      className="grid h-16 w-16 place-items-center rounded-full border transition-all duration-200 ease-out shadow-sm"
                      style={{
                        backgroundColor: isActive
                          ? "var(--brand, #FF385C)"
                          : "var(--surface)",
                        borderColor: isActive
                          ? "transparent"
                          : "color-mix(in srgb, var(--line) 85%, transparent)",
                        color: isActive
                          ? "var(--brand-ink, #ffffff)"
                          : "var(--ink)",
                        boxShadow: isActive
                          ? "0 12px 30px rgba(255, 56, 92, 0.24)"
                          : "0 10px 30px rgba(0,0,0,0.06)",
                        transform: isActive ? "scale(1.1)" : "scale(1)",
                      }}
                    >
                      <span className="text-2xl">{cat.icon}</span>
                    </div>
                    <span
                      className="text-[13px] font-semibold tracking-tight"
                      style={{
                        color: isActive ? "var(--ink)" : "var(--muted)",
                        opacity: isActive ? 1 : 0.7,
                      }}
                    >
                      {cat.name}
                    </span>
                    <span
                      className="h-1 w-8 rounded-full transition-colors duration-200"
                      style={{
                        backgroundColor: isActive
                          ? "var(--brand, #FF385C)"
                          : "color-mix(in srgb, var(--line) 60%, transparent)",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* FIXED: Removed nested overflow-y-auto container. Content now flows naturally in .scroll-region.
          This eliminates double-scroll conflicts and scroll lock issues on iOS. */}
      <div
        className="mt-4 pb-8 pr-1"
        style={{ minHeight: "50vh" }} // Keep content region from collapsing between category switches to avoid perceived jumps.
      >
        <div className="grid gap-3">
          {items.map((item) => {
            const count = variantCounts[categoryId]?.[item.name] ?? 0;
            return (
              <div
                key={item.name}
                className="rounded-2xl border p-4 shadow-sm"
                style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface)' }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {item.name}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                      {item.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustVariantCount(categoryId, item.name, -1)}
                      disabled={count === 0}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold disabled:opacity-40"
                      style={{ backgroundColor: 'var(--line)', color: 'var(--ink)' }}
                      aria-label={`Fjern en ${item.name}`}
                    >
                      &minus;
                    </button>
                    <span className="min-w-[28px] text-center text-base font-semibold" style={{ color: 'var(--ink)' }}>
                      {count}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustVariantCount(categoryId, item.name, 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold"
                      style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-ink)' }}
                      aria-label={`Tilføj en ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div
              className="rounded-2xl border border-dashed p-4 text-center text-sm"
              style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
            >
              Variationer på vej.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}


