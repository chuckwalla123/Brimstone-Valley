import assert from 'node:assert/strict';

import { executeRound } from './src/battleEngine.js';
import { HEROES } from './src/heroes.js';
import { deepClone, makeEmptyMain, makeReserve } from './shared/gameLogic.js';
import {
  advanceToNextDecision,
  applyMovementAction,
  createTrainingState,
  getCurrentMover,
  getMovementSequence,
  isLegalMovementAction,
  listLegalMovementActions,
  resolveBattleRound,
} from './src/ai/training/environment.js';

const findHero = (id) => {
  const hero = HEROES.find((entry) => entry.id === id);
  assert(hero, `Missing test hero ${id}`);
  return deepClone(hero);
};

const createBoard = (side) => ({
  main: makeEmptyMain(side === 'p1' ? 'player1' : 'player2'),
  reserve: makeReserve(side === 'p1' ? 'player1' : 'player2'),
});

const placeHero = (board, index, heroId, effects = []) => {
  const hero = findHero(heroId);
  board[index] = {
    ...board[index],
    hero,
    effects,
    currentHealth: hero.health,
    currentArmor: hero.armor || 0,
    currentEnergy: hero.energy || 0,
    currentSpeed: hero.speed || 0,
    currentSpellPower: hero.spellPower || 0,
    _dead: false,
  };
};

const createFixture = () => {
  const p1 = createBoard('p1');
  const p2 = createBoard('p2');
  placeHero(p1.main, 0, 'warriorID');
  placeHero(p2.main, 0, 'warriorID');
  return {
    p1Main: p1.main,
    p1Reserve: p1.reserve,
    p2Main: p2.main,
    p2Reserve: p2.reserve,
    priorityPlayer: 'player1',
    roundNumber: 2,
  };
};

const withSeededRandom = async (seed, callback) => {
  const originalRandom = Math.random;
  let state = seed >>> 0;
  Math.random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  try {
    return await callback();
  } finally {
    Math.random = originalRandom;
  }
};

const stripEphemeralInstanceIds = (value) => {
  if (Array.isArray(value)) return value.map(stripEphemeralInstanceIds);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.toLowerCase().includes('instanceid'))
      .map(([key, entry]) => [key, stripEphemeralInstanceIds(entry)]),
  );
};

assert.deepEqual(getMovementSequence('player1'), ['p1', 'p2', 'p2', 'p1']);
assert.deepEqual(getMovementSequence('player2'), ['p2', 'p1', 'p1', 'p2']);

const movementFixture = createFixture();
placeHero(movementFixture.p1Reserve, 0, 'clericID');
movementFixture.p1Main[0].effects = [{ preventMovement: true }];
const trainingState = createTrainingState(movementFixture);

assert.equal(getCurrentMover(trainingState), 'p1');
assert.equal(
  isLegalMovementAction(trainingState, { type: 'move', sourceId: 'p1:0', destinationId: 'p1:1' }),
  false,
  'Shackled heroes must not have legal movement actions',
);
assert.equal(
  listLegalMovementActions(trainingState).some((action) => action.sourceId === 'p1:0'),
  false,
  'The legal action list must exclude shackled heroes',
);

const reserveMove = { type: 'move', sourceId: 'p1Reserve:0', destinationId: 'p1:1' };
assert.equal(isLegalMovementAction(trainingState, reserveMove), true);
const moved = applyMovementAction(trainingState, reserveMove);
assert.equal(moved.accepted, true);
assert.equal(moved.state.p1Main[1].hero.id, 'clericID');
assert.equal(moved.state.p1Reserve[0].hero, null);
assert.equal(trainingState.p1Reserve[0].hero.id, 'clericID', 'Transitions must not mutate their input state');

const finishedMovement = {
  ...moved.state,
  movementIndex: 3,
};
const finalMovement = await advanceToNextDecision(finishedMovement, {
  type: 'move',
  sourceId: 'p1:1',
  destinationId: 'p1:1',
});
assert.equal(finalMovement.accepted, true);
assert.equal(finalMovement.resolvedRound, true);
assert.equal(finalMovement.state.roundNumber, 3);

const parityFixture = createTrainingState(createFixture());
const directResult = await withSeededRandom(17, () => executeRound(
  {
    p1Board: deepClone(parityFixture.p1Main),
    p1Reserve: deepClone(parityFixture.p1Reserve),
    p2Board: deepClone(parityFixture.p2Main),
    p2Reserve: deepClone(parityFixture.p2Reserve),
    priorityPlayer: parityFixture.priorityPlayer,
    roundNumber: parityFixture.roundNumber,
    lastCastActionBySide: parityFixture.lastCastActionBySide,
    gameMode: parityFixture.gameMode,
  },
  {
    castDelayMs: 0,
    postEffectDelayMs: 0,
    reactionDelayMs: 0,
    postCastDelayMs: 0,
    onStep: null,
    quiet: true,
  },
));
const adapterResult = await withSeededRandom(17, () => resolveBattleRound(parityFixture));

assert.deepEqual(stripEphemeralInstanceIds(adapterResult.p1Main), stripEphemeralInstanceIds(directResult.p1Board));
assert.deepEqual(stripEphemeralInstanceIds(adapterResult.p1Reserve), stripEphemeralInstanceIds(directResult.p1Reserve));
assert.deepEqual(stripEphemeralInstanceIds(adapterResult.p2Main), stripEphemeralInstanceIds(directResult.p2Board));
assert.deepEqual(stripEphemeralInstanceIds(adapterResult.p2Reserve), stripEphemeralInstanceIds(directResult.p2Reserve));
assert.equal(adapterResult.priorityPlayer, directResult.priorityPlayer);
assert.deepEqual(
  stripEphemeralInstanceIds(adapterResult.lastCastActionBySide),
  stripEphemeralInstanceIds(directResult.lastCastActionBySide),
);

console.log('training environment parity test passed');
