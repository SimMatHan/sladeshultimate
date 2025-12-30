import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUserData } from "./UserDataContext";
import { useDrinkVariants } from "../hooks/useDrinkVariants";
import { useLocation } from "./LocationContext";
import { useChannel } from "../hooks/useChannel";
import { addDrink, removeDrink, resetCurrentRun, updateUserLocation, addDrinkLogEntry } from "../services/userService";
import { clearLeaderboardCache } from "../services/leaderboardService";
import { DRINK_CATEGORY_ID_SET, NON_DRINK_CATEGORY_ID_SET } from "../constants/drinks";
import {
  applyAction,
  createEmptyState,
  deriveState,
} from "../services/drinkEngine";

const DrinkLogContext = createContext(null);

const SPAM_WINDOW_MS = 6000;
const SPAM_THRESHOLD = 3;
const SPAM_COOLDOWN_MS = 20000;
// Optimistic window: Time in ms to ignore server updates after a local action
// This prevents "flicker" where old server data overwrites new local data
const OPTIMISTIC_WINDOW_MS = 3000;

const createTxnId = () => `txn-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;

export function DrinkLogProvider({ children }) {
  const { currentUser } = useAuth();
  const { userData, refreshUserData } = useUserData();
  const { variantsByCategory } = useDrinkVariants();
  const { userLocation, updateLocation } = useLocation();
  const { selectedChannel } = useChannel();

  // Initialize with empty state. Real hydration happens via userData/SET_SNAPSHOT.
  const [engineState, dispatch] = useReducer(applyAction, undefined, createEmptyState);

  const [spamCooldownUntil, setSpamCooldownUntil] = useState(null);
  const [spamMessage, setSpamMessage] = useState(null);
  const [spamCooldownRemainingMs, setSpamCooldownRemainingMs] = useState(0);
  const [isResetting, setIsResetting] = useState(false);

  const spamEventsRef = useRef([]);
  const derivedRef = useRef(null);
  const lastLocalActionTs = useRef(0);
  const remoteQueueRef = useRef(Promise.resolve());

  const derived = useMemo(() => deriveState(engineState, variantsByCategory), [engineState, variantsByCategory]);

  useEffect(() => {
    derivedRef.current = derived;
  }, [derived]);

  // SYNC LOGIC: Keep local 'engineState' in sync with Firestore 'userData'
  // 1. When userData loads/updates, update local snapshot
  // 2. Unless we have performed a local action recently (Optimistic Mode)
  useEffect(() => {
    if (!userData) return;

    const now = Date.now();
    const timeSinceLastAction = now - lastLocalActionTs.current;

    // If we are within the optimistic window, DO NOT overwrite local state with server data.
    // We trust our local state is "ahead" of the server.
    if (timeSinceLastAction < OPTIMISTIC_WINDOW_MS) {
      return;
    }

    // Otherwise, we are idle. Trust the server.
    // Sync local state to match server snapshot exactly.
    // This fixes the "Ghost Drinks" issue where local storage diverged from Firestore.
    if (userData.drinkVariations) {
      dispatch({
        type: "SET_SNAPSHOT",
        payload: userData.drinkVariations,
        ts: now
      });
    }
  }, [userData]);
  // Dependency on 'userData' ensures this runs whenever Firestore pushes a new document snapshot

  const enqueueRemote = useCallback((fn) => {
    remoteQueueRef.current = remoteQueueRef.current.catch(() => undefined).then(() => fn());
    return remoteQueueRef.current;
  }, []);

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
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [spamCooldownUntil, clearSpamCooldown]);

  const startSpamCooldown = useCallback((now = Date.now()) => {
    const endsAt = now + SPAM_COOLDOWN_MS;
    setSpamCooldownUntil(endsAt);
    setSpamMessage("Rolig nu Cowboy! Du logger meget hurtigt lige nu. Vent et øjeblik, så er du tilbage.");
    spamEventsRef.current = [];
  }, []);

  const syncRemote = useCallback(
    async (categoryId, variationName, delta, isNonDrink, txnId) => {
      if (!currentUser) return;
      try {
        if (delta > 0) {
          const locationPromise = updateLocation();
          await addDrink(currentUser.uid, categoryId, variationName);
          if (!isNonDrink && selectedChannel?.id) {
            clearLeaderboardCache(selectedChannel.id);
          }
          try {
            const resolvedLocation = await locationPromise;
            const locationToSave = resolvedLocation || userLocation || null;
            if (locationToSave) {
              const venue = selectedChannel?.name || "Ukendt sted";
              await updateUserLocation(currentUser.uid, {
                lat: locationToSave.lat,
                lng: locationToSave.lng,
                venue,
              });
            }
            await addDrinkLogEntry(currentUser.uid, {
              categoryId,
              variationName,
              channelId: selectedChannel?.id || null,
              location: locationToSave
                ? { lat: locationToSave.lat, lng: locationToSave.lng }
                : null,
            });
          } catch (locationError) {
            console.warn("location update failed", { error: locationError });
          }
        } else {
          await removeDrink(currentUser.uid, categoryId, variationName);
          if (!isNonDrink && selectedChannel?.id) {
            clearLeaderboardCache(selectedChannel.id);
          }
        }
        // Force refresh to ensure we get the updated state back confirmed
        await refreshUserData(true);
      } catch (error) {
        console.error("remote sync failed", { error });
      }
    },
    [currentUser, refreshUserData, selectedChannel, updateLocation, userLocation]
  );

  const adjustVariantCount = useCallback(
    (categoryId, variationName, delta, source = "button") => {
      const isNonDrinkCategory = NON_DRINK_CATEGORY_ID_SET.has(categoryId);
      const isDrinkCategory = DRINK_CATEGORY_ID_SET.has(categoryId) && !isNonDrinkCategory;

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
        spamEventsRef.current = [...recentEvents, now];
      }

      const txnId = createTxnId();

      // Update optimistic timestamp BEFORE dispatching
      lastLocalActionTs.current = Date.now();

      const action = {
        type: delta > 0 ? "ADD" : "REMOVE",
        categoryId,
        variationName,
        source,
        ts: Date.now(),
      };

      dispatch(action);

      enqueueRemote(() => syncRemote(categoryId, variationName, delta, isNonDrinkCategory, txnId));
    },
    [
      enqueueRemote,
      spamCooldownUntil,
      startSpamCooldown,
      syncRemote,
    ]
  );

  const resetRun = useCallback(async () => {
    const action = { type: "RESET_RUN", ts: Date.now() };

    lastLocalActionTs.current = Date.now();
    dispatch(action);

    if (!currentUser) {
      return true;
    }

    setIsResetting(true);
    try {
      await enqueueRemote(async () => {
        await resetCurrentRun(currentUser.uid);
        await refreshUserData(true);
      });
      return true;
    } catch (error) {
      console.error("remote reset failed", { error });
      return false;
    } finally {
      setIsResetting(false);
    }
  }, [currentUser, enqueueRemote, refreshUserData]);

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
    // Primary Source: derived (Synced to Firestore Snapshot + Optimistic Events)
    variantCounts: derived.variantCounts,
    categoryTotals: derived.categoryTotals,

    // For the "Big Number", we can be even safer and use userData directly if available and we are idle.
    // But since derived is now synced, derived.currentRunDrinkCount "should" be correct.
    // Using userData directly for the counter mimics the Leaderboard behavior perfectly.
    // Let's use userData for the single source of truth display, falling back to derived if nil.
    // Note: If we just clicked, derived is ahead. userData is behind.
    // We want to show the OPTIMISTIC value (derived) if we are in the optimistic window.
    currentRunDrinkCount: (Date.now() - lastLocalActionTs.current < OPTIMISTIC_WINDOW_MS)
      ? derived.currentRunDrinkCount
      : (userData?.currentRunDrinkCount ?? derived.currentRunDrinkCount),

    totalDrinks: derived.totalDrinks,
    adjustVariantCount,
    resetRun,
    isResetting,
    isLoading: !userData, // Ready when userData is loaded
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
