import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUserData } from "./UserDataContext";
import { useDrinkVariants } from "../hooks/useDrinkVariants";
import { useLocation } from "./LocationContext";
import { useChannel } from "../hooks/useChannel";
import { addDrink, addDrinkLogEntry, removeDrink, resetCurrentRun, updateUserLocation, syncCurrentRunToFirebase, loadCurrentRunFromFirebase, migrateLocalStorageToFirebase } from "../services/userService";
import { clearLeaderboardCache } from "../services/leaderboardService";
import { DRINK_CATEGORY_ID_SET, NON_DRINK_CATEGORY_ID_SET } from "../constants/drinks";
import {
  applyAction,
  createEmptyState,
  deriveState,
  parseStoredState,
  serializeState,
  DRINK_STORAGE_KEY,
} from "../services/drinkEngine";

const DrinkLogContext = createContext(null);

const SPAM_WINDOW_MS = 6000;
const SPAM_THRESHOLD = 3;
const SPAM_COOLDOWN_MS = 20000;
const STORAGE_DEBOUNCE_MS = 400;
const DEBUG_FLAG_KEY = "sladesh:drinkDebug";

const createTxnId = () => `txn-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;

const debugLog = (enabled, txnId, label, payload) => {
  if (!enabled) return;
  try {
    console.groupCollapsed(`[drink-debug][${txnId}] ${label}`);
    console.log(payload);
    console.groupEnd();
  } catch {
    console.log(`[drink-debug][${txnId}] ${label}`, payload);
  }
};

const readDebugFlag = () => {
  if (!import.meta.env.DEV) return false;
  try {
    return window.localStorage.getItem(DEBUG_FLAG_KEY) === "1";
  } catch {
    return false;
  }
};

const bootstrapState = () => {
  const debugEnabled = readDebugFlag();
  try {
    const raw = window.localStorage.getItem(DRINK_STORAGE_KEY);
    const parsed = parseStoredState(raw);
    const txnId = createTxnId();
    debugLog(debugEnabled, txnId, "localStorage read (initial)", {
      key: DRINK_STORAGE_KEY,
      bytes: raw ? raw.length : 0,
      parsed: Boolean(parsed),
    });
    return parsed || createEmptyState();
  } catch (error) {
    debugLog(readDebugFlag(), createTxnId(), "localStorage read failed", { error });
    return createEmptyState();
  }
};

export function DrinkLogProvider({ children }) {
  const { currentUser } = useAuth();
  const { refreshUserData } = useUserData();
  const { variantsByCategory } = useDrinkVariants();
  const { userLocation, updateLocation } = useLocation();
  const { selectedChannel } = useChannel();

  const debugEnabled = readDebugFlag();
  const [engineState, dispatch] = useReducer(applyAction, undefined, bootstrapState);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [spamCooldownUntil, setSpamCooldownUntil] = useState(null);
  const [spamMessage, setSpamMessage] = useState(null);
  const [spamCooldownRemainingMs, setSpamCooldownRemainingMs] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const spamEventsRef = useRef([]);
  const derivedRef = useRef(null);
  const persistTimerRef = useRef(null);
  const lastActionIdRef = useRef(null);
  const remoteQueueRef = useRef(Promise.resolve());

  const derived = useMemo(() => deriveState(engineState, variantsByCategory), [engineState, variantsByCategory]);
  useEffect(() => {
    derivedRef.current = derived;
  }, [derived]);

  // Firebase hydration: Load from Firebase on mount, migrate localStorage if needed
  useEffect(() => {
    let isMounted = true;

    const hydrateFromFirebase = async () => {
      if (!currentUser) {
        setHasHydrated(true);
        return;
      }

      try {
        const txnId = createTxnId();

        // Load from Firebase
        const firebaseState = await loadCurrentRunFromFirebase(currentUser.uid);

        if (!isMounted) return;

        if (firebaseState) {
          // Firebase has data, use it
          debugLog(debugEnabled, txnId, "Hydrating from Firebase", {
            runId: firebaseState.currentRunId,
            eventCount: firebaseState.events?.length || 0
          });

          dispatch({ type: "HYDRATE", payload: firebaseState, ts: Date.now() });
        } else {
          // No Firebase data, check if we need to migrate localStorage
          const localState = bootstrapState();

          if (localState.events && localState.events.length > 0) {
            debugLog(debugEnabled, txnId, "Migrating localStorage to Firebase", {
              eventCount: localState.events.length
            });

            await migrateLocalStorageToFirebase(currentUser.uid, localState);
          }
        }
      } catch (error) {
        console.error('[DrinkLogContext] Firebase hydration failed', error);
      } finally {
        if (isMounted) {
          setHasHydrated(true);
        }
      }
    };

    hydrateFromFirebase();

    return () => {
      isMounted = false;
    };
  }, [currentUser, debugEnabled]);

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

  useEffect(() => {
    if (!hasHydrated) return undefined;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      try {
        const payload = { ...engineState, lastPersistedAt: Date.now() };
        const serialized = serializeState(payload);

        // Persist to localStorage (for offline support)
        window.localStorage.setItem(DRINK_STORAGE_KEY, serialized);
        debugLog(debugEnabled, lastActionIdRef.current || createTxnId(), "localStorage write", {
          key: DRINK_STORAGE_KEY,
          bytes: serialized.length,
          events: payload.events.length,
          runId: payload.currentRunId,
        });

        // Also sync to Firebase (for cross-device sync)
        if (currentUser) {
          syncCurrentRunToFirebase(currentUser.uid, payload).catch(error => {
            console.error('[DrinkLogContext] Firebase sync failed', error);
          });
        }
      } catch (error) {
        debugLog(debugEnabled, lastActionIdRef.current || createTxnId(), "localStorage write failed", { error });
      }
    }, STORAGE_DEBOUNCE_MS);
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [engineState, hasHydrated, debugEnabled, currentUser]);

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
            debugLog(debugEnabled, txnId, "location update failed", { error: locationError });
          }
        } else {
          await removeDrink(currentUser.uid, categoryId, variationName);
          if (!isNonDrink && selectedChannel?.id) {
            clearLeaderboardCache(selectedChannel.id);
          }
        }
        await refreshUserData(true);
      } catch (error) {
        debugLog(debugEnabled, txnId, "remote sync failed", { error });
      }
    },
    [currentUser, debugEnabled, refreshUserData, selectedChannel, updateLocation, userLocation]
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
      const action = {
        type: delta > 0 ? "ADD" : "REMOVE",
        categoryId,
        variationName,
        source,
        ts: Date.now(),
      };

      const previewState = applyAction(engineState, action, action.ts);
      if (previewState === engineState) {
        debugLog(debugEnabled, txnId, "noop remove", { categoryId, variationName });
        return;
      }

      const before = derivedRef.current;
      const after = deriveState(previewState, variantsByCategory);

      debugLog(debugEnabled, txnId, `action:${action.type}`, {
        action,
        before: {
          currentRunDrinkCount: before?.currentRunDrinkCount,
          variantCounts: before?.variantCounts,
        },
        after: {
          currentRunDrinkCount: after.currentRunDrinkCount,
          variantCounts: after.variantCounts,
        },
      });

      dispatch(action);
      lastActionIdRef.current = txnId;

      enqueueRemote(() => syncRemote(categoryId, variationName, delta, isNonDrinkCategory, txnId));
    },
    [
      debugEnabled,
      engineState,
      enqueueRemote,
      spamCooldownUntil,
      startSpamCooldown,
      syncRemote,
      variantsByCategory,
    ]
  );

  const resetRun = useCallback(async () => {
    const txnId = createTxnId();
    const action = { type: "RESET_RUN", ts: Date.now() };
    const previewState = applyAction(engineState, action, action.ts);
    const before = derivedRef.current;
    const after = deriveState(previewState, variantsByCategory);

    debugLog(debugEnabled, txnId, "action:RESET_RUN", {
      before: {
        currentRunDrinkCount: before?.currentRunDrinkCount,
        variantCounts: before?.variantCounts,
      },
      after: {
        currentRunDrinkCount: after.currentRunDrinkCount,
        variantCounts: after.variantCounts,
      },
    });

    dispatch(action);
    lastActionIdRef.current = txnId;

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
      debugLog(debugEnabled, txnId, "remote reset failed", { error });
      return false;
    } finally {
      setIsResetting(false);
    }
  }, [currentUser, debugEnabled, engineState, enqueueRemote, refreshUserData, variantsByCategory]);

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
    variantCounts: derived.variantCounts,
    categoryTotals: derived.categoryTotals,
    currentRunDrinkCount: derived.currentRunDrinkCount,
    totalDrinks: derived.totalDrinks,
    adjustVariantCount,
    resetRun,
    isResetting,
    isLoading: !hasHydrated,
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
