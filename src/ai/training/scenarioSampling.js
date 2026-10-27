import { playMovementControllerMatch } from './championEvaluation.js';
import { createRandomMovementScenarios } from './scenarioCorpus.js';

// FNV-1a over the parts, so each (seed, purpose, index) gets an unrelated random stream.
export const deriveSeed = (seed, ...parts) => {
  const text = [seed, ...parts].join(':');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

export const createFreshSeed = () => deriveSeed(Date.now(), Math.random());

// Random scenarios whose EasyAI+ mirror match is not a blowout: it must finish and last at least minRounds,
// which drops armies that die in one or two rounds before movement can matter.
export const createBalancedRandomScenarios = async ({
  count,
  seed,
  minRounds = 3,
  maxRounds = 20,
  batchSize = 20,
  maxBatches = 200,
  onProgress = null,
} = {}) => {
  const accepted = [];
  let inspected = 0;

  for (let batch = 0; accepted.length < count && batch < maxBatches; batch += 1) {
    const candidates = createRandomMovementScenarios({
      count: batchSize,
      seed: deriveSeed(seed, 'balanced', batch),
    });
    for (const scenario of candidates) {
      if (accepted.length >= count) break;
      inspected += 1;
      const result = await playMovementControllerMatch(scenario.state, {
        p1Controller: { type: 'easyplus' },
        p2Controller: { type: 'easyplus' },
        maxRounds,
        seed: deriveSeed(seed, 'filter', inspected),
      });
      if (result.completed && result.outcome !== 'draw' && result.resolvedRounds >= minRounds) {
        accepted.push(scenario);
        if (typeof onProgress === 'function') onProgress({ accepted: accepted.length, inspected, total: count });
      }
    }
  }

  if (accepted.length < count) {
    throw new Error(`Only found ${accepted.length}/${count} balanced scenarios after inspecting ${inspected}`);
  }
  return { scenarios: accepted, inspected };
};
