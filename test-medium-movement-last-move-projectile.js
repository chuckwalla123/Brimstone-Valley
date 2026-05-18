import assert from 'node:assert/strict';

import { getAI } from './src/ai/index.js';
import { HEROES } from './src/heroes.js';
import { deepClone } from './shared/gameLogic.js';

const ai = getAI('medium');

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

const buildHero = (heroId) => {
  const hero = deepClone(HEROES.find((entry) => entry.id === heroId));
  assert(hero, `Missing hero ${heroId}`);
  return hero;
};

const placeHero = (board, index, heroId, overrides = {}) => {
  const hero = buildHero(heroId);
  board[index] = {
    ...board[index],
    hero: { ...hero, ...overrides },
    currentHealth: Number(overrides.currentHealth ?? hero.health ?? 0),
    currentArmor: Number(overrides.currentArmor ?? hero.armor ?? 0),
    currentEnergy: Number(overrides.currentEnergy ?? hero.energy ?? 0),
    currentSpeed: Number(overrides.currentSpeed ?? hero.speed ?? 0),
    currentSpellPower: Number(overrides.currentSpellPower ?? hero.spellPower ?? 0),
    effects: Array.isArray(overrides.effects) ? overrides.effects : [],
    _dead: false,
  };
};

const p2Board = emptyMain('p2');
const p2Reserve = emptyReserve('p2');
const p1Board = emptyMain('p1');
const p1Reserve = emptyReserve('p1');

placeHero(p2Board, 0, 'witchDoctorID');
placeHero(p2Board, 1, 'warriorID');
placeHero(p1Board, 2, 'warriorID');
placeHero(p1Board, 5, 'warriorID');
placeHero(p1Board, 8, 'warriorID');

const movement = { movementPhase: { sequence: ['p1', 'p2', 'p2', 'p1'], index: 2 } };
const move = await ai.makeMovementDecision(p2Board, p2Reserve, movement, p1Board, p1Reserve);

assert.deepEqual(
  move,
  { sourceId: 'p2:0', destinationId: 'p2:0' },
  'Expected Medium to hold position instead of walking Witch Doctor into a Toads setup that player1 can erase with the last movement.',
);

console.log('mediumAI last-move projectile movement regression test passed');