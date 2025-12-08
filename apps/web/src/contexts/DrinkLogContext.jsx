import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUserData } from "./UserDataContext";
import { useDrinkVariants } from "../hooks/useDrinkVariants";
import { useLocation } from "./LocationContext";
import { addDrink, removeDrink, resetCurrentRun, updateUserLocation } from "../services/userService";
import { useChannel } from "../hooks/useChannel";
import { clearLeaderboardCache } from "../services/leaderboardService";

const DrinkLogContext = createContext(null);

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

export function DrinkLogProvider({ children }) {
  const { currentUser } = useAuth();
  const { userData, refreshUserData } = useUserData();
  const { variantsByCategory } = useDrinkVariants();
  const { userLocation, updateLocation } = useLocation();
  const { selectedChannel } = useChannel();
  const [variantCounts, setVariantCounts] = useState(() => createZeroCounts(variantsByCategory));
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const prevVariantsRef = useRef(null);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    if (!variantsByCategory) return;

    setVariantCounts((prev) => {
      const next = {};
      Object.entries(variantsByCategory).forEach(([catId, items]) => {
        if (userData?.drinkVariations?.[catId]) {
          next[catId] = buildCategoryCounts(items, userData.drinkVariations[catId]);
        } else {
          const previousCategory = prev?.[catId] ?? prevVariantsRef.current?.[catId] ?? {};
          next[catId] = buildCategoryCounts(items, previousCategory);
        }
      });
      prevVariantsRef.current = next;
      return next;
    });

    // Mark as loaded once we have userData (even if it's empty)
    // This prevents showing "0" before Firebase data arrives
    if (userData !== null && !hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      setIsLoading(false);
    }
  }, [variantsByCategory, userData]);

  useEffect(() => {
    prevVariantsRef.current = variantCounts;
  }, [variantCounts]);

  const adjustVariantCount = useCallback(
    async (catId, variantName, delta) => {
      if (!currentUser) {
        console.log("[drink-log] adjustVariantCount: No current user, aborting");
        return;
      }

      setVariantCounts((prev) => {
        const category = prev[catId] ?? {};
        const current = category[variantName] ?? 0;
        const next = Math.max(0, current + delta);
        if (next === current) {
          return prev;
        }

        return {
          ...prev,
          [catId]: {
            ...category,
            [variantName]: next,
          },
        };
      });

      try {
        if (delta > 0) {
          await addDrink(currentUser.uid, catId, variantName);

          // Invalidate leaderboard cache so it shows fresh currentRunDrinkCount
          // This ensures Leaderboard updates immediately when drinks are logged
          // Note: With real-time subscriptions, this is a backup - subscriptions handle most updates
          if (selectedChannel?.id) {
            clearLeaderboardCache(selectedChannel.id);
          }

          // Update location when logging a drink (so user appears on map)
          // This runs asynchronously and doesn't block the drink log
          (async () => {
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
          await removeDrink(currentUser.uid, catId, variantName);

          // Invalidate leaderboard cache when removing drinks too
          if (selectedChannel?.id) {
            clearLeaderboardCache(selectedChannel.id);
          }
        }
        await refreshUserData(true);
      } catch (error) {
        console.error("[drink-log] adjustVariantCount: Error updating drink in Firestore:", error);
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
      }
    },
    [currentUser, updateLocation, userLocation, userData, selectedChannel]
  );

  const resetRun = useCallback(async () => {
    if (!currentUser) {
      console.log("[drink-log] resetRun: No current user, aborting");
      return false;
    }

    setVariantCounts(createZeroCounts(variantsByCategory));

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
  }, [currentUser, refreshUserData, variantsByCategory]);

  const categoryTotals = useMemo(() => {
    if (!variantCounts) return {};
    return Object.fromEntries(
      Object.entries(variantCounts).map(([catId, variants]) => [
        catId,
        Object.values(variants).reduce((sum, value) => sum + value, 0),
      ])
    );
  }, [variantCounts]);

  const currentRunDrinkCount = useMemo(() => {
    return Object.values(variantCounts).reduce((total, category) => {
      return total + Object.values(category || {}).reduce((sum, count) => sum + count, 0);
    }, 0);
  }, [variantCounts]);

  const value = {
    variantCounts,
    adjustVariantCount,
    resetRun,
    isResetting,
    isLoading,
    categoryTotals,
    currentRunDrinkCount,
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


