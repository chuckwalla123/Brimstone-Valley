import assert from 'node:assert/strict';

import {
  compileCandidateScorer,
  createCandidateScorer,
} from './src/ai/training/candidateScorer.js';
import {
  evaluateAndPromoteCandidate,
  evaluateCandidate,
  evaluatePromotionGate,
  wilsonLowerBound,
} from './src/ai/training/championEvaluation.js';
import { createMovementScenarioCorpus } from './src/ai/training/scenarioCorpus.js';

const [scenario] = createMovementScenarioCorpus({ randomCount: 0 })
  .filter((entry) => entry.id === 'shackled-frontline');
assert(scenario, 'Missing shackle fixture');

const model = compileCandidateScorer(createCandidateScorer({ hiddenSize: 16, dropoutRate: 0 }));
const evaluationProgress = [];
const completedMatches = [];
const first = await evaluateCandidate({
  candidateModel: model,
  scenarios: [scenario],
  maxRounds: 1,
  seed: 41,
  onProgress: (progress) => evaluationProgress.push(progress),
  onMatchComplete: (match) => completedMatches.push(match),
});
const second = await evaluateCandidate({
  candidateModel: model,
  scenarios: [scenario],
  maxRounds: 1,
  seed: 41,
});

assert.deepEqual(first, second, 'Seeded evaluation must be deterministic');
assert.equal(first.againstEasy.games, 2, 'Evaluation must play both candidate colors');
assert.deepEqual(evaluationProgress, [{ completed: 1, total: 1, benchmark: 'easyai' }]);
assert.deepEqual(completedMatches.map((match) => match.candidateSide), ['p1', 'p2']);
assert(completedMatches.every((match) => ['win', 'draw', 'loss', 'unfinished'].includes(match.candidateResult)));
assert.equal(first.againstChampion, null, 'MediumAI is not part of the evaluation benchmark');
assert.equal(first.againstEasy.wins + first.againstEasy.draws + first.againstEasy.losses + first.againstEasy.unfinished, 2);
assert.equal(first.againstEasy.bySide.p1.games, 1);
assert.equal(first.againstEasy.bySide.p2.games, 1);
assert.equal(
  first.againstEasy.bySide.p1.wins + first.againstEasy.bySide.p1.draws + first.againstEasy.bySide.p1.losses + first.againstEasy.bySide.p1.unfinished,
  1,
);
assert.equal(
  first.againstEasy.bySide.p2.wins + first.againstEasy.bySide.p2.draws + first.againstEasy.bySide.p2.losses + first.againstEasy.bySide.p2.unfinished,
  1,
);
assert.equal(
  first.againstEasy.bySide.p1.fallbackCount + first.againstEasy.bySide.p2.fallbackCount,
  first.againstEasy.fallbackCount,
);
assert.equal(
  first.againstEasy.bySide.p1.forcedSkipCount + first.againstEasy.bySide.p2.forcedSkipCount,
  first.againstEasy.forcedSkipCount,
);
assert(wilsonLowerBound(5, 10) >= 0 && wilsonLowerBound(5, 10) <= 1);

const failingGate = evaluatePromotionGate(first, { minGames: 3 });
assert.equal(failingGate.passed, false);
assert.equal(failingGate.checks.enoughEasyGames, false);

let promoted = false;
const result = await evaluateAndPromoteCandidate({
  candidateModel: model,
  scenarios: [scenario],
  maxRounds: 1,
  seed: 41,
  gate: {
    minGames: 2,
    minEasyWinRate: 0,
    minEasyWilsonLowerBound: 0,
    maxUnfinishedGames: 2,
  },
  onPromote: async () => {
    promoted = true;
  },
});
assert.equal(result.promotion.passed, true);
assert.equal(promoted, true);

model.dispose();
console.log('champion evaluation test passed');
