import assert from 'node:assert/strict';

import { HEROES } from './src/heroes.js';
import { evaluateHeroPoints, evaluateTileValue } from './src/ai/easyAI.js';
import { deepClone } from './shared/gameLogic.js';

const heroById = (id) => {
  const hero = deepClone(HEROES.find(entry => entry.id === id));
  assert(hero, `Missing hero ${id}`);
  return hero;
};

const emptyMain = (side) => Array.from({ length: 9 }, (_, index) => ({
  id: `${side}-${index}`,
  player: side === 'p2' ? 'player2' : 'player1',
  boardName: side === 'p2' ? 'p2Board' : 'p1Board',
  index,
  hero: null,
  effects: [],
  type: 'main',
}));

const emptyReserve = (side) => Array.from({ length: 2 }, (_, index) => ({
  id: `${side}-r-${index}`,
  player: side === 'p2' ? 'player2' : 'player1',
  boardName: side === 'p2' ? 'p2Reserve' : 'p1Reserve',
  index,
  hero: null,
  effects: [],
  type: 'reserve',
}));

const placeHero = (board, index, hero) => {
  board[index] = {
    ...board[index],
    hero,
    currentHealth: hero.health,
    currentArmor: hero.armor,
    currentEnergy: hero.energy,
    currentSpeed: hero.speed,
    currentSpellPower: hero.spellPower || 0,
    effects: [],
    _dead: false,
  };
};

const state = {
  p2Main: emptyMain('p2'),
  p2Reserve: emptyReserve('p2'),
  p1Main: emptyMain('p1'),
  p1Reserve: emptyReserve('p1'),
};

placeHero(state.p1Main, 0, heroById('rockGolemID'));

const monk = heroById('monkID');
const lancer = heroById('lancerID');

const monkTileValue = evaluateTileValue(monk, 0, true, state.p1Main, state.p1Reserve, state.p2Main, state.p2Reserve);
const lancerTileValue = evaluateTileValue(lancer, 0, true, state.p1Main, state.p1Reserve, state.p2Main, state.p2Reserve);
const monkPoints = evaluateHeroPoints(monk, 0, true, state.p1Main, state.p1Reserve, state.p2Main, state.p2Reserve);
const lancerPoints = evaluateHeroPoints(lancer, 0, true, state.p1Main, state.p1Reserve, state.p2Main, state.p2Reserve);

assert.equal(monkTileValue, 1, `Expected Monk front-row tile value to fall back to basic attack only into Rock Golem, got ${monkTileValue}`);
assert.ok(lancerTileValue > monkTileValue, `Expected Lancer to keep positive front-row pressure into Rock Golem, got Monk ${monkTileValue}, Lancer ${lancerTileValue}`);
assert.ok(lancerPoints > monkPoints, `Expected Lancer hero points to exceed Monk into Rock Golem, got Monk ${monkPoints}, Lancer ${lancerPoints}`);

console.log('easyAI armor multiplier regression test passed');