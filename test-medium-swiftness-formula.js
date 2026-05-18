import assert from 'node:assert/strict';

import { getAI } from './src/ai/index.js';
import { HEROES } from './src/heroes.js';
import { deepClone } from './shared/gameLogic.js';

const mediumAI = getAI('medium');

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

const buildHero = (heroId) => {
  const hero = deepClone(HEROES.find(entry => entry.id === heroId));
  assert(hero, `Missing hero ${heroId}`);
  return hero;
};

const state = {
  p2Main: emptyMain('p2'),
  p2Reserve: emptyReserve('p2'),
  p1Main: emptyMain('p1'),
  p1Reserve: emptyReserve('p1'),
};

const pick = await mediumAI.makePickDecision([
  buildHero('ninjaID'),
  buildHero('warriorID'),
], state);

assert.equal(pick?.hero?.id, 'warriorID', `Expected Medium to stop overvaluing Ninja from swiftness as flat 18 damage, got ${pick?.hero?.id}`);

console.log('mediumAI swiftness formula regression test passed');