import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileCandidateScorer } from '../src/ai/training/candidateScorer.js';
import { evaluateCandidate, evaluatePromotionGate } from '../src/ai/training/championEvaluation.js';
import { createMovementScenarioCorpus } from '../src/ai/training/scenarioCorpus.js';
import { loadNodeModel } from '../src/ai/training/nodeModelCheckpoint.js';

const parseArguments = (argv) => {
  const options = {
    model: 'models/hardai-movement-candidate.json',
    champion: 'models/hardai-movement-champion.json',
    randomCount: 20,
    fixtureCount: 5,
    maxRounds: 20,
    seed: 20261017,
    evaluationOpponent: 'easyplus',
  };
  const keys = new Map([
    ['model', 'model'],
    ['champion', 'champion'],
    ['random-count', 'randomCount'],
    ['fixture-count', 'fixtureCount'],
    ['max-rounds', 'maxRounds'],
    ['seed', 'seed'],
    ['evaluation-opponent', 'evaluationOpponent'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const key = keys.get(argument.replace(/^--/, ''));
    if (!argument.startsWith('--') || !key) throw new Error(`Unsupported option: ${argument}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Option ${argument} requires a value`);
    index += 1;
    options[key] = ['model', 'champion', 'evaluationOpponent'].includes(key) ? value : Number(value);
  }
  if (!['easy', 'easyplus'].includes(options.evaluationOpponent)) {
    throw new Error('evaluation-opponent must be either easy or easyplus');
  }
  return options;
};

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch (_) {
    return false;
  }
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const modelPath = resolve(options.model);
  const championPath = resolve(options.champion);
  if (!await exists(modelPath)) throw new Error(`Candidate checkpoint does not exist: ${modelPath}`);

  const corpus = createMovementScenarioCorpus({ randomCount: options.randomCount, seed: options.seed });
  const scenarios = [
    ...corpus.filter((scenario) => scenario.source === 'fixture').slice(0, options.fixtureCount),
    ...corpus.filter((scenario) => scenario.source === 'random'),
  ];
  const candidateModel = compileCandidateScorer(await loadNodeModel(modelPath));
  const championModel = await exists(championPath)
    ? compileCandidateScorer(await loadNodeModel(championPath))
    : null;
  const evaluation = await evaluateCandidate({
    candidateModel,
    championModel,
    scenarios,
    evaluationOpponent: options.evaluationOpponent,
    maxRounds: options.maxRounds,
    seed: options.seed,
    onMatchComplete: ({
      benchmark,
      scenarioId,
      candidateSide,
      candidateResult,
      outcome,
      resolvedRounds,
      fallbacks,
      forcedSkips,
    }) => {
      const fallbackText = fallbacks.length ? `, fallbacks=${fallbacks.length}` : '';
      const fallbackDetails = fallbacks.length
        ? ` [${fallbacks.map((fallback) => `${fallback.controller}/${fallback.mover}/${fallback.reason}:${fallback.attemptedAction?.sourceId || 'none'}->${fallback.attemptedAction?.destinationId || 'none'}`).join('; ')}]`
        : '';
      const forcedSkipText = forcedSkips.length ? `, forced-skips=${forcedSkips.length}` : '';
      console.log(
        `[HardAI] Match (${benchmark}): HardAI=${candidateSide.toUpperCase()}, result=${candidateResult.toUpperCase()}, outcome=${outcome.toUpperCase()}, rounds=${resolvedRounds}${fallbackText}${fallbackDetails}${forcedSkipText}, scenario=${scenarioId || 'unnamed'}.`,
      );
    },
  });
  const promotion = evaluatePromotionGate(evaluation);

  console.log(JSON.stringify({ evaluation, promotion }, null, 2));
  championModel?.dispose();
  candidateModel.dispose();
};

main().catch((error) => {
  console.error(`[HardAI] Evaluation failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
