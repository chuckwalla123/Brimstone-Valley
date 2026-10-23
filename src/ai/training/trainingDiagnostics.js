import { scoreLegalMovementActions } from './candidateScorer.js';
import { playMovementControllerMatch } from './championEvaluation.js';
import { generateMovementLabels } from './labelGenerator.js';

const actionKey = (action) => `${action.type}:${action.sourceId || ''}:${action.destinationId || ''}`;

const rankByTarget = (labels) => [...labels].sort((left, right) => {
  const difference = right.score - left.score;
  if (difference !== 0) return difference;
  return actionKey(left.action).localeCompare(actionKey(right.action));
});

const spearmanCorrelation = (expected, actual) => {
  const expectedRanks = new Map(expected.map((entry, index) => [actionKey(entry.action), index + 1]));
  const actualRanks = new Map(actual.map((entry, index) => [actionKey(entry.action), index + 1]));
  const count = expectedRanks.size;
  if (count < 2) return 1;

  let squaredDifference = 0;
  expectedRanks.forEach((rank, key) => {
    const actualRank = actualRanks.get(key);
    squaredDifference += (rank - actualRank) ** 2;
  });
  return 1 - ((6 * squaredDifference) / (count * (count ** 2 - 1)));
};

export const evaluateHeldOutRanking = async (model, labelSets, {
  topK = 3,
  disagreementLimit = 20,
} = {}) => {
  let top1Matches = 0;
  let topKMatches = 0;
  let total = 0;
  let correlationTotal = 0;
  const disagreements = [];

  for (const labelSet of labelSets) {
    const expected = rankByTarget(labelSet.labels);
    const predicted = await scoreLegalMovementActions(model, labelSet.state, labelSet.perspectiveSide);
    if (expected.length !== predicted.length) {
      throw new Error(`Held-out ranking action mismatch for ${labelSet.scenarioId || 'unnamed scenario'}`);
    }

    total += 1;
    correlationTotal += spearmanCorrelation(expected, predicted);
    const expectedBest = expected[0];
    const predictedBest = predicted[0];
    const expectedKey = actionKey(expectedBest.action);
    const predictedKey = actionKey(predictedBest.action);
    if (expectedKey === predictedKey) top1Matches += 1;
    if (predicted.slice(0, topK).some((entry) => actionKey(entry.action) === expectedKey)) topKMatches += 1;

    if (expectedKey !== predictedKey && disagreements.length < disagreementLimit) {
      disagreements.push({
        scenarioId: labelSet.scenarioId || null,
        perspectiveSide: labelSet.perspectiveSide,
        expected: {
          action: expectedBest.action,
          score: expectedBest.score,
          responseAction: expectedBest.responseAction,
        },
        predicted: {
          action: predictedBest.action,
          modelScore: predictedBest.score,
          labelScore: expected.find((entry) => actionKey(entry.action) === predictedKey)?.score ?? null,
        },
      });
    }
  }

  return {
    scenarios: total,
    top1Agreement: total ? top1Matches / total : 0,
    topKAgreement: total ? topKMatches / total : 0,
    meanSpearmanCorrelation: total ? correlationTotal / total : 0,
    disagreements,
  };
};

const summarizeOracleMatches = (matches) => {
  const wins = matches.filter((match) => match.result === 'win').length;
  const draws = matches.filter((match) => match.result === 'draw').length;
  const losses = matches.filter((match) => match.result === 'loss').length;
  const unfinished = matches.filter((match) => match.result === 'unfinished').length;
  return {
    games: matches.length,
    wins,
    draws,
    losses,
    unfinished,
    winRate: matches.length ? wins / matches.length : 0,
    scoreRate: matches.length ? (wins + draws * 0.5) / matches.length : 0,
    fallbackCount: matches.reduce((total, match) => total + match.fallbacks.length, 0),
  };
};

export const evaluateShallowSearchOracle = async (scenarios, {
  maxResponses = 4,
  maxRounds = 12,
  seed = 1,
  onProgress = null,
} = {}) => {
  const matches = [];
  const oracle = {
    type: 'oracle',
    select: async (state) => {
      const labels = await generateMovementLabels({ state }, {
        maxResponses,
        seed,
      });
      return labels.bestAction;
    },
  };
  const easy = { type: 'easy' };

  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    for (const oracleSide of ['p1', 'p2']) {
      const result = await playMovementControllerMatch(scenario.state || scenario, {
        p1Controller: oracleSide === 'p1' ? oracle : easy,
        p2Controller: oracleSide === 'p2' ? oracle : easy,
        maxRounds,
        seed: seed + index * 101 + (oracleSide === 'p1' ? 0 : 1),
      });
      const outcome = result.outcome === oracleSide
        ? 'win'
        : result.outcome === 'draw'
          ? 'draw'
          : result.outcome === 'unfinished'
            ? 'unfinished'
            : 'loss';
      matches.push({ ...result, result: outcome });
    }
    if (typeof onProgress === 'function') {
      onProgress({ completed: index + 1, total: scenarios.length });
    }
  }

  return summarizeOracleMatches(matches);
};

export const isCandidateQualityImproved = (candidate, baseline) => {
  if (!baseline) return true;
  const compare = [
    ['easyScoreRate', candidate.easyScoreRate, baseline.easyScoreRate],
    ['heldOutTop1Agreement', candidate.heldOutTop1Agreement, baseline.heldOutTop1Agreement],
    ['heldOutSpearman', candidate.heldOutSpearman, baseline.heldOutSpearman],
  ];

  for (const [, candidateValue, baselineValue] of compare) {
    if (candidateValue > baselineValue + 0.000001) return true;
    if (candidateValue < baselineValue - 0.000001) return false;
  }
  return false;
};
