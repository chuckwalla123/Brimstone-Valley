import assert from 'node:assert/strict';

import { CANDIDATE_FEATURE_SIZE, encodeMovementCandidate } from './src/ai/training/candidateFeatures.js';
import {
  compileCandidateScorer,
  createCandidateScorer,
  prepareCandidateTrainingExamples,
  preparePairwiseRankingExamples,
  scoreLegalMovementActions,
  trainCandidateScorer,
} from './src/ai/training/candidateScorer.js';
import { createTrainingState, isLegalMovementAction } from './src/ai/training/environment.js';
import { generateMovementLabels } from './src/ai/training/labelGenerator.js';
import { createMovementScenarioCorpus } from './src/ai/training/scenarioCorpus.js';

const [scenario] = createMovementScenarioCorpus({ randomCount: 0 })
  .filter((entry) => entry.id === 'shackled-frontline');
assert(scenario, 'Missing shackle fixture');

const labelSet = await generateMovementLabels(scenario, { maxResponses: 2, seed: 77 });
const examples = prepareCandidateTrainingExamples([labelSet]);
assert.equal(examples.features.length, labelSet.labels.length);
assert.equal(examples.features[0].length, CANDIDATE_FEATURE_SIZE);
const pairs = preparePairwiseRankingExamples([labelSet], { minScoreGap: 0.01 });
assert(pairs.preferredFeatures.length > 0, 'Expected unequal legal-action pairs');
assert.equal(pairs.preferredFeatures.length, pairs.otherFeatures.length);
assert(pairs.scoreGaps.every((gap) => gap >= 0.01), 'Each preferred action must have a higher label score');
assert.equal(
  encodeMovementCandidate(labelSet.state, labelSet.labels[0].action, labelSet.perspectiveSide).length,
  CANDIDATE_FEATURE_SIZE,
);
const changedBoardState = createTrainingState(labelSet.state);
changedBoardState.p1Main[4].effects = [{ name: 'Strength', kind: 'buff' }];
assert.notDeepEqual(
  Array.from(encodeMovementCandidate(labelSet.state, labelSet.labels[0].action, labelSet.perspectiveSide)),
  Array.from(encodeMovementCandidate(changedBoardState, labelSet.labels[0].action, labelSet.perspectiveSide)),
  'A tactical change outside the source and destination tiles must change the candidate features',
);

const model = compileCandidateScorer(createCandidateScorer({ hiddenSize: 32, dropoutRate: 0 }));
const epochProgress = [];
const history = await trainCandidateScorer(model, [labelSet], {
  epochs: 2,
  batchSize: 8,
  onEpochEnd: (progress) => epochProgress.push(progress),
});
assert(Number.isFinite(history.history.loss.at(-1)), 'Candidate scorer training must produce a finite loss');
assert.deepEqual(epochProgress.map((progress) => progress.epoch), [1, 2]);

const ranked = await scoreLegalMovementActions(model, labelSet.state, labelSet.perspectiveSide);
assert.equal(ranked.length, labelSet.labels.length);
assert(ranked.every((entry) => isLegalMovementAction(labelSet.state, entry.action)));
assert(ranked.every((entry, index) => index === 0 || ranked[index - 1].score >= entry.score));

model.dispose();
console.log('movement candidate scorer test passed');
