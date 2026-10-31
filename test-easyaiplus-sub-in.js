import assert from 'node:assert/strict';

import { makeEasyAIPlusMovementDecision } from './src/ai/training/easyAIPlusTeacher.js';
import { HEROES } from './src/heroes.js';
import { deepClone } from './shared/gameLogic.js';

const emptyTiles = (count, boardName) => Array.from({ length: count }, (_, index) => ({ hero: null, effects: [], boardName, index }));

const place = (tiles, index, heroId, currentHealth) => {
  const hero = deepClone(HEROES.find(entry => entry.id === heroId));
  assert(hero, `Missing hero ${heroId}`);
  tiles[index] = {
    ...tiles[index],
    hero,
    currentHealth: currentHealth ?? hero.health,
    currentArmor: hero.armor || 0,
    currentEnergy: 0,
    currentSpeed: hero.speed || 0,
    currentSpellPower: hero.spellPower || 0,
    effects: [],
    _dead: false,
  };
};

const p2Main = emptyTiles(9, 'p2Board');
const p2Reserve = emptyTiles(2, 'p2Reserve');
const p1Main = emptyTiles(9, 'p1Board');
const p1Reserve = emptyTiles(2, 'p1Reserve');

place(p2Main, 0, 'warriorID', 1);
place(p2Main, 3, 'warriorID', 1);
place(p2Main, 6, 'warriorID', 1);
place(p2Reserve, 0, 'warriorID');
place(p1Main, 0, 'warriorID');
place(p1Main, 3, 'warriorID');
place(p1Main, 6, 'warriorID');

const decision = makeEasyAIPlusMovementDecision(p2Main, p2Reserve, p1Main, p1Reserve, { movementPhase: { sequence: ['p2'], index: 0 } });
assert(decision.sourceId.startsWith('p2Reserve:') || decision.destinationId.startsWith('p2Reserve:'),
  `Expected a sub involving reserve when board heroes are nearly dead, got ${JSON.stringify(decision)}`);

console.log('EasyAIPlus sub-in regression test passed');
