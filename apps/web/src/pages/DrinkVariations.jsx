import { useCallback, useEffect, useMemo, useRef } from "react";
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
  const carouselRef = useRef(null);

  const category = useMemo(
    () => CATEGORIES.find((cat) => cat.id === categoryId),
    [categoryId]
  );
  const categoryIndex = useMemo(
    () => CATEGORIES.findIndex((cat) => cat.id === categoryId),
    [categoryId]
  );

  const items = variantsByCategory?.[categoryId] ?? [];

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

  useEffect(() => {
    const activePill = carouselRef.current?.querySelector(
      "[data-active-pill='true']"
    );
    if (activePill) {
      activePill.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
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
      className="flex h-full min-h-0 flex-col -mt-3"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="sticky top-0 z-10 -mx-4 space-y-6 px-4 pb-4"
        style={{
          backgroundColor: "var(--background, var(--surface,#ffffff))",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div
          ref={carouselRef}
          className="flex gap-3 overflow-x-auto pb-4 pt-2 scroll-smooth snap-x snap-mandatory"
          style={{
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
            maskImage:
              "linear-gradient(90deg, transparent, black 32px, black calc(100% - 32px), transparent)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent, black 32px, black calc(100% - 32px), transparent)",
            paddingInline: "clamp(1rem, 6vw, 2.5rem)",
            gap: "clamp(0.5rem, 2vw, 1rem)",
          }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = cat.id === categoryId;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigateToCategory(cat.id)}
                data-active-pill={isActive}
                className={`flex-shrink-0 rounded-full font-semibold transition-all duration-300 scroll-snap-align-center ${
                  isActive
                    ? "bg-[color:var(--brand,#FF385C)] text-[color:var(--brand-ink,#ffffff)] shadow-lg scale-100"
                    : "border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--muted)] opacity-70 scale-95"
                } ${isActive ? "px-6 py-2.5 text-base" : "px-4 py-1.5 text-sm"}`}
                style={{
                  minWidth: isActive ? "min(65vw, 260px)" : "min(38vw, 150px)",
                }}
                aria-pressed={isActive}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
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
      </div>

      <div className="mt-4 flex-1 overflow-y-auto pb-8 pr-1">
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


