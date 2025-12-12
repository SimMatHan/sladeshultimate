import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUserData } from "./UserDataContext";
import { useDrinkVariants } from "../hooks/useDrinkVariants";
import { useLocation } from "./LocationContext";
import { addDrink, removeDrink, resetCurrentRun, updateUserLocation } from "../services/userService";
import { useChannel } from "../hooks/useChannel";
import { clearLeaderboardCache } from "../services/leaderboardService";
import { DRINK_CATEGORY_ID_SET, NON_DRINK_CATEGORY_ID_SET } from "../constants/drinks";

const DrinkLogContext = createContext(null);
const SPAM_WINDOW_MS = 6000; // Time window for spam detection
const SPAM_THRESHOLD = 3; // Allow up to 3 quick logs before blocking
const SPAM_COOLDOWN_MS = 20000; // 20s cooldown when spam is detected

const createZeroCounts = (variantsMap) => {
  if (!variantsMap) return {};
  return Object.fromEntries(
    Object.entries(variantsMap).map(([catId, items]) => [
      catId,
      Object.fromEntries(items.map((item) => [item.name, 0])),
    ])
  );
};

const buildCategoryCounts = (items = [], source = {}) =>
  items.reduce((acc, item) => {
    acc[item.name] = source[item.name] || 0;
    return acc;
  }, {});

const mapDrinkVariationsToCounts = (variantsByCategory, drinkVariations = {}, prev = {}) => {
  if (!variantsByCategory) return prev || {};
  return Object.fromEntries(
    Object.entries(variantsByCategory).map(([catId, items]) => [
      catId,
      buildCategoryCounts(items, drinkVariations[catId] || {}),
    ])
  );
};

const sumDrinkVariations = (variations = {}) => {
  return Object.entries(variations).reduce((total, [catId, category]) => {
    if (!DRINK_CATEGORY_ID_SET.has(catId)) return total;
    const categoryTotal = Object.values(category || {}).reduce((sum, value) => sum + value, 0);
    return total + categoryTotal;
  }, 0);
};

