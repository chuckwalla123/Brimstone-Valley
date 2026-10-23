import assert from 'node:assert/strict';

import {
  compileCandidateScorer,
  createCandidateScorer,
  trainCandidateScorer,
} from './src/ai/training/candidateScorer.js';
import { generateMovementLabels } from './src/ai/training/labelGenerator.js';
import { createMovementScenarioCorpus } from './src/ai/training/scenarioCorpus.js';
import {
  evaluateHeldOutRanking,
  evaluateShallowSearchOracle,
  isCandidateQualityImproved,
} from './src/ai/training/trainingDiagnostics.js';

const [scenario] = createMovementScenarioCorpus({ randomCount: 0 })
  .filter((entry) => entry.id === 'shackled-frontline');
assert(scenario, 'Missing shackle fixture');

const labels = await generateMovementLabels(scenario, { maxResponses: 1, seed: 91 });
const model = compileCandidateScorer(createCandidateScorer({ hiddenSize: 16, dropoutRate: 0 }));
await trainCandidateScorer(model, [labels], { epochs: 1, batchSize: 8 });

const ranking = await evaluateHeldOutRanking(model, [labels], { disagreementLimit: 3 });
assert.equal(ranking.scenarios, 1);
assert(ranking.top1Agreement >= 0 && ranking.top1Agreement <= 1);
assert(ranking.topKAgreement >= ranking.top1Agreement);
assert(ranking.meanSpearmanCorrelation >= -1 && ranking.meanSpearmanCorrelation <= 1);
assert(ranking.disagreements.length <= 1);

const oracleProgress = [];
const oracle = await evaluateShallowSearchOracle([scenario], {
  maxResponses: 1,
  maxRounds: 1,
  seed: 91,
  onProgress: (progress) => oracleProgress.push(progress),
});
assert.equal(oracle.games, 2, 'Oracle benchmark must play both colors');
assert.equal(oracle.wins + oracle.draws + oracle.losses + oracle.unfinished, 2);
assert.deepEqual(oracleProgress, [{ completed: 1, total: 1 }]);

assert.equal(
  isCandidateQualityImproved(
    { easyScoreRate: 0.6, heldOutTop1Agreement: 0.5, heldOutSpearman: 0.1 },
    { easyScoreRate: 0.5, heldOutTop1Agreement: 0.9, heldOutSpearman: 0.9 },
  ),
  true,
);
assert.equal(
  isCandidateQualityImproved(
    { easyScoreRate: 0.5, heldOutTop1Agreement: 0.4, heldOutSpearman: 0.9 },
    { easyScoreRate: 0.5, heldOutTop1Agreement: 0.5, heldOutSpearman: 0.1 },
  ),
  false,
);

model.dispose();
console.log('training diagnostics test passed');
