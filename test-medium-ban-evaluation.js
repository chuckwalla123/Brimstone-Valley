import assert from 'node:assert/strict';

import { getAI } from './src/ai/index.js';
import { HEROES } from './src/heroes.js';
import { deepClone } from './shared/gameLogic.js';

const ai = getAI('medium');

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

const placeHero = (board, index, heroId) => {
  const hero = buildHero(heroId);
  board[index] = {
    ...board[index],
    hero,
    currentHealth: Number(hero.currentHealth ?? hero.health ?? 0),
    currentArmor: Number(hero.currentArmor ?? hero.armor ?? 0),
    currentEnergy: Number(hero.currentEnergy ?? hero.energy ?? 0),
    currentSpeed: Number(hero.currentSpeed ?? hero.speed ?? 0),
    currentSpellPower: Number(hero.currentSpellPower ?? hero.spellPower ?? 0),
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

placeHero(state.p2Main, 4, 'kingID');
placeHero(state.p2Main, 0, 'paladinID');

const ban = await ai.makeBanDecision([
  buildHero('darkKnightID'),
  buildHero('shieldMaidenID'),
  buildHero('warriorID'),
], state);

assert.equal(ban?.id, 'darkKnightID', `Expected Medium to ban the strongest anti-tank counter, got ${ban?.id}`);

const noContextBan = await ai.makeBanDecision([
  buildHero('darkKnightID'),
  buildHero('shieldMaidenID'),
  buildHero('warriorID'),
]);

assert.equal(noContextBan?.id, 'darkKnightID', `Expected Medium to use simulation-first logic even without board context, got ${noContextBan?.id}`);

console.log('mediumAI ban evaluation regression test passed');