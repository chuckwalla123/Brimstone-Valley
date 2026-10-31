import assert from 'node:assert/strict';

import { HEROES } from './src/heroes.js';
import {
  buildEasyAIPlusMovementCandidates,
  evaluateEasyAIPlusPosition,
} from './src/ai/training/easyAIPlusTeacher.js';
import { deepClone } from './shared/gameLogic.js';

const emptyBoard = (side) => Array.from({ length: 9 }, (_, index) => ({
  hero: null,
  effects: [],
  boardName: `${side}Board`,
  index,
}));

const tileFor = (heroId, side, index) => ({
  hero: deepClone(HEROES.find(hero => hero.id === heroId)),
  effects: [],
  boardName: `${side}Board`,
  index,
});

const p2Main = emptyBoard('p2');
// P2 column 0 is [0, 1, 2]. This is the vulnerable full stack.
p2Main[0] = tileFor('trollID', 'p2', 0);
p2Main[1] = tileFor('shieldMaidenID', 'p2', 1);
p2Main[2] = tileFor('darkKnightID', 'p2', 2);

const p1Main = emptyBoard('p1');
// P1 index 4 is its middle row, so Rider's active spell is Engage.
p1Main[4] = tileFor('riderID', 'p1', 4);

const emptyReserve = emptyBoard('p2');
const emptyEnemyReserve = emptyBoard('p1');

const withoutLastMove = evaluateEasyAIPlusPosition(
  p2Main,
  emptyReserve,
  p1Main,
  emptyEnemyReserve,
  { opponentHasLastMove: false },
);
const withLastMove = evaluateEasyAIPlusPosition(
  p2Main,
  emptyReserve,
  p1Main,
  emptyEnemyReserve,
  { opponentHasLastMove: true },
);

assert.equal(withoutLastMove.columnStackPenalty, 0);
assert.equal(withLastMove.columnStackPenalty, 8, 'Engage (4 damage) should penalize a full column by 2x damage');
assert.equal(
  withoutLastMove.totalScore - withLastMove.totalScore,
  8,
  'The column-stack penalty must reduce the final EasyAI+ position score',
);

const splitColumn = p2Main.map((tile, index) => index === 2 ? null : tile);
splitColumn[5] = tileFor('darkKnightID', 'p2', 5);
const splitColumnScore = evaluateEasyAIPlusPosition(
  splitColumn,
  emptyReserve,
  p1Main,
  emptyEnemyReserve,
  { opponentHasLastMove: true },
);
assert.equal(splitColumnScore.columnStackPenalty, 0, 'Moving one hero out of the stack should remove the penalty');

const mirroredP1Board = new Array(9).fill(null);
mirroredP1Board[8] = p2Main[0];
mirroredP1Board[7] = p2Main[1];
mirroredP1Board[6] = p2Main[2];
const mirroredP2Board = new Array(9).fill(null);
mirroredP2Board[4] = p1Main[4];
const p1PerspectiveCandidates = buildEasyAIPlusMovementCandidates(
  mirroredP1Board,
  [],
  mirroredP2Board,
  [],
  { opponentHasLastMove: true },
);
assert(
  p1PerspectiveCandidates.some(candidate => candidate.columnStackPenalty === 8),
  'Mirrored P1 evaluation must apply the same column-stack penalty',
);

console.log('EasyAIPlus column-stack penalty test passed');
