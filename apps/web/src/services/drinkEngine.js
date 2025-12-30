import { DRINK_CATEGORY_ID_SET } from "../constants/drinks.js";

export const DRINK_STORAGE_KEY = "sladesh:drink-log";
export const DRINK_SCHEMA_VERSION = 1;

const nowMs = () => Date.now();

const createRunId = (ts = nowMs()) => `run-${ts}`;

export const createEmptyState = (ts = nowMs()) => ({
  schemaVersion: DRINK_SCHEMA_VERSION,
  currentRunId: createRunId(ts),
  events: [],
  snapshot: null, // New: support for snapshot-based base state
  lastPersistedAt: null,
});

export function parseStoredState(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed?.schemaVersion !== DRINK_SCHEMA_VERSION) {
      return null;
    }
    // Allow hydration if either currentRunId+events OR snapshot exists
    if (!parsed.currentRunId || (!Array.isArray(parsed.events) && !parsed.snapshot)) {
      return null;
    }
    return {
      schemaVersion: DRINK_SCHEMA_VERSION,
      currentRunId: parsed.currentRunId,
      events: Array.isArray(parsed.events) ? parsed.events : [],
      snapshot: parsed.snapshot || null,
      lastPersistedAt: parsed.lastPersistedAt || null,
    };
  } catch {
    return null;
  }
}

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `evt-${Math.random().toString(16).slice(2)}-${Date.now()}`;
};

const buildBaseCounts = (variantsByCategory = {}) => {
  const base = {};
  Object.entries(variantsByCategory).forEach(([catId, variants]) => {
    base[catId] = variants.reduce((acc, variant) => {
      acc[variant.name] = 0;
      return acc;
    }, {});
  });
  return base;
};

const cloneWithCount = (target, categoryId, variationName) => {
  const catMap = target[categoryId] || {};
  const nextCatMap = { ...catMap };
  const existing = typeof nextCatMap[variationName] === "number" ? nextCatMap[variationName] : 0;
  nextCatMap[variationName] = existing;
  return { ...target, [categoryId]: nextCatMap };
};

const findLastAdd = (events, { runId, categoryId, variationName }) => {
  const consumed = new Set(
    events
      .filter((evt) => evt.op === "REMOVE" && evt.targetId)
      .map((evt) => evt.targetId)
  );

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const evt = events[i];
    if (
      evt.op === "ADD" &&
      evt.runId === runId &&
      evt.categoryId === categoryId &&
      evt.variationName === variationName &&
      !consumed.has(evt.id)
    ) {
      return evt;
    }
  }
  return null;
};

export function applyAction(state, action, ts = nowMs()) {
  const stamp = action?.ts ?? ts;
  switch (action.type) {
    case "HYDRATE": {
      const next = action.payload || createEmptyState(ts);
      return { ...next, schemaVersion: DRINK_SCHEMA_VERSION };
    }
    case "SET_SNAPSHOT": {
      // Re-initialize with a snapshot from Firestore
      // Clears events because the snapshot represents the 'current' authoritative state
      // Pending optimistic updates should be re-applied or handled by the caller if needed
      // (Our strategy: Call SET_SNAPSHOT only when idle, so clearing events is desired)
      return {
        ...state,
        events: [], // Clear events as they are now subsumed by the snapshot
        snapshot: action.payload, // The new authoritative baseline
        schemaVersion: DRINK_SCHEMA_VERSION
      };
    }
    case "ADD": {
      const evt = {
        id: generateId(),
        op: "ADD",
        runId: state.currentRunId,
        categoryId: action.categoryId,
        variationName: action.variationName,
        source: action.source || "unknown",
        ts: stamp,
      };
      return { ...state, events: [...state.events, evt] };
    }
    case "REMOVE": {
      // When working with snapshots, we might not find an 'ADD' event in the event log
      // because it's baked into the snapshot.
      // However, the event log logic here specifically looks for *events* to remove.
      // If we are snapshot-based, pure event-sourcing 'undo' is tricky without virtual events.
      // BUT: Our UI primarily uses 'ADD' for new drinks. 'REMOVE' is for undoing *recent* actions.
      // If a user tries to remove a drink that's in the snapshot but not in events,
      // this logic might fail to decrement if it relies on finding a targetId.
      // FIX: Allow REMOVE to work even if no target match found in *local events*,
      // basically treating it as a decrement event.
      // But `cloneWithCount` logic handles negative if we just record the op.
      // Let's create the event regardless.

      const target = findLastAdd(state.events, {
        runId: state.currentRunId,
        categoryId: action.categoryId,
        variationName: action.variationName,
      });

      // If we have a target (recent local add), we link to it.
      // If not, we still record the remove op (it will decrement the snapshot count).

      const evt = {
        id: generateId(),
        op: "REMOVE",
        runId: state.currentRunId,
        categoryId: action.categoryId,
        variationName: action.variationName,
        source: action.source || "unknown",
        targetId: target ? target.id : null,
        ts: stamp,
      };
      return { ...state, events: [...state.events, evt] };
    }
    case "RESET_RUN": {
      const nextRunId = createRunId(stamp);
      return {
        ...state,
        currentRunId: nextRunId,
        snapshot: null, // Clear snapshot on reset
        events: []
      };
    }
    default:
      return state;
  }
}

