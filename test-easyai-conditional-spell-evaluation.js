import assert from 'node:assert/strict';

import { makeMovementDecision } from './src/ai/easyAI.js';
import { EFFECTS } from './src/effects.js';
import { HEROES } from './src/heroes.js';
import { deepClone } from './shared/gameLogic.js';

const FRONT_ROW = new Set(['p2:0', 'p2:3', 'p2:6']);
const MIDDLE_ROW = new Set(['p2:1', 'p2:4', 'p2:7']);
const BACK_ROW = new Set(['p2:2', 'p2:5', 'p2:8']);

const emptyMain = (side) => Array.from({ length: 9 }, (_, index) => ({
  hero: null,
  effects: [],
  boardName: side === 'p2' ? 'p2Board' : 'p1Board',
  index,
}));

const emptyReserve = (side) => Array.from({ length: 2 }, (_, index) => ({
  hero: null,
  effects: [],
  boardName: side === 'p2' ? 'p2Reserve' : 'p1Reserve',
  index,
}));

const movement = { movementPhase: { sequence: ['p2'], index: 0 } };

function buildHero(heroId, overrides = {}) {
  const hero = deepClone(HEROES.find(entry => entry.id === heroId));
  assert(hero, `Missing hero ${heroId}`);
  Object.assign(hero, overrides);
  return hero;
}

function placeHero(board, index, heroId, overrides = {}) {
  const hero = buildHero(heroId, overrides);
  board[index] = {
    ...board[index],
    hero,
    currentHealth: Number(overrides.currentHealth ?? hero.currentHealth ?? hero.health ?? 0),
    currentArmor: Number(overrides.currentArmor ?? hero.currentArmor ?? hero.armor ?? 0),
    currentEnergy: Number(overrides.currentEnergy ?? hero.currentEnergy ?? hero.energy ?? 0),
    currentSpeed: Number(overrides.currentSpeed ?? hero.currentSpeed ?? hero.speed ?? 0),
    currentSpellPower: Number(overrides.currentSpellPower ?? hero.currentSpellPower ?? hero.spellPower ?? 0),
    effects: Array.isArray(overrides.effects) ? overrides.effects : [],
    _dead: overrides._dead === true,
  };
  return board[index];
}

function evaluateMove(setup) {
  const p2Board = emptyMain('p2');
  const p2Reserve = emptyReserve('p2');
  const p1Board = emptyMain('p1');
  const p1Reserve = emptyReserve('p1');
  setup({ p2Board, p2Reserve, p1Board, p1Reserve });
  return makeMovementDecision(p2Board, p2Reserve, movement, p1Board, p1Reserve);
}

const priestNoDebuffs = evaluateMove(({ p2Board, p1Board }) => {
  placeHero(p2Board, 4, 'priestID', { currentHealth: 8, currentArmor: 1, currentEnergy: 0, currentSpeed: 3, currentSpellPower: 0 });
  placeHero(p1Board, 4, 'warriorID', { currentHealth: 10, currentArmor: 0, currentEnergy: 0, currentSpeed: 3 });
});

assert.equal(priestNoDebuffs.sourceId, 'p2:4');
assert(!MIDDLE_ROW.has(priestNoDebuffs.destinationId), `Expected Priest to move off the no-op Cleanse row, got ${priestNoDebuffs.destinationId}`);

const injuredBerserker = evaluateMove(({ p2Board, p1Board }) => {
  placeHero(p2Board, 4, 'berserkerID', { currentHealth: 2, currentArmor: 0, currentEnergy: 0, currentSpeed: 3, currentSpellPower: 0 });
  placeHero(p1Board, 4, 'warriorID', { currentHealth: 20, currentArmor: 0, currentEnergy: 0, currentSpeed: 3 });
  placeHero(p1Board, 0, 'warriorID', {
    currentHealth: 20,
    currentArmor: 0,
    currentEnergy: 0,
    currentSpeed: 3,
    effects: [EFFECTS.Strength, EFFECTS.Power],
  });
});

assert.equal(injuredBerserker.sourceId, 'p2:4');
assert(FRONT_ROW.has(injuredBerserker.destinationId), `Expected injured Berserker to move into Berserk range, got ${injuredBerserker.destinationId}`);

const necromancerNoCorpse = evaluateMove(({ p2Board, p1Board }) => {
  placeHero(p2Board, 3, 'necromancerID', { currentHealth: 7, currentArmor: 2, currentEnergy: 0, currentSpeed: 3, currentSpellPower: 0 });
  placeHero(p1Board, 4, 'warriorID', { currentHealth: 10, currentArmor: 0, currentEnergy: 0, currentSpeed: 3 });
});

assert.equal(necromancerNoCorpse.sourceId, 'p2:3');
assert(BACK_ROW.has(necromancerNoCorpse.destinationId), `Expected Necromancer to leave the no-op Corpse Explosion row, got ${necromancerNoCorpse.destinationId}`);

const clericNoBuffs = evaluateMove(({ p2Board, p1Board }) => {
  placeHero(p2Board, 0, 'clericID', { currentHealth: 8, currentArmor: 0, currentEnergy: 0, currentSpeed: 3, currentSpellPower: 0 });
  placeHero(p1Board, 4, 'warriorID', { currentHealth: 10, currentArmor: 0, currentEnergy: 0, currentSpeed: 3 });
});

