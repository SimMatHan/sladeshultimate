import { useCallback, useEffect, useState } from "react";
import { DEFAULT_VARIANTS } from "../constants/drinks";
import { fetchDrinkVariantsOnce, subscribeToDrinkVariants } from "../services/drinkService";

export function useDrinkVariants(options = {}) {
  const { enabled = true } = options;

  const [variantsByCategory, setVariantsByCategory] = useState(DEFAULT_VARIANTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setVariantsByCategory(DEFAULT_VARIANTS);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      const merged = await fetchDrinkVariantsOnce();
      setVariantsByCategory(merged);
      setError(null);
    } catch (err) {
      console.error("Failed to refresh drink variants", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setVariantsByCategory(DEFAULT_VARIANTS);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const unsubscribe = subscribeToDrinkVariants(
      (mergedVariants) => {
        setVariantsByCategory(mergedVariants);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Drink variants subscription failed", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [enabled]);

  return {
    variantsByCategory,
    loading,
    error,
    refresh,
  };
}

