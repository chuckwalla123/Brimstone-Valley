import assert from 'node:assert/strict';

import { buildEasyAIPlusMovementCandidates } from './src/ai/training/easyAIPlusTeacher.js';
import { HEROES } from './src/heroes.js';
import { deepClone } from './shared/gameLogic.js';

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

const placeHero = (board, index, heroId) => {
  const hero = deepClone(HEROES.find((entry) => entry.id === heroId));
  assert(hero, `Missing hero fixture: ${heroId}`);
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

const scoreTinkererRows = (enemyIndices) => {
  const p2Board = emptyMain('p2');
  const p2Reserve = emptyReserve('p2');
  const p1Board = emptyMain('p1');
  const p1Reserve = emptyReserve('p1');
  placeHero(p2Board, 0, 'tinkererID');
  enemyIndices.forEach((index) => placeHero(p1Board, index, 'warriorID'));

  const candidates = buildEasyAIPlusMovementCandidates(p2Board, p2Reserve, p1Board, p1Reserve);
  const landMine = candidates.find((candidate) => candidate.sourceId === 'p2:0' && candidate.destinationId === 'p2:0');
  const buildTurret = candidates.find((candidate) => candidate.sourceId === 'p2:0' && candidate.destinationId === 'p2:1');
  assert(landMine, 'Missing Tinkerer Land Mine candidate');
  assert(buildTurret, 'Missing Tinkerer Build Turret candidate');

  return {
    enemyCount: enemyIndices.length,
    landMine: landMine.totalScore,
    buildTurret: buildTurret.totalScore,
  };
};

const sparseBoard = scoreTinkererRows([4]);
const crowdedBoard = scoreTinkererRows([2, 4, 5, 7, 8]);

console.table([sparseBoard, crowdedBoard]);
for (const result of [sparseBoard, crowdedBoard]) {
  assert(
    result.buildTurret > result.landMine,
    `Expected Build Turret to outrank Land Mine against ${result.enemyCount} enemy hero(es)`,
  );
}

console.log('EasyAIPlus Tinkerer Land Mine scoring regression test passed');