assert.equal(clericNoBuffs.sourceId, 'p2:0');
assert(!FRONT_ROW.has(clericNoBuffs.destinationId), `Expected Cleric to leave the no-op Purify row, got ${clericNoBuffs.destinationId}`);

const clericWithBuffedEnemy = evaluateMove(({ p2Board, p1Board }) => {
  placeHero(p2Board, 4, 'clericID', { currentHealth: 8, currentArmor: 0, currentEnergy: 0, currentSpeed: 3, currentSpellPower: 0 });
  placeHero(p1Board, 4, 'warriorID', { currentHealth: 10, currentArmor: 0, currentEnergy: 0, currentSpeed: 3, effects: [EFFECTS.Strength] });
});

assert.equal(clericWithBuffedEnemy.sourceId, 'p2:4');
assert(FRONT_ROW.has(clericWithBuffedEnemy.destinationId), `Expected Cleric to move into Purify when an enemy has a buff, got ${clericWithBuffedEnemy.destinationId}`);

const apothecaryNoDebuffs = evaluateMove(({ p2Board, p1Board }) => {
  placeHero(p2Board, 2, 'apothecaryID', { currentHealth: 9, currentArmor: 0, currentEnergy: 0, currentSpeed: 2, currentSpellPower: 0 });
  placeHero(p1Board, 4, 'warriorID', { currentHealth: 10, currentArmor: 0, currentEnergy: 0, currentSpeed: 3 });
});

assert.equal(apothecaryNoDebuffs.sourceId, 'p2:2');
assert(!BACK_ROW.has(apothecaryNoDebuffs.destinationId), `Expected Apothecary to leave the no-op Brimberry Leaves row, got ${apothecaryNoDebuffs.destinationId}`);

const apothecaryWithDebuffedAlly = evaluateMove(({ p2Board, p1Board }) => {
  placeHero(p2Board, 4, 'apothecaryID', { currentHealth: 9, currentArmor: 0, currentEnergy: 0, currentSpeed: 2, currentSpellPower: 0 });
  placeHero(p2Board, 0, 'warriorID', { currentHealth: 8, currentArmor: 0, currentEnergy: 0, currentSpeed: 3, effects: [EFFECTS.Poison] });
  placeHero(p1Board, 4, 'warriorID', { currentHealth: 10, currentArmor: 0, currentEnergy: 0, currentSpeed: 3 });
});

assert.equal(apothecaryWithDebuffedAlly.sourceId, 'p2:4');
assert(BACK_ROW.has(apothecaryWithDebuffedAlly.destinationId), `Expected Apothecary to move into Brimberry Leaves when an ally is debuffed, got ${apothecaryWithDebuffedAlly.destinationId}`);

const assassinNoMark = evaluateMove(({ p2Board, p1Board }) => {
  placeHero(p2Board, 4, 'assassinID', { currentHealth: 9, currentArmor: 0, currentEnergy: 0, currentSpeed: 3, currentSpellPower: 0 });
  placeHero(p1Board, 4, 'warriorID', { currentHealth: 10, currentArmor: 0, currentEnergy: 0, currentSpeed: 3 });
});

assert.equal(assassinNoMark.sourceId, 'p2:4');
assert(!MIDDLE_ROW.has(assassinNoMark.destinationId), `Expected Assassin to leave the no-op Assassinate row when no enemies are marked, got ${assassinNoMark.destinationId}`);

const fireGolemNoBurn = evaluateMove(({ p2Board, p1Board }) => {
  placeHero(p2Board, 8, 'fireGolemID', { currentHealth: 16, currentArmor: 0, currentEnergy: 0, currentSpeed: 2, currentSpellPower: 0 });
  placeHero(p1Board, 4, 'warriorID', { currentHealth: 10, currentArmor: 0, currentEnergy: 0, currentSpeed: 3 });
});

assert.equal(fireGolemNoBurn.sourceId, 'p2:8');
assert(!BACK_ROW.has(fireGolemNoBurn.destinationId), `Expected Fire Golem to leave the no-op Consume Burn row when no enemy has Burn, got ${fireGolemNoBurn.destinationId}`);

const fireGolemWithBurn = evaluateMove(({ p2Board, p1Board }) => {
  placeHero(p2Board, 4, 'fireGolemID', { currentHealth: 16, currentArmor: 0, currentEnergy: 0, currentSpeed: 2, currentSpellPower: 0 });
  placeHero(p1Board, 4, 'warriorID', { currentHealth: 10, currentArmor: 0, currentEnergy: 0, currentSpeed: 3, effects: [EFFECTS.Burn, EFFECTS.Burn] });
});

assert.equal(fireGolemWithBurn.sourceId, 'p2:4');
assert(BACK_ROW.has(fireGolemWithBurn.destinationId), `Expected Fire Golem to move into Consume Burn when an enemy Burn can be consumed, got ${fireGolemWithBurn.destinationId}`);

console.log('easyAI conditional spell evaluation regression test passed');