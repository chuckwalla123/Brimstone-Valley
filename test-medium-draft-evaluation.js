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
  return board[index];
};

const baseState = () => ({
  p2Main: emptyMain('p2'),
  p2Reserve: emptyReserve('p2'),
  p1Main: emptyMain('p1'),
  p1Reserve: emptyReserve('p1'),
});

const cleanseDemandState = baseState();
placeHero(cleanseDemandState.p1Main, 4, 'poisonMageID');
placeHero(cleanseDemandState.p1Main, 0, 'fireGolemID');

const cleansePick = await ai.makePickDecision([
  buildHero('clericID'),
  buildHero('warriorID'),
], cleanseDemandState);

assert.equal(cleansePick?.hero?.id, 'clericID', `Expected Medium to value cleanse into enemy DOT pressure, got ${cleansePick?.hero?.id}`);

const buffPressureState = baseState();
placeHero(buffPressureState.p1Main, 4, 'kingID');
placeHero(buffPressureState.p1Main, 0, 'paladinID');

const buffPick = await ai.makePickDecision([
  buildHero('angelID'),
  buildHero('warriorID'),
], buffPressureState);

assert.equal(buffPick?.hero?.id, 'angelID', `Expected Medium to value buff removal into enemy buff pressure, got ${buffPick?.hero?.id}`);

const denyCounterState = baseState();
placeHero(denyCounterState.p2Main, 4, 'kingID');
placeHero(denyCounterState.p2Main, 0, 'paladinID');

const denyCounterPick = await ai.makePickDecision([
  buildHero('darkKnightID'),
  buildHero('shieldMaidenID'),
], denyCounterState);

assert.equal(denyCounterPick?.hero?.id, 'darkKnightID', `Expected Medium to deny the opponent the best anti-tank response, got ${denyCounterPick?.hero?.id}`);

const rockGolemOpenState = baseState();
placeHero(rockGolemOpenState.p1Main, 0, 'rockGolemID');

const rockGolemPool = [
  'lancerID', 'alchemistID', 'fallenAngelID', 'poisonMageID', 'demonID', 'elderID',
  'waterGolemID', 'necromancerID', 'specterID', 'nymphID', 'clericID', 'druidID',
  'innKeeperID', 'reaperID', 'bloodmageID', 'dragonID', 'mudGolemID', 'timeMageID',
  'behemothID', 'angelID', 'thiefID', 'darkMageID', 'pyroID', 'stonecasedKingID', 'monkID',
].map(buildHero);

const rockGolemPick = await ai.makePickDecision(rockGolemPool, rockGolemOpenState);

assert.notEqual(rockGolemPick?.hero?.id, 'monkID', 'Expected Medium to avoid Monk into an opening Rock Golem board.');

const preLancerFormationState = baseState();
placeHero(preLancerFormationState.p2Main, 1, 'executionerID');
placeHero(preLancerFormationState.p1Main, 2, 'demonID');

const preLancerFormationPool = [
  'darkMageID', 'innKeeperID', 'lightningMageID', 'axemanID', 'specterID', 'ironGolemID',
  'mudGolemID', 'apothecaryID', 'timeMageID', 'monkID', 'shieldMaidenID', 'necromancerID',
  'jesterID', 'priestID', 'nymphID', 'titanID', 'sorceressID', 'bountyHunterID',
  'archerID', 'clericID', 'elderID', 'lancerID',
].map(buildHero);

const preLancerFormationPick = await ai.makePickDecision(preLancerFormationPool, preLancerFormationState);

assert.notDeepEqual(
  { hero: preLancerFormationPick?.hero?.id, slotIndex: preLancerFormationPick?.slotIndex, slotType: preLancerFormationPick?.slotType },
  { hero: 'elderID', slotIndex: 0, slotType: 'main' },
  'Expected Medium to avoid drafting Elder into the vulnerable front slot before Lancer remains available as a response.',
);

console.log('mediumAI draft evaluation regression test passed');