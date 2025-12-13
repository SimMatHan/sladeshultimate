import { DRINK_CATEGORY_ID_SET } from "../constants/drinks.js";

export const DRINK_STORAGE_KEY = "sladesh:drink-log";
export const DRINK_SCHEMA_VERSION = 1;

const nowMs = () => Date.now();

const createRunId = (ts = nowMs()) => `run-${ts}`;

export const createEmptyState = (ts = nowMs()) => ({
  schemaVersion: DRINK_SCHEMA_VERSION,
  currentRunId: createRunId(ts),
  events: [],
  lastPersistedAt: null,
});

export function parseStoredState(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed?.schemaVersion !== DRINK_SCHEMA_VERSION) {
      return null;
    }
    if (!parsed.currentRunId || !Array.isArray(parsed.events)) {
      return null;
    }
    return {
      schemaVersion: DRINK_SCHEMA_VERSION,
      currentRunId: parsed.currentRunId,
      events: parsed.events,
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
      const target = findLastAdd(state.events, {
        runId: state.currentRunId,
        categoryId: action.categoryId,
        variationName: action.variationName,
      });
      if (!target) {
        return state;
      }
      const evt = {
        id: generateId(),
        op: "REMOVE",
        runId: state.currentRunId,
        categoryId: action.categoryId,
        variationName: action.variationName,
        source: action.source || "unknown",
        targetId: target.id,
        ts: stamp,
      };
      return { ...state, events: [...state.events, evt] };
    }
    case "RESET_RUN": {
      const nextRunId = createRunId(stamp);
      return { ...state, currentRunId: nextRunId };
    }
    default:
      return state;
  }
}

export function deriveState(state, variantsByCategory = {}) {
  const baseCounts = buildBaseCounts(variantsByCategory);
  const variantCounts = { ...baseCounts };

  const currentRunEvents = state.events.filter((evt) => evt.runId === state.currentRunId);
  currentRunEvents.forEach((evt) => {
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
