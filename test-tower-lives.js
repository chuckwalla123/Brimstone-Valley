import {
  TOWER_MAX_LIVES,
  completeLevel,
  createNewRun,
  loseTowerLife
} from './src/tower/towerState.js';

const savedValues = new Map();
globalThis.localStorage = {
  getItem: (key) => savedValues.get(key) ?? null,
  setItem: (key, value) => savedValues.set(key, value),
  removeItem: (key) => savedValues.delete(key)
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const run = createNewRun();
assert(run.lives === TOWER_MAX_LIVES, `Expected a new run to begin with ${TOWER_MAX_LIVES} lives`);

loseTowerLife(run);
assert(run.lives === TOWER_MAX_LIVES - 1, 'Expected a lost battle to consume one life');

for (let index = 0; index < TOWER_MAX_LIVES; index += 1) {
  loseTowerLife(run);
}
assert(run.lives === 0, 'Expected lives to never fall below zero');

run.lives = 1;
run.currentLevel = 5;
completeLevel(run, 'boss_test');
assert(run.lives === TOWER_MAX_LIVES, 'Expected defeating a boss to restore all lives');
assert(run.currentLevel === 6, 'Expected boss completion to advance the tower level');

console.log('Tower lives tests PASSED');
