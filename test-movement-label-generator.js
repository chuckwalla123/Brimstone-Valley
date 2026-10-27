import assert from 'node:assert/strict';

import { createMovementScenarioCorpus } from './src/ai/training/scenarioCorpus.js';
import { evaluateEasyAIPlusPosition } from './src/ai/training/easyAIPlusTeacher.js';
import { evaluateMovementState, generateMovementLabels, MOVEMENT_LABEL_EVALUATOR } from './src/ai/training/labelGenerator.js';
import { getMovementSequence, isLegalMovementAction, listLegalMovementActions } from './src/ai/training/environment.js';

const [scenario] = createMovementScenarioCorpus({ randomCount: 0, seed: 1 })
  .filter((entry) => entry.id === 'shackled-frontline');
assert(scenario, 'Missing shackle fixture');

const first = await generateMovementLabels(scenario, { maxResponses: 2, seed: 77 });
const second = await generateMovementLabels(scenario, { maxResponses: 2, seed: 77 });
const sequence = getMovementSequence(scenario.state.priorityPlayer);
const opponentHasLastMove = (side) => (
  sequence[sequence.length - 1] !== side && scenario.state.movementIndex < sequence.length - 1
);
const mirror = (board) => Array.from({ length: 9 }, (_, index) => board[8 - index] || null);

assert.deepEqual(first, second, 'Labels must be deterministic for a fixed scenario and seed');
assert.equal(first.evaluator, MOVEMENT_LABEL_EVALUATOR);
assert.equal(first.perspectiveSide, 'p2');
assert.equal(
  evaluateMovementState(scenario.state, 'p2'),
  evaluateEasyAIPlusPosition(
    scenario.state.p2Main,
    scenario.state.p2Reserve,
    scenario.state.p1Main,
    scenario.state.p1Reserve,
    { opponentHasLastMove: opponentHasLastMove('p2') },
  ).totalScore,
  'P2 state scores must use the EasyAI+ position evaluator',
);
assert.equal(
  evaluateMovementState(scenario.state, 'p1'),
  evaluateEasyAIPlusPosition(
    mirror(scenario.state.p1Main),
    scenario.state.p1Reserve,
    mirror(scenario.state.p2Main),
    scenario.state.p2Reserve,
    { opponentHasLastMove: opponentHasLastMove('p1') },
  ).totalScore,
  'P1 state scores must mirror the board before applying the EasyAI+ position evaluator',
);
assert.equal(first.labels.length, listLegalMovementActions(scenario.state).length);
assert(isLegalMovementAction(scenario.state, first.bestAction));
assert(first.labels.every((label) => isLegalMovementAction(scenario.state, label.action)));
assert(
  first.labels.every((label, index, labels) => index === 0 || labels[index - 1].score >= label.score),
  'Labels must be sorted best-to-worst for the active side',
);

console.log('movement label generator test passed');
