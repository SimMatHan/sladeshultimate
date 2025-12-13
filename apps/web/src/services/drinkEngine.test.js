import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  createEmptyState,
  deriveState,
  parseStoredState,
  serializeState,
} from "./drinkEngine.js";

const variantsByCategory = {
  beer: [{ name: "IPA" }, { name: "Lager" }],
  shot: [{ name: "Tequila" }],
};

test("add 5 -> total 5", () => {
  let state = createEmptyState(0);
  for (let i = 0; i < 5; i += 1) {
    state = applyAction(state, { type: "ADD", categoryId: "beer", variationName: "IPA", source: "test" }, i);
  }
  const derived = deriveState(state, variantsByCategory);
  assert.equal(derived.currentRunDrinkCount, 5);
  assert.equal(derived.totalDrinks, 5);
  assert.equal(derived.variantCounts.beer.IPA, 5);
});

test("add multiple variations -> totals and map correct", () => {
  let state = createEmptyState(0);
  state = applyAction(state, { type: "ADD", categoryId: "beer", variationName: "IPA", source: "test" });
  state = applyAction(state, { type: "ADD", categoryId: "beer", variationName: "IPA", source: "test" });
  state = applyAction(state, { type: "ADD", categoryId: "beer", variationName: "Lager", source: "test" });
  state = applyAction(state, { type: "ADD", categoryId: "shot", variationName: "Tequila", source: "test" });
  state = applyAction(state, { type: "ADD", categoryId: "shot", variationName: "Tequila", source: "test" });

  const derived = deriveState(state, variantsByCategory);
  assert.equal(derived.currentRunDrinkCount, 5);
  assert.deepEqual(derived.variantCounts.beer, { IPA: 2, Lager: 1 });
  assert.deepEqual(derived.variantCounts.shot, { Tequila: 2 });
});

test("minus removes the latest add for a variation", () => {
  let state = createEmptyState(0);
  state = applyAction(state, { type: "ADD", categoryId: "beer", variationName: "IPA", source: "test" }, 1);
  state = applyAction(state, { type: "ADD", categoryId: "beer", variationName: "IPA", source: "test" }, 2);
  state = applyAction(state, { type: "REMOVE", categoryId: "beer", variationName: "IPA", source: "test" }, 3);

  const derived = deriveState(state, variantsByCategory);
  assert.equal(derived.variantCounts.beer.IPA, 1);
  assert.equal(derived.currentRunDrinkCount, 1);
  assert.equal(derived.totalDrinks, 1);
});

test("reset starts a new run and clears current counts", () => {
  let state = createEmptyState(0);
  state = applyAction(state, { type: "ADD", categoryId: "beer", variationName: "IPA", source: "test" }, 1);

  const firstRunId = state.currentRunId;
  state = applyAction(state, { type: "RESET_RUN" }, 2);
  const derived = deriveState(state, variantsByCategory);

  assert.notEqual(state.currentRunId, firstRunId);
  assert.equal(derived.currentRunDrinkCount, 0);
  assert.equal(derived.totalDrinks, 1);
});

test("state survives serialize/parse and hydration", () => {
  let state = createEmptyState(0);
  state = applyAction(state, { type: "ADD", categoryId: "beer", variationName: "IPA", source: "test" }, 1);
  state = applyAction(state, { type: "ADD", categoryId: "shot", variationName: "Tequila", source: "test" }, 2);

  const serialized = serializeState(state);
  const parsed = parseStoredState(serialized);
  assert.ok(parsed);

  const derived = deriveState(parsed, variantsByCategory);
  assert.equal(derived.currentRunDrinkCount, 2);
  assert.equal(derived.totalDrinks, 2);
  assert.equal(derived.variantCounts.beer.IPA, 1);
  assert.equal(derived.variantCounts.shot.Tequila, 1);
});