export function DrinkLogProvider({ children }) {
  const { currentUser } = useAuth();
  const { userData, refreshUserData } = useUserData();
  const { variantsByCategory } = useDrinkVariants();
  const { userLocation, updateLocation } = useLocation();
  const { selectedChannel } = useChannel();
  const spamEventsRef = useRef([]);
  const mutationQueueRef = useRef(Promise.resolve());
  const [spamCooldownUntil, setSpamCooldownUntil] = useState(null);
  const [spamMessage, setSpamMessage] = useState(null);
  const [spamCooldownRemainingMs, setSpamCooldownRemainingMs] = useState(0);
  const [variantCounts, setVariantCounts] = useState(() => createZeroCounts(variantsByCategory));
  const [runCountOverride, setRunCountOverride] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const prevVariantsRef = useRef(null);
  const hasLoadedOnce = useRef(false);

  const syncVariantCountsFromSource = useCallback(
    (drinkVariations, logLabel, runCountFromServer) => {
      if (!variantsByCategory) return;
      setVariantCounts((prev) => {
        const next = mapDrinkVariationsToCounts(variantsByCategory, drinkVariations, prev);
        prevVariantsRef.current = next;
        return next;
      });
      if (typeof runCountFromServer === "number") {
        setRunCountOverride(runCountFromServer);
      }
      if (logLabel) {
        const derivedRunCount = sumDrinkVariations(drinkVariations);
        console.info(`[drink-log] ${logLabel}`, {
          derivedRunCount,
          firestoreRunCount: userData?.currentRunDrinkCount,
        });
      }
    },
    [userData?.currentRunDrinkCount, variantsByCategory]
  );

  useEffect(() => {
    if (!variantsByCategory) return;

    if (userData) {
      syncVariantCountsFromSource(
        userData.drinkVariations || {},
        "Hydrated from Firestore userData",
        userData.currentRunDrinkCount
      );
    } else if (userData === null) {
      syncVariantCountsFromSource({}, "Cleared variant counts for signed-out user", 0);
    }

    // Mark as loaded once we have userData (even if it's empty)
    // This prevents showing "0" before Firebase data arrives
    if (userData !== null && !hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      setIsLoading(false);
    }
  }, [syncVariantCountsFromSource, userData, variantsByCategory]);

  useEffect(() => {
    if (userData?.currentRunDrinkCount != null) {
      setRunCountOverride(userData.currentRunDrinkCount);
    }
  }, [userData?.currentRunDrinkCount]);

  useEffect(() => {
    prevVariantsRef.current = variantCounts;
  }, [variantCounts]);

  const clearSpamCooldown = useCallback(() => {
    setSpamCooldownUntil(null);
    setSpamCooldownRemainingMs(0);
    setSpamMessage(null);
    spamEventsRef.current = [];
  }, []);

  useEffect(() => {
    if (!spamCooldownUntil) return undefined;

    const tick = () => {
      const remaining = Math.max(0, spamCooldownUntil - Date.now());
      setSpamCooldownRemainingMs(remaining);
      if (remaining <= 0) {
        clearSpamCooldown();
      }
    };

    tick();
    const intervalId = setInterval(tick, 500);
    return () => clearInterval(intervalId);
  }, [spamCooldownUntil, clearSpamCooldown]);

  const startSpamCooldown = useCallback((now = Date.now()) => {
    const endsAt = now + SPAM_COOLDOWN_MS;
    setSpamCooldownUntil(endsAt);
    setSpamMessage("Rolig nu Cowboy! Du logger meget hurtigt lige nu. Vent et øjeblik, så er du tilbage.");
    spamEventsRef.current = [];
  }, []);

  const enqueueMutation = useCallback(
    (fn) => {
      mutationQueueRef.current = mutationQueueRef.current
        .catch(() => undefined)
        .then(() => fn());
      return mutationQueueRef.current.catch((error) => {
        console.error("[drink-log] mutation queue failed", error);
        throw error;
      });
    },
    []
  );

  const adjustVariantCount = useCallback(
    (catId, variantName, delta) =>
      enqueueMutation(async () => {
        if (!currentUser) {
          console.log("[drink-log] adjustVariantCount: No current user, aborting");
          return;
        }
        const isNonDrinkCategory = NON_DRINK_CATEGORY_ID_SET.has(catId);

        let previousSpamEventsSnapshot = null;
        const isDrinkCategory = !isNonDrinkCategory && DRINK_CATEGORY_ID_SET.has(catId);
        if (delta > 0 && isDrinkCategory) {
          const now = Date.now();
          const cooldownActive = spamCooldownUntil && spamCooldownUntil > now;
          if (cooldownActive) {
            setSpamMessage("Du er midlertidigt blokeret for at logge nye drinks. Vent et øjeblik, så er du klar igen.");
            return;
          }

          const recentEvents = (spamEventsRef.current || []).filter((ts) => now - ts < SPAM_WINDOW_MS);
          spamEventsRef.current = recentEvents;

          if (recentEvents.length >= SPAM_THRESHOLD) {
            startSpamCooldown(now);
            return;
          }

          previousSpamEventsSnapshot = [...recentEvents];
          spamEventsRef.current = [...recentEvents, now];
        }

        try {
          let mutationResult = null;
          if (delta > 0) {
            mutationResult = await addDrink(currentUser.uid, catId, variantName);

            // Invalidate leaderboard cache so it shows fresh currentRunDrinkCount
            // This ensures Leaderboard updates immediately when drinks are logged
            // Note: With real-time subscriptions, this is a backup - subscriptions handle most updates
            if (!isNonDrinkCategory && selectedChannel?.id) {
              clearLeaderboardCache(selectedChannel.id);
            }

            // Update location when logging a drink (so user appears on map)
            // This runs asynchronously and doesn't block the drink log
            if (!isNonDrinkCategory) (async () => {
              try {
                // Update location in context
                updateLocation();

                // Get current location (either from state or fetch fresh)
                let locationToSave = userLocation;

                // If no location in state, try to get it directly
                if (!locationToSave && 'geolocation' in navigator) {
                  try {
                    const position = await new Promise((resolve, reject) => {
                      navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 60000, // Accept location up to 1 minute old
                      });
                    });
                    locationToSave = {
                      lat: position.coords.latitude,
                      lng: position.coords.longitude,
                    };
                  } catch (geoError) {
                    console.warn("[drink-log] Could not get fresh location:", geoError);
                  }
                }

                // Use fallback location if still no location available
                if (!locationToSave) {
                  locationToSave = {
                    lat: 55.6761, // Default Copenhagen
                    lng: 12.5683,
                  };
                }

                const venue =
                  userData?.lastCheckInVenue ||
                  userData?.currentLocation?.venue ||
                  selectedChannel?.name ||
                  'Ukendt sted';

                await updateUserLocation(currentUser.uid, {
                  lat: locationToSave.lat,
                  lng: locationToSave.lng,
                  venue,
                });
              } catch (locationError) {
                console.error("[drink-log] Error saving location:", locationError);
                // Don't fail the drink log if location save fails
              }
            })();
          } else if (delta < 0) {
            mutationResult = await removeDrink(currentUser.uid, catId, variantName);

            // Invalidate leaderboard cache when removing drinks too
            if (!isNonDrinkCategory && selectedChannel?.id) {
              clearLeaderboardCache(selectedChannel.id);
            }
          }

          if (mutationResult?.drinkVariations) {
            syncVariantCountsFromSource(
              mutationResult.drinkVariations,
              "Synced after server mutation",
              mutationResult.currentRunDrinkCount
            );
          }

          await refreshUserData(true);
        } catch (error) {
          console.error("[drink-log] adjustVariantCount: Error updating drink in Firestore:", error);
          if (delta > 0 && previousSpamEventsSnapshot) {
            spamEventsRef.current = previousSpamEventsSnapshot;
          }
          if (userData?.drinkVariations) {
            syncVariantCountsFromSource(
              userData.drinkVariations,
              "Recovered variant counts from last known Firestore state",
              userData?.currentRunDrinkCount
            );
          }
        }
      }),
    [
      currentUser,
      enqueueMutation,
      refreshUserData,
      selectedChannel,
      spamCooldownUntil,
      startSpamCooldown,
      syncVariantCountsFromSource,
      updateLocation,
      userData,
      userLocation
    ]
  );

  const resetRun = useCallback(async () => {
    if (!currentUser) {
      console.log("[drink-log] resetRun: No current user, aborting");
      return false;
    }

    syncVariantCountsFromSource({}, "Reset current run locally", 0);

    try {
      setIsResetting(true);
      await resetCurrentRun(currentUser.uid);
      await refreshUserData(true);
      return true;
    } catch (error) {
      console.error("[drink-log] resetRun: Error resetting run:", error);
      await refreshUserData();
      return false;
    } finally {
      setIsResetting(false);
    }
  }, [currentUser, refreshUserData, syncVariantCountsFromSource]);

  const categoryTotals = useMemo(() => {
    if (!variantCounts) return {};
    return Object.fromEntries(
      Object.entries(variantCounts)
        .filter(([catId]) => DRINK_CATEGORY_ID_SET.has(catId))
        .map(([catId, variants]) => [
          catId,
          Object.values(variants).reduce((sum, value) => sum + value, 0),
        ])
    );
  }, [variantCounts]);

  const currentRunDrinkCount = useMemo(() => {
    if (runCountOverride != null) {
      return runCountOverride;
    }
    if (userData?.currentRunDrinkCount != null) {
      return userData.currentRunDrinkCount;
    }
    return sumDrinkVariations(variantCounts);
  }, [runCountOverride, userData?.currentRunDrinkCount, variantCounts]);

  const spamStatus = useMemo(() => {
    const isBlocked = Boolean(spamCooldownUntil && spamCooldownUntil > Date.now());
    return {
      isBlocked,
      cooldownEndsAt: spamCooldownUntil ? new Date(spamCooldownUntil) : null,
      remainingMs: spamCooldownRemainingMs,
      message: spamMessage,
    };
  }, [spamCooldownUntil, spamCooldownRemainingMs, spamMessage]);

  const value = {
    variantCounts,
    adjustVariantCount,
    resetRun,
    isResetting,
    isLoading,
    categoryTotals,
    currentRunDrinkCount,
    spamStatus,
  };

  return <DrinkLogContext.Provider value={value}>{children}</DrinkLogContext.Provider>;
}

export function useDrinkLog() {
  const context = useContext(DrinkLogContext);
  if (!context) {
    throw new Error("useDrinkLog must be used within a DrinkLogProvider");
  }
  return context;
}
