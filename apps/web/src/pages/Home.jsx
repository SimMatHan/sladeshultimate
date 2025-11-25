import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Card from "../components/Card";
import { useLocation } from "../contexts/LocationContext";
import { useCheckInGate } from "../contexts/CheckInContext";
import { useUserData } from "../contexts/UserDataContext";
import { useAuth } from "../hooks/useAuth";
import { useDrinkVariants } from "../hooks/useDrinkVariants";
import { useScrollLock } from "../hooks/useScrollLock";
import { addDrink, removeDrink, getNextResetBoundary, resetCurrentRun } from "../services/userService";
import { incrementDrinkCount } from "../services/statsService";
import { CATEGORIES, CATEGORY_THEMES, FALLBACK_THEME } from "../constants/drinks";

const createZeroCounts = (variantsMap) =>
  Object.fromEntries(
    Object.entries(variantsMap).map(([catId, items]) => [
      catId,
      Object.fromEntries(items.map((item) => [item.name, 0])),
    ])
  );

const buildCategoryCounts = (items, source = {}) =>
  items.reduce((acc, item) => {
    acc[item.name] = source[item.name] || 0;
    return acc;
  }, {});

function Countdown({ target, onExpire }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, target.getTime() - Date.now())
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    setRemaining(Math.max(0, target.getTime() - Date.now()));
    const tick = () => {
      setRemaining(Math.max(0, target.getTime() - Date.now()));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  useEffect(() => {
    if (remaining === 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire?.();
    }
  }, [remaining, onExpire]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => value.toString().padStart(2, "0");

  return (
    <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span>
        Nulstiller om {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}

export default function Home() {
  const { updateLocation, userLocation } = useLocation();
  const { currentUser } = useAuth();
  const { checkedIn, checkIn: globalCheckIn, checkOut: handleCheckOut } = useCheckInGate();
  const { userData, refreshUserData } = useUserData();
  const { variantsByCategory } = useDrinkVariants();
  const [expiresAt, setExpiresAt] = useState(() => getNextResetBoundary(new Date()));
  const [selected, setSelected] = useState("beer");
  const [sheetFor, setSheetFor] = useState(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Get values from context with fallbacks
  const userTotalDrinks = userData?.totalDrinks || 0;
  const currentRunDrinkCount = userData?.currentRunDrinkCount || 0;
  const drinkVariations = userData?.drinkVariations || {};

  const [variantCounts, setVariantCounts] = useState(() =>
    createZeroCounts(variantsByCategory)
  );

  // Update variantCounts when variantsByCategory changes or when userData is loaded/updated
  useEffect(() => {
    if (!variantsByCategory) return;

    setVariantCounts((prev) => {
      const next = {};
      Object.entries(variantsByCategory).forEach(([catId, items]) => {
        // Hydrate from userData.drinkVariations if available, otherwise keep previous or use zero counts
        if (userData?.drinkVariations?.[catId]) {
          const categoryVariations = userData.drinkVariations[catId] || {};
          next[catId] = buildCategoryCounts(items, categoryVariations);
        } else {
          // Keep previous counts if no data available yet
          const previousCategory = prev[catId] ?? {};
          next[catId] = buildCategoryCounts(items, previousCategory);
        }
      });
      return next;
    });
  }, [variantsByCategory, userData]);

  const categoryTotals = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((cat) => {
          const variants = variantCounts[cat.id] ?? {};
          const sum = Object.values(variants).reduce((acc, value) => acc + value, 0);
          return [cat.id, sum];
        })
      ),
    [variantCounts]
  );

  const total = useMemo(
    () => Object.values(categoryTotals).reduce((sum, value) => sum + value, 0),
    [categoryTotals]
  );

  // slider helpers
  const railRef = useRef(null);
  const cardRefs = useRef({});
  const scrollFrame = useRef(null);
  const closeTimeout = useRef(null);

  const centerCard = (id) => {
    const rail = railRef.current;
    const el = cardRefs.current[id];
    if (!rail || !el) return;
    const railCenter = rail.scrollLeft + rail.clientWidth / 2;
    const elCenter = el.offsetLeft + el.offsetWidth / 2;
    rail.scrollTo({
      left: rail.scrollLeft + (elCenter - railCenter),
      behavior: "smooth",
      // behavior: "instant", // hvis man vil have det instant
    });
  };

  // Combine categories with reset option for unified slider logic
  const sliderItems = useMemo(() => [
    ...CATEGORIES,
    {
      id: "reset",
      name: "Nulstil runde",
      icon: "🚨",
      description: "Start forfra",
      gradient: "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))"
    }
  ], []);

  const updateSelectionFromScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    const railCenter = rail.scrollLeft + rail.clientWidth / 2;
    let closestId = selected;
    let closestDistance = Number.POSITIVE_INFINITY;

    sliderItems.forEach((item) => {
      const el = cardRefs.current[item.id];
      if (!el) return;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const distance = Math.abs(railCenter - elCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = item.id;
      }
    });

    if (closestId !== selected) {
      setSelected(closestId);
    }
  };

  const handleScroll = () => {
    if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(updateSelectionFromScroll);
  };

  const handleCheckInClick = useCallback(async () => {
    if (!currentUser) {
      console.error("User not authenticated");
      return;
    }
    if (checkedIn) return;

    try {
      setIsSaving(true);
      const success = await globalCheckIn();
      if (success) {
        setExpiresAt(getNextResetBoundary(new Date()));
      }
    } finally {
      setIsSaving(false);
    }
  }, [checkedIn, currentUser, globalCheckIn]);

  const adjustVariantCount = async (catId, variantName, delta) => {
    if (!currentUser) return;

    // Optimistically update local state
    setVariantCounts((prev) => {
      const category = prev[catId] ?? {};
      const current = category[variantName] ?? 0;
      const next = Math.max(0, current + delta);
      if (next === current) return prev;

      return {
        ...prev,
        [catId]: {
          ...category,
          [variantName]: next,
        },
      };
    });

    try {
      setIsSaving(true);

      // Call appropriate service function based on delta
      // The service function handles Firestore increment, we don't manually update local state
      if (delta > 0) {
        await addDrink(currentUser.uid, catId, variantName);
      } else if (delta < 0) {
        await removeDrink(currentUser.uid, catId, variantName);
      }

      // Refresh user data from Firestore to get the updated values
      // This updates the context, which will automatically update our displayed values
      await refreshUserData();

      // Note: After refreshUserData, the context will update and trigger a re-render
      // The variant counts will be updated via the useEffect that watches userData

    } catch (error) {
      console.error("Error updating drink in Firestore:", error);
      // Revert the optimistic update if save failed
      setVariantCounts((prev) => {
        const category = prev[catId] ?? {};
        const current = category[variantName] ?? 0;
        return {
          ...prev,
          [catId]: {
            ...category,
            [variantName]: Math.max(0, current - delta),
          },
        };
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetRun = async () => {
    if (!currentUser) return;
    try {
      setIsSaving(true);
      await resetCurrentRun(currentUser.uid);

      // Refresh user data from context, which will update all displayed values
      await refreshUserData();

      // Reset variant counts to zero
      setVariantCounts(createZeroCounts(variantsByCategory));
      setShowResetConfirm(false);
    } catch (error) {
      console.error("Error resetting run:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const closeSheet = () => {
    setIsSheetVisible(false);
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    closeTimeout.current = setTimeout(() => {
      setSheetFor(null);
    }, 300);
  };

  const openSheet = (id) => {
    if (id === "reset") {
      setShowResetConfirm(true);
      return;
    }
    setSelected(id);
    setSheetFor(id);
    requestAnimationFrame(() => setIsSheetVisible(true));
  };

  // ... (keep closeSheet, centerCard, etc.)

  const selIndex = sliderItems.findIndex((c) => c.id === selected);
  const selectedItem = sliderItems[selIndex] || sliderItems[0];
  const sheetCat = sheetFor ? CATEGORIES.find((c) => c.id === sheetFor) : null;
  const sheetItems = sheetFor ? variantsByCategory[sheetFor] ?? [] : [];

  // Lock scroll when overlays are open
  useScrollLock(!!sheetFor);
  useScrollLock(showResetConfirm);

  // Update expiresAt when it expires to show the next reset boundary
  useEffect(() => {
    const updateExpiresAt = () => {
      const nextBoundary = getNextResetBoundary(new Date());
      setExpiresAt(nextBoundary);
    };

    // Update immediately on mount and whenever checked in
    updateExpiresAt();

    // Set up interval to update every minute to keep it accurate
    const interval = setInterval(updateExpiresAt, 60000);

    return () => clearInterval(interval);
  }, [checkedIn]);

  return (
    <>
      <motion.div
      // ... (keep motion props)
      >
        {/* Header */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card
              bare
              className={`px-5 py-4 transition-colors ${checkedIn ? "cursor-default" : "cursor-pointer"}`}
              style={checkedIn ? {
                borderColor: 'rgba(16,185,129,0.6)',
                backgroundColor: 'color-mix(in srgb, rgb(16,185,129) 12%, var(--surface) 88%)'
              } : {}}
              role="button"
              tabIndex={checkedIn ? -1 : 0}
              aria-disabled={checkedIn}
              onClick={!checkedIn ? handleCheckInClick : undefined}
              onKeyDown={(event) => {
                if (checkedIn) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
            >
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Check-in-status
              </div>
              <div
                className={`mt-2 flex items-center gap-2 text-sm font-semibold ${checkedIn
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-[color:var(--brand,#FF385C)]"
                  }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${checkedIn
                    ? "bg-emerald-500"
                    : "bg-[color:var(--brand,#FF385C)]"
                    }`}
                />
                {checkedIn ? "Checket ind" : "Ikke checket ind"}
              </div>
              <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {checkedIn
                  ? "Fedt! Du er checket ind."
                  : "Tryk for at checke ind, når du ankommer."}
              </p>
              {expiresAt && (
                <Countdown
                  target={expiresAt}
                  onExpire={() => {
                    if (checkedIn) {
                      handleCheckOut();
                    }
                    // Update to next reset boundary after expiration
                    setExpiresAt(getNextResetBoundary(new Date()));
                  }}
                />
              )}
            </Card>

            <Card bare className="px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Loggede drinks
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
                  {currentRunDrinkCount}
                </span>
                <span className="pb-1 text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  i dag
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {userTotalDrinks > 0
                  ? `${userTotalDrinks} i alt`
                  : "Registrer hver variation med drinkvælgeren nedenfor."}
              </p>
            </Card>
          </div>
        </div>

        {/* PLAYER-LIGNENDE SLIDER */}
        <div className="mt-2 pb-4 px-0">
          {/* Rail: næste kort titter frem */}
          <div
            ref={railRef}
            className="slider-rail flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pt-4 pb-4"
            style={{ paddingInline: "24px", scrollPaddingInline: "16px" }}
            onScroll={handleScroll}
          >
            {sliderItems.map((item) => (
              <div
                key={item.id}
                ref={(n) => (cardRefs.current[item.id] = n)}
                onClick={() => openSheet(item.id)}
                role="button"
                tabIndex={0}
                className={`snap-center shrink-0 rounded-[28px] transition active:scale-[0.98] outline-none focus:outline-none ${item.id === selected ? "opacity-100" : "opacity-80"
                  }`}
                style={{
                  width: "100%",
                  maxWidth: "min(100%, 440px)",
                  minHeight: "min(32vh, 280px)",
                }}
                aria-label={item.name}
              >
                <div
                  className={`glass-category-card ${item.id === selected ? "glass-category-card--active" : ""}`}
                  style={{
                    "--glass-gradient": item.gradient || (CATEGORY_THEMES[item.id] ?? FALLBACK_THEME).gradient,
                  }}
                >
                  <span className="glass-category-emoji">{item.icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Titel + subtitel + progress-dots */}
          <div className="px-6">
            <div className="flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              <span>{selectedItem.name}</span>
            </div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              {selectedItem.id === "reset" ? "Nulstil dagens fremskridt" : "Vælg din drink"}
            </div>
            <div className="mt-4 flex justify-center gap-2">
              {sliderItems.map((item) => (
                <span
                  key={`dot-${item.id}`}
                  className={`h-2 rounded-full transition-all duration-200 ${item.id === selected
                    ? "w-7 bg-[color:var(--brand,#FF385C)]"
                    : "w-2"
                    }`}
                  style={item.id !== selected ? { backgroundColor: 'var(--line)' } : {}}
                />
              ))}
            </div>
          </div>
        </div>


        {sheetFor && (
          <div className="fixed inset-0 z-40 flex items-end justify-center">
            <div
              className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${isSheetVisible ? "opacity-100" : "opacity-0"
                }`}
              onClick={closeSheet}
            />
            <div className="relative z-50 w-full">
              <div
                className={`drink-selector-overlay relative rounded-t-[32px] shadow-2xl transition-transform duration-300 ease-out ${isSheetVisible ? "translate-y-0" : "translate-y-full"
                  }`}
                style={{ height: "75vh" }}
              >
                <button
                  type="button"
                  onClick={closeSheet}
                  className="absolute right-6 top-6 text-2xl transition-colors"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                  aria-label="Luk"
                >
                  ×
                </button>
                <div className="h-full overflow-hidden pt-6">
                  <div className="px-6">
                    <div className="flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                      <span className="text-2xl leading-none">
                        {sheetCat?.icon ?? "🍹"}
                      </span>
                      <span>{sheetCat?.name ?? "Drinks"}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      Vælg din favoritvariation
                    </div>
                  </div>
                  <div className="mt-5 h-[calc(100%-92px)] overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom,0px)+40px)]">
                    <div className="grid gap-3">
                      {sheetItems.map((item) => {
                        const count = variantCounts[sheetFor]?.[item.name] ?? 0;
                        return (
                          <div
                            key={item.name}
                            className="rounded-2xl border p-4 shadow-sm"
                            style={{
                              borderColor: 'var(--line)',
                              backgroundColor: 'var(--surface)'
                            }}
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
                                  onClick={() => adjustVariantCount(sheetFor, item.name, -1)}
                                  disabled={count === 0}
                                  className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold disabled:opacity-40"
                                  style={{
                                    backgroundColor: 'var(--line)',
                                    color: 'var(--ink)'
                                  }}
                                  aria-label={`Fjern en ${item.name}`}
                                >
                                  &minus;
                                </button>
                                <span className="min-w-[28px] text-center text-base font-semibold" style={{ color: 'var(--ink)' }}>
                                  {count}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => adjustVariantCount(sheetFor, item.name, 1)}
                                  className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold"
                                  style={{
                                    backgroundColor: 'var(--brand)',
                                    color: 'var(--brand-ink)'
                                  }}
                                  aria-label={`Tilføj en ${item.name}`}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {sheetItems.length === 0 && (
                        <div
                          className="rounded-2xl border border-dashed p-4 text-center text-sm"
                          style={{
                            borderColor: 'var(--line)',
                            color: 'var(--muted)'
                          }}
                        >
                          Variationer på vej.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Reset Confirmation Dialog */}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowResetConfirm(false)}
          />
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Vil du nulstille dagens drikke?
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Dette nulstiller dit nuværende løb til 0. Handlingen kan ikke fortrydes.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={handleResetRun}
                disabled={isSaving}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isSaving ? "Nulstiller..." : "Bekræft"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </>
  );
}
