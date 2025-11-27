import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUserData } from "./UserDataContext";
import { useDrinkVariants } from "../hooks/useDrinkVariants";
import { addDrink, removeDrink, resetCurrentRun } from "../services/userService";

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
  const [variantCounts, setVariantCounts] = useState(() => createZeroCounts(variantsByCategory));
  const [isResetting, setIsResetting] = useState(false);
  const prevVariantsRef = useRef(null);

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
        } else if (delta < 0) {
          await removeDrink(currentUser.uid, catId, variantName);
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
    [currentUser]
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


