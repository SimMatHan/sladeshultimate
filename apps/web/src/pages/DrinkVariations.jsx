import { useEffect, useMemo } from "react";
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

  const category = useMemo(
    () => CATEGORIES.find((cat) => cat.id === categoryId),
    [categoryId]
  );

  const items = variantsByCategory?.[categoryId] ?? [];

  useEffect(() => {
    if (!category) {
      navigate("/home", { replace: true });
    }
  }, [category, navigate]);

  if (!category) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, translateY: 24 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="px-1">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border text-2xl" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface)' }}>
            {category.icon}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Vælg variation
            </p>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
              {category.name}
            </h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Log hver drinkvariation præcis som i overlayet. Tryk på plus og minus for at justere dit nuværende løb.
        </p>
      </div>

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
    </motion.div>
  );
}


