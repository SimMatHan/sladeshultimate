import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Card from "../components/Card";
import { useLocation } from "../contexts/LocationContext";
import { useAuth } from "../hooks/useAuth";
import { addDrink, addCheckIn, updateUserLocation, getUser } from "../services/userService";
import { incrementDrinkCount, incrementCheckInCount } from "../services/statsService";

const CATEGORIES = [
  { id: "beer", name: "Beer", icon: "🍺" },
  { id: "cider", name: "Cider", icon: "🍏" },
  { id: "wine", name: "Wine", icon: "🍷" },
  { id: "cocktail", name: "Cocktails", icon: "🍸" },
  { id: "shot", name: "Shots", icon: "🥃" },
];

const CATEGORY_THEMES = {
  beer: {
    gradient: "linear-gradient(135deg, rgba(249, 217, 118, 0.75), rgba(243, 159, 134, 0.75))",
  },
  cider: {
    gradient: "linear-gradient(135deg, rgba(168, 224, 99, 0.75), rgba(86, 171, 47, 0.75))",
  },
  wine: {
    gradient: "linear-gradient(135deg, rgba(215, 109, 119, 0.75), rgba(58, 28, 113, 0.75))",
  },
  cocktail: {
    gradient: "linear-gradient(135deg, rgba(251, 215, 134, 0.75), rgba(198, 255, 221, 0.75))",
  },
  shot: {
    gradient: "linear-gradient(135deg, rgba(242, 153, 74, 0.75), rgba(242, 201, 76, 0.75))",
  },
};

const FALLBACK_THEME = {
  gradient: "linear-gradient(135deg, rgba(246, 211, 101, 0.75), rgba(253, 160, 133, 0.75))",
};

const VARIANTS = {
  beer: [
    { name: "Lager", description: "Clean and crisp golden brew." },
    { name: "Classic", description: "Balanced malt-forward favorite." },
    { name: "IPA", description: "Hoppy with citrus and floral notes." },
    { name: "Stout", description: "Dark roasted malts with chocolate hints." },
    { name: "Guinness", description: "Iconic Irish stout with creamy head." },
    { name: "Pilsner", description: "Light-bodied with floral bitterness." },
    { name: "Hvede Øl", description: "Cloudy wheat beer with banana and clove." },
    { name: "Sour", description: "Tart ale with lively acidity." },
    { name: "Blanc", description: "Belgian-style wit with citrus spice." },
  ],
  cider: [
    { name: "Apple", description: "Classic apple cider with bright tartness." },
    { name: "Pear", description: "Gentle, juicy pear sweetness." },
    { name: "Mixed Berries", description: "Blend of berries with vibrant color." },
    { name: "Elderflower", description: "Floral twist with soft sparkle." },
    { name: "Strawberry", description: "Summer-sweet with a fruity finish." },
  ],
  wine: [
    { name: "Red", description: "Deep, velvety notes of dark fruit." },
    { name: "White", description: "Bright, crisp finish with citrus hints." },
    { name: "Rosé", description: "Dry pink wine perfect for sunny days." },
    { name: "Sparkling", description: "Effervescent bubbles with festive flair." },
    { name: "Gløgg", description: "Warm spiced wine for cosy evenings." },
    { name: "Orange", description: "Skin-contact white with bold character." },
  ],
  cocktail: [
    { name: "Mojito", description: "Rum, mint and lime over crushed ice." },
    { name: "Smirnoff Ice", description: "Vodka cooler with citrus zing." },
    { name: "Gin & Tonic", description: "Botanical gin balanced with tonic." },
    { name: "Dark 'n Stormy", description: "Dark rum and ginger beer kick." },
    { name: "White Russian", description: "Vodka, coffee liqueur and cream." },
    { name: "Espresso Martini", description: "Espresso shaken with vodka and liqueur." },
    { name: "Vermouth Tonic", description: "Aperitif served long with tonic." },
  ],
  shot: [
    { name: "Tequila", description: "Served with salt and lime wedge." },
    { name: "Jägermeister", description: "Herbal liqueur served ice cold." },
    { name: "Fisk", description: "Nordic licorice shot with menthol." },
    { name: "Bailey", description: "Creamy Irish liqueur in a quick sip." },
    { name: "Gammel Dansk", description: "Bitter herbal classic from Denmark." },
    { name: "Snaps", description: "Traditional aquavit best served chilled." },
  ],
};

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
        Resets in {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}

