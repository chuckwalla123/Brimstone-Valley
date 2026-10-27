import assert from 'node:assert/strict';

import { compileCandidateScorer, createCandidateScorer } from './src/ai/training/candidateScorer.js';
import { evaluateCandidate } from './src/ai/training/championEvaluation.js';
import { selectShortlistSearchAction } from './src/ai/training/hybridSelector.js';
import { generateMovementLabels } from './src/ai/training/labelGenerator.js';
import { createRandomMovementScenarios } from './src/ai/training/scenarioCorpus.js';
import { createBalancedRandomScenarios, deriveSeed } from './src/ai/training/scenarioSampling.js';
import { isCandidateQualityImproved } from './src/ai/training/trainingDiagnostics.js';
import { isLegalMovementAction } from './src/ai/training/environment.js';

assert.equal(deriveSeed(5, 'train', 1), deriveSeed(5, 'train', 1));
assert.notEqual(deriveSeed(5, 'train', 1), deriveSeed(5, 'train', 2));
assert.notEqual(deriveSeed(5, 'train', 1), deriveSeed(5, 'evaluation'));

const { scenarios: balanced } = await createBalancedRandomScenarios({ count: 2, seed: 11, minRounds: 2, maxRounds: 12 });
assert.equal(balanced.length, 2);
assert.equal(new Set(balanced.map((scenario) => scenario.id)).size, 2);

const [scenario] = createRandomMovementScenarios({ count: 1, seed: 3 });
const full = await generateMovementLabels(scenario, { maxResponses: 1, seed: 5 });
assert(full.labels.length >= 3, 'Test scenario needs several legal actions');
const subset = full.labels.slice(0, 2).map((label) => label.action);
const restricted = await generateMovementLabels(scenario, { maxResponses: 1, seed: 5, actions: subset });
assert.equal(restricted.labels.length, 2, 'Restricted search must only score the shortlisted actions');

const model = compileCandidateScorer(createCandidateScorer({ hiddenSize: 16, dropoutRate: 0 }));
const selection = await selectShortlistSearchAction(model, scenario.state, restricted.perspectiveSide, {
  shortlistSize: 3,
  maxResponses: 1,
  seed: 5,
});
assert.equal(selection.shortlist.length, 3);
assert(isLegalMovementAction(scenario.state, selection.action));
assert(selection.shortlist.some((entry) => entry.action.sourceId === selection.action.sourceId
  && entry.action.destinationId === selection.action.destinationId), 'Search must choose from the shortlist');

const hybrid = await evaluateCandidate({
  candidateModel: model,
  scenarios: [scenario],
  maxRounds: 2,
  seed: 9,
  candidateMode: 'hybrid',
  shortlistSize: 2,
  maxResponses: 1,
});
assert.equal(hybrid.againstEasyPlus.games, 2);
assert.equal(hybrid.againstEasyPlus.paired.scenarios, 1);
const pairedTotal = hybrid.againstEasyPlus.paired;
assert.equal(pairedTotal.wonBoth + pairedTotal.lostBoth + pairedTotal.split + pairedTotal.other, 1);

assert.equal(isCandidateQualityImproved({ baselineScoreRate: 0.5, pairedWinRate: 0.6 }, { baselineScoreRate: 0.5, pairedWinRate: 0.4 }), true);
assert.equal(isCandidateQualityImproved({ baselineScoreRate: 0.4, pairedWinRate: 0.9 }, { baselineScoreRate: 0.5, pairedWinRate: 0.4 }), false);

model.dispose();
console.log('movement hybrid and sampling test passed');
