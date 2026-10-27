import assert from 'node:assert/strict';

import { makeMovementDecision } from './src/ai/easyAIPlusAI.js';
import { evaluateHeroPointsWithOptions } from './src/ai/easyAI.js';
import {
  buildEasyAIPlusMovementCandidates,
  EASY_AI_PLUS_EVALUATION_OPTIONS,
} from './src/ai/training/easyAIPlusTeacher.js';
import { HEROES } from './src/heroes.js';
import { deepClone } from './shared/gameLogic.js';

const MIDDLE_ROW = new Set(['p2:1', 'p2:4', 'p2:7']);
const movement = { movementPhase: { sequence: ['p2'], index: 0 } };

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

const placeHero = (board, index, heroId, overrides = {}) => {
  const hero = deepClone(HEROES.find((entry) => entry.id === heroId));
  assert(hero, `Missing hero fixture: ${heroId}`);
  board[index] = {
    ...board[index],
    hero: { ...hero, ...overrides },
    currentHealth: Number(overrides.currentHealth ?? hero.health ?? 0),
    currentArmor: Number(overrides.currentArmor ?? hero.armor ?? 0),
    currentEnergy: Number(overrides.currentEnergy ?? hero.energy ?? 0),
    currentSpeed: Number(overrides.currentSpeed ?? hero.speed ?? 0),
    currentSpellPower: Number(overrides.currentSpellPower ?? hero.spellPower ?? 0),
    effects: [],
    _dead: false,
  };
};

const p2Board = emptyMain('p2');
const p2Reserve = emptyReserve('p2');
const p1Board = emptyMain('p1');
const p1Reserve = emptyReserve('p1');

// Assassin begins in the middle row, where Assassinate is active.
placeHero(p2Board, 4, 'assassinID', { currentEnergy: 0, currentSpeed: 3 });

// Five live enemies, all below the 3-energy threshold that EasyAIPlus treats as
// a possible Accept Contract / Mark setup. Their speed is intentionally 2 so
// they still cannot exceed four energy on the next gain from this state.
[2, 4, 5, 7, 8].forEach((index) => {
  placeHero(p1Board, index, 'warriorID', { currentEnergy: 2, currentSpeed: 2 });
});

const candidates = buildEasyAIPlusMovementCandidates(
  p2Board,
  p2Reserve,
  p1Board,
  p1Reserve,
  { opponentHasLastMove: false },
);
const decision = makeMovementDecision(p2Board, p2Reserve, movement, p1Board, p1Reserve);

assert.equal(p1Board.filter((tile) => tile.hero).length, 5);
assert(
  p1Board.filter((tile) => tile.hero).every((tile) => Number(tile.currentEnergy) <= 2),
  'Fixture enemies must all start at two energy or less',
);
assert.equal(decision.sourceId, 'p2:4');

const assassinMoves = candidates
  .filter((candidate) => candidate.sourceId === 'p2:4')
  .map(({ sourceId, destinationId, boardScore, effectScore, setupScore, totalScore, delta }) => ({
    sourceId,
    destinationId,
    boardScore,
    effectScore,
    setupScore,
    totalScore,
    delta,
  }));
const chosen = candidates.find((candidate) =>
  candidate.sourceId === decision.sourceId && candidate.destinationId === decision.destinationId
);

console.table(assassinMoves);
console.log('EasyAIPlus Assassinate energy-gate decision:', decision);
console.log('Chosen candidate:', chosen);

const scoreSidesAfterMovingAssassin = (destinationId) => {
  const destinationIndex = Number(destinationId.split(':')[1]);
  const simulatedP2Board = deepClone(p2Board);
  [simulatedP2Board[4], simulatedP2Board[destinationIndex]] = [
    simulatedP2Board[destinationIndex],
    simulatedP2Board[4],
  ];
  const p2Score = simulatedP2Board.reduce((sum, tile, index) => sum + (
    tile.hero
      ? evaluateHeroPointsWithOptions(
        tile.hero,
        index,
        true,
        p1Board,
        p1Reserve,
        simulatedP2Board,
        p2Reserve,
        tile,
        EASY_AI_PLUS_EVALUATION_OPTIONS,
      )
      : 0
  ), 0);
  const p1Score = p1Board.reduce((sum, tile, index) => sum + (
    tile.hero
      ? evaluateHeroPointsWithOptions(
        tile.hero,
        index,
        false,
        simulatedP2Board,
        p2Reserve,
        p1Board,
        p1Reserve,
        tile,
        EASY_AI_PLUS_EVALUATION_OPTIONS,
      )
      : 0
  ), 0);
  const p1HeroScores = p1Board.map((tile, index) => (
    tile.hero
      ? evaluateHeroPointsWithOptions(
        tile.hero,
        index,
        false,
        simulatedP2Board,
        p2Reserve,
        p1Board,
        p1Reserve,
        tile,
        EASY_AI_PLUS_EVALUATION_OPTIONS,
      )
      : null
  ));
  return { destinationId, p2Score, p1Score, boardScore: p2Score - p1Score, p1HeroScores };
};

const scoreBreakdowns = [
  scoreSidesAfterMovingAssassin('p2:4'),
  scoreSidesAfterMovingAssassin('p2:0'),
  scoreSidesAfterMovingAssassin('p2:2'),
];
console.table(scoreBreakdowns.map(({ p1HeroScores, ...summary }) => summary));
console.table(scoreBreakdowns.map(({ destinationId, p1HeroScores }) => ({ destinationId, ...p1HeroScores })));

assert(
  !MIDDLE_ROW.has(decision.destinationId),
  `Expected Assassin to leave Assassinate with no current or predicted Mark target, got ${decision.destinationId}`,
);

console.log('EasyAIPlus Assassinate energy-gate regression test passed');
