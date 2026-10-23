import assert from 'node:assert/strict';

import {
  createMovementScenarioCorpus,
  createRandomMovementScenarios,
} from './src/ai/training/scenarioCorpus.js';
import {
  getCurrentMover,
  isLegalMovementAction,
  listLegalMovementActions,
} from './src/ai/training/environment.js';

const randomScenarios = createRandomMovementScenarios({ count: 24, seed: 90210 });
const repeatedRandomScenarios = createRandomMovementScenarios({ count: 24, seed: 90210 });

assert.deepEqual(randomScenarios, repeatedRandomScenarios, 'Seeded scenario generation must be deterministic');
assert.equal(randomScenarios.length, 24);

randomScenarios.forEach((scenario) => {
  const actions = listLegalMovementActions(scenario.state);
  assert(actions.length > 0, `${scenario.id} must have at least one legal action`);
  assert(actions.every((action) => isLegalMovementAction(scenario.state, action)), `${scenario.id} emitted an illegal action`);
  assert(['p1', 'p2'].includes(getCurrentMover(scenario.state)), `${scenario.id} has no active mover`);
});

const corpus = createMovementScenarioCorpus({ randomCount: 12, seed: 7 });
const fixtures = corpus.filter((scenario) => scenario.source === 'fixture');
assert.equal(fixtures.length, 5);
assert.deepEqual(
  fixtures.map((scenario) => scenario.id),
  [
    'injured-berserker-buffed-enemy',
    'cleanse-and-purify-counterplay',
    'shackled-frontline',
    'full-main-reserve-swap',
    'corpse-and-burn-opportunity',
  ],
);

const shackled = fixtures.find((scenario) => scenario.id === 'shackled-frontline');
assert(shackled);
assert.equal(
  listLegalMovementActions(shackled.state).some((action) => action.sourceId === 'p2:0'),
  false,
  'Shackled fixture must not offer moves from the locked hero',
);

const fullMain = fixtures.find((scenario) => scenario.id === 'full-main-reserve-swap');
assert(fullMain);
assert.equal(
  listLegalMovementActions(fullMain.state).some((action) => action.sourceId === 'p2Reserve:0' && /^p2:[0-8]$/.test(action.destinationId)),
  true,
  'A reserve hero may swap with a living main-board hero when the main board is full',
);

assert.equal(corpus.length, 17);

console.log('movement scenario corpus test passed');