export function deriveState(state, variantsByCategory = {}) {
  // Start with empty base counts structure
  const baseCounts = buildBaseCounts(variantsByCategory);

  // If we have a snapshot, merge it into baseCounts
  // Snapshot format expected: { categoryId: { variantName: count } }
  const variantCounts = { ...baseCounts };

  if (state.snapshot) {
    Object.entries(state.snapshot).forEach(([catId, variants]) => {
      // Ensure category exists in variantsStructure
      if (!variantCounts[catId]) {
        // Should logically be there if DRINK_CATEGORY_ID_SET matches, but be safe
        variantCounts[catId] = {};
      }

      // Merge counts
      Object.entries(variants || {}).forEach(([name, count]) => {
        variantCounts[catId][name] = (variantCounts[catId][name] || 0) + count;
      });
    });
  }

  // Apply local events ON TOP of the snapshot
  const currentRunEvents = state.events.filter((evt) => evt.runId === state.currentRunId);
  currentRunEvents.forEach((evt) => {
    // Determine target map
    const safeTarget = cloneWithCount(variantCounts, evt.categoryId, evt.variationName);
    variantCounts[evt.categoryId] = safeTarget[evt.categoryId];

    if (evt.op === "ADD") {
      variantCounts[evt.categoryId][evt.variationName] += 1;
    } else if (evt.op === "REMOVE") {
      const current = variantCounts[evt.categoryId][evt.variationName] || 0;
      variantCounts[evt.categoryId][evt.variationName] = Math.max(0, current - 1);
    }
  });

  const categoryTotals = {};
  Object.entries(variantCounts).forEach(([catId, variants]) => {
    categoryTotals[catId] = Object.values(variants || {}).reduce((sum, count) => sum + count, 0);
  });

  const currentRunDrinkCount = Object.entries(variantCounts).reduce((sum, [catId, variants]) => {
    if (!DRINK_CATEGORY_ID_SET.has(catId)) return sum;
    return sum + Object.values(variants || {}).reduce((acc, value) => acc + value, 0);
  }, 0);

  const lifetimeTotals = {};
  // For lifetime, we can't easily use the snapshot + events without knowing lifetime baseline.
  // But usage of totalDrinks mostly comes from Firestore (userData.totalDrinks).
  // The local calculation here is likely for optimistic display.
  // We'll trust the 'snapshot' implies current run state.
  // Ideally, totalDrinks should be inputs + delta.
  // For now, let's keep it event-based or simple.
  // If we rely on userData for totalDrinks in context, this local value is less critical.
  state.events.forEach((evt) => {
    if (!DRINK_CATEGORY_ID_SET.has(evt.categoryId)) return;
    const prev = lifetimeTotals[evt.categoryId] || 0;
    if (evt.op === "ADD") {
      lifetimeTotals[evt.categoryId] = prev + 1;
    } else if (evt.op === "REMOVE") {
      lifetimeTotals[evt.categoryId] = Math.max(0, prev - 1);
    }
  });

  const totalDrinks = Object.values(lifetimeTotals).reduce((sum, count) => sum + count, 0);

  return {
    variantCounts,
    categoryTotals,
    currentRunDrinkCount,
    totalDrinks,
    lifetimeTotals,
    lastEventTs: state.events.length > 0 ? state.events[state.events.length - 1].ts : null,
  };
}

export function serializeState(state) {
  return JSON.stringify(state);
}