export default function Home() {
  const { updateLocation, userLocation } = useLocation();
  const { currentUser } = useAuth();
  const [checkedIn, setCheckedIn] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const [selected, setSelected] = useState("beer");
  const [sheetFor, setSheetFor] = useState(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userTotalDrinks, setUserTotalDrinks] = useState(0);

  const [variantCounts, setVariantCounts] = useState(() =>
    Object.fromEntries(
      Object.entries(VARIANTS).map(([catId, items]) => [
        catId,
        Object.fromEntries(items.map((item) => [item.name, 0])),
      ])
    )
  );

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
    });
  };

  const updateSelectionFromScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    const railCenter = rail.scrollLeft + rail.clientWidth / 2;
    let closestId = selected;
    let closestDistance = Number.POSITIVE_INFINITY;

    CATEGORIES.forEach((cat) => {
      const el = cardRefs.current[cat.id];
      if (!el) return;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const distance = Math.abs(railCenter - elCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = cat.id;
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

  const adjustVariantCount = async (catId, variantName, delta) => {
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

    // Only save to Firestore when adding drinks (delta > 0)
    if (delta > 0 && currentUser) {
      try {
        setIsSaving(true);
        
        // Update location locally
        updateLocation();
        
        // Get venue name (for now using a placeholder - can be enhanced with geocoding)
        const venue = "Current Location"; // TODO: Get actual venue name from location
        
        // Get current location or use default
        const location = userLocation || {
          lat: 55.6761, // Copenhagen default
          lng: 12.5683
        };
        
        // Save drink to Firestore
        await addDrink(currentUser.uid, {
          type: catId,
          label: variantName,
          venue: venue,
          location: {
            lat: location.lat,
            lng: location.lng
          }
        });
        
        // Update user location in Firestore
        await updateUserLocation(currentUser.uid, {
          lat: location.lat,
          lng: location.lng,
          venue: venue
        });
        
        // Update stats (with variation tracking)
        await incrementDrinkCount(catId, variantName);
        
        // Update local total drinks count
        setUserTotalDrinks(prev => prev + 1);
        
      } catch (error) {
        console.error("Error saving drink to Firestore:", error);
        // Revert the count if save failed
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
    }
  };

  const openSheet = (id) => {
    setSelected(id);
    setSheetFor(id);
    requestAnimationFrame(() => setIsSheetVisible(true));
  };

  const closeSheet = () => {
    setIsSheetVisible(false);
  };

  useEffect(() => {
    centerCard(selected);
  }, [selected]);

  useEffect(
    () => () => {
      if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current);
    },
    []
  );

  const computeMidnight = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight;
  };

  // Load user data from Firestore on mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) return;
      
      try {
        const userData = await getUser(currentUser.uid);
        if (userData) {
          setUserTotalDrinks(userData.totalDrinks || 0);
          setCheckedIn(userData.checkInStatus || false);
          // Set expiresAt based on lastCheckIn if needed
          if (userData.lastCheckIn && userData.checkInStatus) {
            const lastCheckInTime = userData.lastCheckIn.toDate?.() || 
              (userData.lastCheckIn.seconds ? new Date(userData.lastCheckIn.seconds * 1000) : new Date());
            const midnight = computeMidnight();
            if (lastCheckInTime < midnight) {
              setExpiresAt(midnight);
            } else {
              // Check-in expired
              setCheckedIn(false);
            }
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();
  }, [currentUser]);

  useEffect(() => {
    if (!sheetFor) return undefined;

    if (isSheetVisible) {
      if (closeTimeout.current) {
        clearTimeout(closeTimeout.current);
        closeTimeout.current = null;
      }
      return undefined;
    }

    closeTimeout.current = setTimeout(() => {
      setSheetFor(null);
    }, 250);

    return () => {
      if (closeTimeout.current) {
        clearTimeout(closeTimeout.current);
        closeTimeout.current = null;
      }
    };
  }, [isSheetVisible, sheetFor]);

  useEffect(() => {
    if (!sheetFor) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [sheetFor]);

  const selIndex = CATEGORIES.findIndex((c) => c.id === selected);
  const selectedCat = CATEGORIES[selIndex];
  const sheetCat = sheetFor ? CATEGORIES.find((c) => c.id === sheetFor) : null;
  const sheetItems = sheetFor ? VARIANTS[sheetFor] ?? [] : [];

  useEffect(() => {
    if (!sheetFor) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [sheetFor]);

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.2, 0, 0.2, 1], // ease-in cubic bezier
      }}
    >
        {/* Header */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card
              bare
              className="px-5 py-4 transition-colors"
              style={checkedIn ? {
                borderColor: 'rgba(16,185,129,0.6)',
                backgroundColor: 'color-mix(in srgb, rgb(16,185,129) 12%, var(--surface) 88%)'
              } : {}}
              role="button"
              tabIndex={0}
              onClick={async () => {
                if (checkedIn) {
                  // Check out
                  setCheckedIn(false);
                  setExpiresAt(null);
                } else {
                  // Check in
                  if (!currentUser) {
                    console.error("User not authenticated");
                    return;
                  }
                  
                  try {
                    setIsSaving(true);
                    
                    // Update location locally
                    updateLocation();
                    
                    // Get venue name (for now using a placeholder - can be enhanced with geocoding)
                    const venue = "Current Location"; // TODO: Get actual venue name from location
                    
                    // Get current location or use default
                    const location = userLocation || {
                      lat: 55.6761, // Copenhagen default
                      lng: 12.5683
                    };
                    
                    // Save check-in to Firestore
                    await addCheckIn(currentUser.uid, {
                      venue: venue,
                      location: {
                        lat: location.lat,
                        lng: location.lng
                      }
                    });
                    
                    // Update user location in Firestore
                    await updateUserLocation(currentUser.uid, {
                      lat: location.lat,
                      lng: location.lng,
                      venue: venue
                    });
                    
                    // Update stats
                    await incrementCheckInCount();
                    
                    // Update UI state
                    setCheckedIn(true);
                    setExpiresAt(computeMidnight());
                    
                  } catch (error) {
                    console.error("Error saving check-in to Firestore:", error);
                    // Don't update UI state if save failed
                  } finally {
                    setIsSaving(false);
                  }
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  // Trigger the same onClick logic
                  event.target.click();
                }
              }}
            >
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Check-in status
              </div>
              <div
                className={`mt-2 flex items-center gap-2 text-sm font-semibold ${
                  checkedIn
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-[color:var(--brand,#FF385C)]"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    checkedIn
                      ? "bg-emerald-500"
                      : "bg-[color:var(--brand,#FF385C)]"
                  }`}
                />
                {checkedIn ? "Checked in" : "Not checked in"}
              </div>
              <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {checkedIn
                  ? "Great! You're checked in."
                  : "Tap to check in when you arrive."}
              </p>
              {checkedIn && expiresAt && (
                <Countdown
                  target={expiresAt}
                  onExpire={() => {
                    setCheckedIn(false);
                    setExpiresAt(null);
                  }}
                />
              )}
            </Card>

            <Card bare className="px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Drinks logged
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
                  {userTotalDrinks + total}
                </span>
                <span className="pb-1 text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  total
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {total > 0 ? `${total} this session` : "Track each variation with the drink selector below."}
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
            {CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                ref={(n) => (cardRefs.current[cat.id] = n)}
                onClick={() => openSheet(cat.id)}
                role="button"
                tabIndex={0}
                className={`snap-center shrink-0 rounded-[28px] transition active:scale-[0.98] outline-none focus:outline-none ${
                  cat.id === selected ? "opacity-100" : "opacity-80"
                }`}
                style={{
                  width: "100%",
                  maxWidth: "min(100%, 440px)",
                  minHeight: "min(32vh, 280px)",
                }}
                aria-label={cat.name}
              >
                <div
                  className={`glass-category-card ${cat.id === selected ? "glass-category-card--active" : ""}`}
                  style={{
                    "--glass-gradient": (CATEGORY_THEMES[cat.id] ?? FALLBACK_THEME).gradient,
                  }}
                >
                  <span className="glass-category-emoji">{cat.icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Titel + subtitel + progress-dots */}
          <div className="px-6">
            <div className="flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              <span>{selectedCat.name}</span>
            </div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>Select your drink</div>
            <div className="mt-4 flex justify-center gap-2">
              {CATEGORIES.map((cat) => (
                <span
                  key={`dot-${cat.id}`}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    cat.id === selected
                      ? "w-7 bg-[color:var(--brand,#FF385C)]"
                      : "w-2"
                  }`}
                  style={cat.id !== selected ? { backgroundColor: 'var(--line)' } : {}}
                />
              ))}
            </div>
          </div>
        </div>

        {sheetFor && (
          <div className="fixed inset-0 z-40 flex items-end justify-center">
            <div
              className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
                isSheetVisible ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeSheet}
            />
            <div className="relative z-50 w-full">
              <div
                className={`drink-selector-overlay relative rounded-t-[32px] shadow-2xl transition-transform duration-300 ease-out ${
                  isSheetVisible ? "translate-y-0" : "translate-y-full"
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
                  aria-label="Close"
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
                      Pick your favourite variation
                    </div>
                  </div>
                  <div className="mt-5 h-[calc(100%-92px)] overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]">
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
                                  aria-label={`Remove one ${item.name}`}
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
                                  aria-label={`Add one ${item.name}`}
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
                          Variations coming soon.
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
  );
}
