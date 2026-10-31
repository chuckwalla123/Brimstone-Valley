import { processMove } from './shared/gameLogic.js';

function makeHero(id, name) {
  return {
    id,
    name,
    health: 15,
    armor: 0,
    speed: 5,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 1, casts: 1 },
      middle: { id: 'basicAttack', cost: 1, casts: 1 },
      back: { id: 'basicAttack', cost: 1, casts: 1 }
    }
  };
}

function makeBoard(player, hero) {
  return Array.from({ length: 9 }, (_, index) => ({
    id: `${player}-main-${index}`,
    player,
    index,
    hero: index === 0 ? hero : null,
    type: 'main'
  }));
}

const result = await processMove(
  {
    p1Main: makeBoard('player1', makeHero('queue-cap-p1', 'Queue Cap P1')),
    p2Main: makeBoard('player2', makeHero('queue-cap-p2', 'Queue Cap P2')),
    p1Reserve: [],
    p2Reserve: [],
    roundNumber: 0,
    priorityPlayer: 'player1',
    phase: 'battle'
  },
  { type: 'startRound', priorityPlayer: 'player1', speedMultiplier: 30 },
  null,
  { returnSteps: true, maxStepQueueLength: 1 }
);

if (!result.stepsTruncated || result.generatedStepCount <= 1 || result.steps.length !== 1) {
  throw new Error(`Expected a capped queue, received ${JSON.stringify({
    stepsTruncated: result.stepsTruncated,
    generatedStepCount: result.generatedStepCount,
    bufferedSteps: result.steps.length
  })}`);
}

const finalStep = result.steps[0];
if (finalStep?.type !== 'roundComplete' || !finalStep?.state?.p1Main || !finalStep?.state?.p2Main) {
  throw new Error('Expected the capped queue to retain the final authoritative round snapshot.');
}

console.log('Battle step queue cap regression PASSED');
