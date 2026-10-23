import assert from 'node:assert/strict';

import { createMovementScenarioCorpus } from './src/ai/training/scenarioCorpus.js';
import { generateMovementLabels } from './src/ai/training/labelGenerator.js';
import { isLegalMovementAction, listLegalMovementActions } from './src/ai/training/environment.js';

const [scenario] = createMovementScenarioCorpus({ randomCount: 0, seed: 1 })
  .filter((entry) => entry.id === 'shackled-frontline');
assert(scenario, 'Missing shackle fixture');

const first = await generateMovementLabels(scenario, { maxResponses: 2, seed: 77 });
const second = await generateMovementLabels(scenario, { maxResponses: 2, seed: 77 });

assert.deepEqual(first, second, 'Labels must be deterministic for a fixed scenario and seed');
assert.equal(first.perspectiveSide, 'p2');
assert.equal(first.labels.length, listLegalMovementActions(scenario.state).length);
assert(isLegalMovementAction(scenario.state, first.bestAction));
assert(first.labels.every((label) => isLegalMovementAction(scenario.state, label.action)));
assert(
  first.labels.every((label, index, labels) => index === 0 || labels[index - 1].score >= label.score),
  'Labels must be sorted best-to-worst for the active side',
);

console.log('movement label generator test passed');
